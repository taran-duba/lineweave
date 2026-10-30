import 'server-only';

/**
 * In-memory stand-in for Google Drive, used only by local E2E tests
 * (DRIVE_STUB=1, never in production). Tokens look like `stub:<uid>`.
 */

export const driveStubEnabled = process.env.DRIVE_STUB === '1' && process.env.NODE_ENV !== 'production';

export interface StubFile {
  id: string;
  name: string;
  content: string;
  headRevisionId: string;
  modifiedTime: string;
  owner: string;
  /** Per-user role overrides; anyone else gets `editor` (like a shared link). */
  roles: Record<string, 'editor' | 'viewer' | 'none'>;
}

const g = globalThis as unknown as { __driveStub?: Map<string, StubFile> };
export const stubFiles = (g.__driveStub ??= new Map());

export function stubUid(authorization: string | null): string | null {
  const m = authorization?.match(/^Bearer stub:(.+)$/);
  return m ? m[1] : null;
}

export function stubRole(file: StubFile, uid: string): 'editor' | 'viewer' | 'none' {
  return file.roles[uid] ?? 'editor';
}

export function stubMeta(file: StubFile, uid: string) {
  const role = stubRole(file, uid);
  return {
    id: file.id,
    name: file.name,
    mimeType: 'application/vnd.jgraph.mxfile',
    headRevisionId: file.headRevisionId,
    modifiedTime: file.modifiedTime,
    webViewLink: `https://drive.google.com/file/d/${file.id}/view`,
    capabilities: { canEdit: role === 'editor', canShare: role === 'editor' },
    owners: [{ displayName: file.owner }],
  };
}

export function bumpRevision(file: StubFile): void {
  file.headRevisionId = crypto.randomUUID();
  file.modifiedTime = new Date().toISOString();
}
