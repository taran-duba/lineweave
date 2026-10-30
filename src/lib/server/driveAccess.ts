import 'server-only';
import { driveStubEnabled, stubFiles, stubRole, stubUid } from './driveStub';

export type Role = 'editor' | 'viewer';

export class AccessError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Asks Google Drive what the holder of `driveToken` may do with `fileId`.
 * Also checks that the token belongs to the same Google account as the
 * Firebase user, so nobody can join a room with someone else's token.
 */
export async function driveRole(fileId: string, driveToken: string, expectedEmail: string | undefined): Promise<Role> {
  if (driveStubEnabled) {
    const uid = stubUid(`Bearer ${driveToken}`);
    const file = stubFiles.get(fileId);
    if (!uid || !file) throw new AccessError('File not found', 404);
    const role = stubRole(file, uid);
    if (role === 'none') throw new AccessError('No access to this file', 403);
    return role;
  }

  const info = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(driveToken)}`, {
    cache: 'no-store',
  });
  const tokenInfo = (await info.json().catch(() => ({}))) as { email?: string; scope?: string };
  if (!info.ok) throw new AccessError('Invalid Google access token', 401);
  if (!expectedEmail || tokenInfo.email?.toLowerCase() !== expectedEmail.toLowerCase()) {
    throw new AccessError('Google token does not match the signed-in user', 403);
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,capabilities(canEdit)&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${driveToken}` }, cache: 'no-store' },
  );
  if (res.status === 404 || res.status === 403) throw new AccessError('No access to this file', 403);
  if (!res.ok) throw new AccessError(`Google Drive returned ${res.status}`, 502);
  const meta = (await res.json()) as { capabilities?: { canEdit?: boolean } };
  return meta.capabilities?.canEdit ? 'editor' : 'viewer';
}
