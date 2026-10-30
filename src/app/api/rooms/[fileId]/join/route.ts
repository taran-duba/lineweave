import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { AccessError, driveRole } from '@/lib/server/driveAccess';

const FILE_ID = /^[A-Za-z0-9_-]{1,200}$/;

/**
 * Grants the signed-in user membership of a file's realtime room, with the
 * role Google Drive says they have. Realtime Database rules only let members
 * read the room and only editors write to it.
 */
export async function POST(request: Request, ctx: RouteContext<'/api/rooms/[fileId]/join'>) {
  const { fileId } = await ctx.params;
  if (!FILE_ID.test(fileId)) return Response.json({ error: 'Invalid file id' }, { status: 400 });

  const idToken = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  const body = (await request.json().catch(() => null)) as { driveToken?: unknown } | null;
  const driveToken = body?.driveToken;
  if (!idToken || typeof driveToken !== 'string' || driveToken.length > 4096) {
    return Response.json({ error: 'Missing credentials' }, { status: 401 });
  }

  try {
    const user = await adminAuth().verifyIdToken(idToken);
    const role = await driveRole(fileId, driveToken, user.email);
    await adminDb().ref(`rooms/${fileId}/members/${user.uid}`).set(role);
    return Response.json({ role });
  } catch (e) {
    if (e instanceof AccessError) return Response.json({ error: e.message }, { status: e.status });
    const code = (e as { code?: string }).code ?? '';
    if (code.startsWith('auth/')) return Response.json({ error: 'Invalid sign-in token' }, { status: 401 });
    console.error('join failed', e);
    return Response.json({ error: 'Could not join this diagram' }, { status: 500 });
  }
}
