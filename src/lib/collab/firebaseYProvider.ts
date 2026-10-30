import * as Y from 'yjs';
import {
  child,
  get,
  onChildAdded,
  onValue,
  push,
  ref,
  serverTimestamp,
  update,
  type Database,
  type DatabaseReference,
} from 'firebase/database';
import { createStore } from '@/lib/store';
import { fromB64, toB64 } from './b64';

/**
 * Syncs a Y.Doc through Firebase Realtime Database:
 *
 *   rooms/{fileId}/snapshot = { state, at }   compacted document state
 *   rooms/{fileId}/updates/{pushId} = { u, by } incremental Yjs updates
 *
 * Every client appends its updates; everyone applies everyone's. Yjs updates
 * are commutative and idempotent, so order and duplicates don't matter.
 * Periodically one client (the save leader) folds the log into the snapshot,
 * deleting exactly the update keys it merged.
 */

const BATCH_MS = 50;
const COMPACT_AFTER = 200;

export class FirebaseYProvider {
  readonly online = createStore(true);
  readonly room: DatabaseReference;
  private readonly updatesRef: DatabaseReference;
  private readonly seen = new Set<string>();
  private readonly own = new Set<string>();
  private pending: Uint8Array[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private unsubs: (() => void)[] = [];
  private compacting = false;
  private lastSnapshot: string | null = null;
  /** Set by the session: only the save leader compacts. */
  isLeader: () => boolean = () => false;

  constructor(
    private readonly db: Database,
    fileId: string,
    readonly doc: Y.Doc,
    private readonly uid: string,
    private readonly canWrite: boolean,
  ) {
    this.room = ref(db, `rooms/${fileId}`);
    this.updatesRef = child(this.room, 'updates');
  }

  /** Loads the room atomically, then streams new updates. Resolves once in sync. */
  async connect(): Promise<void> {
    const [snapshot, updates] = await Promise.all([get(child(this.room, 'snapshot')), get(this.updatesRef)]);
    Y.transact(
      this.doc,
      () => {
        this.applySnapshot(snapshot.child('state').val());
        updates.forEach((u) => {
          this.applyRemote(u.key!, u.child('u').val());
        });
      },
      this,
    );

    this.unsubs.push(
      onChildAdded(this.updatesRef, (u) => {
        if (!this.own.has(u.key!)) this.applyRemote(u.key!, u.child('u').val());
        this.maybeCompact();
      }),
    );
    // A compaction elsewhere may have removed keys we hadn't seen yet; the
    // snapshot that replaced them contains their changes.
    this.unsubs.push(
      onValue(child(this.room, 'snapshot/state'), (s) => this.applySnapshot(s.val())),
    );
    const connectedRef = ref(this.db, '.info/connected');
    this.unsubs.push(onValue(connectedRef, (s) => this.online.set(s.val() === true)));

    this.doc.on('update', this.onLocalUpdate);
  }

  destroy(): void {
    this.flush();
    this.doc.off('update', this.onLocalUpdate);
    this.unsubs.forEach((fn) => fn());
    this.unsubs = [];
    clearTimeout(this.timer);
  }

  private applySnapshot(state: unknown): void {
    if (typeof state !== 'string' || state === this.lastSnapshot) return;
    this.lastSnapshot = state;
    Y.applyUpdate(this.doc, fromB64(state), this);
  }

  private applyRemote(key: string, b64: unknown): void {
    if (typeof b64 !== 'string' || this.seen.has(key)) return;
    this.seen.add(key);
    try {
      Y.applyUpdate(this.doc, fromB64(b64), this);
    } catch (e) {
      console.warn('Skipping malformed update', key, e);
    }
  }

  private onLocalUpdate = (u: Uint8Array, origin: unknown): void => {
    if (origin === this || !this.canWrite) return;
    this.pending.push(u);
    this.timer ??= setTimeout(() => this.flush(), BATCH_MS);
  };

  /** Pushes buffered local updates as one merged update. */
  flush(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.pending.length) return;
    const merged = Y.mergeUpdates(this.pending);
    this.pending = [];
    const node = push(this.updatesRef);
    this.own.add(node.key!);
    this.seen.add(node.key!);
    // Writes are queued locally while offline and sent on reconnect.
    update(node, { u: toB64(merged), by: this.uid, t: serverTimestamp() }).catch((e) => {
      console.error('Failed to send update', e);
    });
  }

  private maybeCompact(): void {
    if (!this.canWrite || this.compacting || this.seen.size < COMPACT_AFTER || !this.isLeader()) return;
    void this.compact();
  }

  /** Folds every update this client has applied into a new snapshot. */
  async compact(): Promise<void> {
    if (!this.canWrite || this.compacting) return;
    this.compacting = true;
    try {
      this.flush();
      const keys = [...this.seen];
      const state = toB64(Y.encodeStateAsUpdate(this.doc));
      this.lastSnapshot = state;
      const patch: Record<string, unknown> = { snapshot: { state, at: serverTimestamp(), by: this.uid } };
      for (const k of keys) patch[`updates/${k}`] = null;
      await update(this.room, patch);
      for (const k of keys) {
        this.seen.delete(k);
        this.own.delete(k);
      }
    } catch (e) {
      console.warn('Compaction failed; will retry later', e);
    } finally {
      this.compacting = false;
    }
  }

  /** Replaces the whole room with this doc's state (used when (re)seeding from Drive). */
  async replaceRoom(meta: Record<string, unknown>): Promise<void> {
    this.pending = [];
    const state = toB64(Y.encodeStateAsUpdate(this.doc));
    this.lastSnapshot = state;
    await update(this.room, {
      snapshot: { state, at: serverTimestamp(), by: this.uid },
      updates: null,
      meta,
    });
    this.seen.clear();
    this.own.clear();
  }
}
