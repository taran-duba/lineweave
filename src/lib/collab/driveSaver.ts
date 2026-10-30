import type * as Y from 'yjs';
import { child, onValue, serverTimestamp, update, type DatabaseReference } from 'firebase/database';
import { serializeDrawio } from '@/lib/drawio/codec';
import { docToFile } from '@/lib/drawio/ydoc';
import { getFileMeta, updateFileContent } from '@/lib/google/drive';
import { createStore } from '@/lib/store';
import type { SaveState } from './session';

/**
 * Autosaves the shared document to Google Drive. Exactly one connected editor
 * (the "save leader", the longest-connected editor) writes to Drive; leadership
 * moves automatically when they leave. Everyone else learns about saves via
 * rooms/{fileId}/meta.
 */

const DEBOUNCE_MS = 2000;
const MAX_WAIT_MS = 15_000;
const RETRY_MS = 10_000;
const EXTERNAL_CHECK_MS = 60_000;

export interface RoomMeta {
  driveHeadRevisionId?: string;
  hash?: string;
  savedAt?: number;
  savedBy?: string;
  title?: string;
  /** Set when Drive has a revision we didn't write (edited in diagrams.net, restored, ...). */
  external?: { revisionId: string; at: number } | null;
}

export async function hashXml(xml: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(xml));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export class DriveSaver {
  readonly state = createStore<SaveState>({ status: 'idle' });
  readonly meta = createStore<RoomMeta>({});
  private readonly metaRef: DatabaseReference;
  private debounce: ReturnType<typeof setTimeout> | undefined;
  private firstPendingAt = 0;
  private saving: Promise<void> | null = null;
  private again = false;
  private unsubs: (() => void)[] = [];
  private intervals: ReturnType<typeof setInterval>[] = [];
  private wasLeader = false;

  constructor(
    private readonly doc: Y.Doc,
    room: DatabaseReference,
    private readonly fileId: string,
    private readonly opts: { canWrite: boolean; isLeader: () => boolean; userName: string },
  ) {
    this.metaRef = child(room, 'meta');
  }

  start(): void {
    this.unsubs.push(
      onValue(this.metaRef, (s) => {
        const m = (s.val() ?? {}) as RoomMeta;
        this.meta.set(m);
        if (!this.debounce && !this.saving && m.savedAt) {
          this.state.set({ status: 'saved', savedAt: m.savedAt, savedBy: m.savedBy });
        }
      }),
    );
    this.doc.on('update', this.onDocUpdate);
    // Leadership can change without any doc edit (leader closed their tab):
    // the new leader checks whether the latest state still needs saving.
    this.intervals.push(
      setInterval(() => {
        const leader = this.opts.isLeader();
        if (leader && !this.wasLeader) this.schedule(0);
        this.wasLeader = leader;
      }, 3000),
      setInterval(() => void this.checkExternal(), EXTERNAL_CHECK_MS),
    );
    window.addEventListener('beforeunload', this.onBeforeUnload);
  }

  destroy(): void {
    this.doc.off('update', this.onDocUpdate);
    this.unsubs.forEach((fn) => fn());
    this.intervals.forEach(clearInterval);
    clearTimeout(this.debounce);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
  }

  private onDocUpdate = (): void => {
    if (this.state.get().status !== 'error') this.state.set({ ...this.state.get(), status: 'pending' });
    if (this.opts.isLeader()) this.schedule(DEBOUNCE_MS);
  };

  private onBeforeUnload = (e: BeforeUnloadEvent): void => {
    if (this.opts.isLeader() && (this.debounce || this.saving)) {
      void this.saveNow();
      e.preventDefault();
    }
  };

  private schedule(delay: number): void {
    if (!this.opts.canWrite) return;
    const now = Date.now();
    if (!this.debounce) this.firstPendingAt = now;
    clearTimeout(this.debounce);
    const wait = Math.max(0, Math.min(delay, this.firstPendingAt + MAX_WAIT_MS - now));
    this.debounce = setTimeout(() => {
      this.debounce = undefined;
      void this.saveNow();
    }, wait);
  }

  /** Saves immediately (also used by the "retry" button). */
  async saveNow(): Promise<void> {
    if (!this.opts.canWrite) return;
    if (this.saving) {
      this.again = true;
      return this.saving;
    }
    this.saving = this.doSave().finally(() => {
      this.saving = null;
      if (this.again) {
        this.again = false;
        void this.saveNow();
      }
    });
    return this.saving;
  }

  private async doSave(): Promise<void> {
    const xml = serializeDrawio(docToFile(this.doc));
    const hash = await hashXml(xml);
    const meta = this.meta.get();
    if (hash === meta.hash) {
      this.state.set({ status: 'saved', savedAt: meta.savedAt, savedBy: meta.savedBy });
      return;
    }
    this.state.set({ ...this.state.get(), status: 'saving' });
    try {
      const res = await updateFileContent(this.fileId, xml);
      await update(this.metaRef, {
        driveHeadRevisionId: res.headRevisionId ?? null,
        hash,
        savedAt: serverTimestamp(),
        savedBy: this.opts.userName,
        external: null,
      });
      this.state.set({ status: 'saved', savedAt: Date.now(), savedBy: this.opts.userName });
    } catch (e) {
      this.state.set({ status: 'error', message: e instanceof Error ? e.message : String(e) });
      setTimeout(() => this.opts.isLeader() && this.schedule(0), RETRY_MS);
    }
  }

  /** Leader-only: notices revisions written by someone other than this app. */
  private async checkExternal(): Promise<void> {
    if (!this.opts.isLeader() || this.saving || this.debounce) return;
    try {
      const file = await getFileMeta(this.fileId);
      const meta = this.meta.get();
      if (file.headRevisionId && meta.driveHeadRevisionId && file.headRevisionId !== meta.driveHeadRevisionId) {
        if (meta.external?.revisionId !== file.headRevisionId) {
          await update(this.metaRef, { external: { revisionId: file.headRevisionId, at: serverTimestamp() } });
        }
      }
    } catch {
      // Transient Drive errors are fine; we'll check again.
    }
  }
}
