import {
  child,
  onDisconnect,
  onValue,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
  type Database,
  type DatabaseReference,
} from 'firebase/database';
import { createStore } from '@/lib/store';
import type { Collaborator, CursorPos, PresenceController } from './session';

/**
 * Presence over Realtime Database:
 *
 *   rooms/{fileId}/presence/{sessionKey} = Collaborator (removed on disconnect)
 *   rooms/{fileId}/cursors/{sessionKey}  = { p, x, y }  (throttled, removed on disconnect)
 *
 * Session keys are `${uid}_${random}` so one person in two tabs shows as two
 * cursors. Cursor writes are throttled to keep Spark-plan bandwidth low; the
 * receiving side animates between positions.
 */

const CURSOR_INTERVAL_MS = 80;
const COLORS = ['#e5484d', '#f76b15', '#ffc53d', '#46a758', '#12a594', '#0090ff', '#6e56cf', '#d6409f', '#ad7f58', '#3e63dd'];

function colorFor(key: string): string {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

export interface PresenceOptions {
  uid: string;
  name: string;
  photo?: string;
  role: 'editor' | 'viewer';
}

export class FirebasePresence implements PresenceController {
  readonly self: Collaborator;
  readonly key: string;
  readonly others = createStore<Collaborator[]>([]);
  readonly cursors = createStore<Record<string, CursorPos>>({});
  private readonly presenceRef: DatabaseReference;
  private readonly cursorRef: DatabaseReference;
  private unsubs: (() => void)[] = [];
  private lastCursorSent = 0;
  private cursorTimer: ReturnType<typeof setTimeout> | undefined;
  private nextCursor: CursorPos | null | undefined;
  private destroyed = false;
  private announced = false;

  constructor(
    private readonly db: Database,
    private readonly room: DatabaseReference,
    opts: PresenceOptions,
  ) {
    this.key = `${opts.uid}_${Math.random().toString(36).slice(2, 10)}`;
    this.self = {
      uid: this.key,
      name: opts.name,
      photo: opts.photo,
      color: colorFor(opts.uid),
      role: opts.role,
      joinedAt: Date.now(),
    };
    this.presenceRef = child(room, `presence/${this.key}`);
    this.cursorRef = child(room, `cursors/${this.key}`);
  }

  connect(): void {
    const connectedRef = ref(this.db, '.info/connected');
    // (Re)announce ourselves on every (re)connection.
    this.unsubs.push(
      onValue(connectedRef, async (s) => {
        if (s.val() !== true) return;
        await onDisconnect(this.presenceRef).remove();
        await onDisconnect(this.cursorRef).remove();
        // destroy() may have run while we awaited; don't resurrect a dead session.
        if (this.destroyed) return;
        const { name, photo, color, role, pageId, selection } = this.self;
        await set(this.presenceRef, stripUndefined({ name, photo, color, role, pageId, selection, joinedAt: serverTimestamp() }));
        this.announced = true;
        if (this.destroyed) remove(this.presenceRef).catch(() => undefined);
      }),
    );
    this.unsubs.push(
      onValue(child(this.room, 'presence'), (s) => {
        const list: Collaborator[] = [];
        s.forEach((c) => {
          if (c.key === this.key) {
            const joinedAt = c.child('joinedAt').val();
            if (typeof joinedAt === 'number') this.self.joinedAt = joinedAt;
            return;
          }
          const v = c.val() as Omit<Collaborator, 'uid'>;
          if (typeof v?.name !== 'string') return;
          list.push({ ...v, uid: c.key!, selection: v.selection ?? [] });
        });
        list.sort((a, b) => a.joinedAt - b.joinedAt);
        this.others.set(list);
      }),
    );
    this.unsubs.push(
      onValue(child(this.room, 'cursors'), (s) => {
        const next: Record<string, CursorPos> = {};
        s.forEach((c) => {
          if (c.key === this.key) return;
          const v = c.val() as { p?: string; x?: number; y?: number };
          if (v?.p && typeof v.x === 'number' && typeof v.y === 'number') next[c.key!] = { pageId: v.p, x: v.x, y: v.y };
        });
        this.cursors.set(next);
      }),
    );
  }

  setCursor(pos: CursorPos | null): void {
    this.nextCursor = pos;
    const wait = CURSOR_INTERVAL_MS - (Date.now() - this.lastCursorSent);
    if (wait <= 0) this.sendCursor();
    else this.cursorTimer ??= setTimeout(() => this.sendCursor(), wait);
  }

  private sendCursor(): void {
    clearTimeout(this.cursorTimer);
    this.cursorTimer = undefined;
    this.lastCursorSent = Date.now();
    const pos = this.nextCursor;
    if (pos === undefined) return;
    this.nextCursor = undefined;
    const write = pos
      ? set(this.cursorRef, { p: pos.pageId, x: Math.round(pos.x), y: Math.round(pos.y) })
      : remove(this.cursorRef);
    write.catch(() => undefined);
  }

  setSelection(pageId: string, ids: string[]): void {
    this.self.pageId = pageId;
    this.self.selection = ids;
    // Before the first announcement the full entry (with these fields) is written by connect().
    if (!this.announced || this.destroyed) return;
    update(this.presenceRef, { pageId, selection: ids.slice(0, 200) }).catch(() => undefined);
  }

  /** Collaborators (including us) who can edit, oldest session first. */
  editors(): Collaborator[] {
    return [this.self, ...this.others.get()]
      .filter((c) => c.role === 'editor')
      .sort((a, b) => a.joinedAt - b.joinedAt || (a.uid < b.uid ? -1 : 1));
  }

  isLeader(): boolean {
    return this.self.role === 'editor' && this.editors()[0]?.uid === this.key;
  }

  destroy(): void {
    this.destroyed = true;
    clearTimeout(this.cursorTimer);
    this.unsubs.forEach((fn) => fn());
    this.unsubs = [];
    remove(this.presenceRef).catch(() => undefined);
    remove(this.cursorRef).catch(() => undefined);
  }
}

function stripUndefined<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}
