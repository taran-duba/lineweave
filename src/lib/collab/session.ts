import type * as Y from 'yjs';
import type { Store } from '@/lib/store';

export interface Collaborator {
  uid: string;
  name: string;
  photo?: string;
  color: string;
  role: 'editor' | 'viewer';
  pageId?: string;
  /** Selected cell ids on `pageId`. */
  selection?: string[];
  /** When the client joined; used for save-leader election. */
  joinedAt: number;
}

export interface CursorPos {
  pageId: string;
  /** Graph (model) coordinates, independent of each viewer's zoom and pan. */
  x: number;
  y: number;
}

export interface PresenceController {
  self: Collaborator;
  /** Other connected collaborators. */
  others: Store<Collaborator[]>;
  cursors: Store<Record<string, CursorPos>>;
  setCursor(pos: CursorPos | null): void;
  setSelection(pageId: string, ids: string[]): void;
}

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'offline';

export interface SaveState {
  status: SaveStatus;
  savedAt?: number;
  savedBy?: string;
  message?: string;
}

export interface Notice {
  text: string;
  action?: { label: string; run: () => void };
}

/** Everything the editor needs; the local demo and the Drive+Firebase room both provide one. */
export interface EditorSession {
  doc: Y.Doc;
  readOnly: boolean;
  title: Store<string>;
  rename?(title: string): Promise<void>;
  presence?: PresenceController;
  save?: Store<SaveState>;
  saveNow?(): Promise<void>;
  /** Shown above the canvas, e.g. "This file changed in Drive". */
  notice?: Store<Notice | null>;
  driveUrl?: string;
}
