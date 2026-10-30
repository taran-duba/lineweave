import { AuthError, refreshAccessToken } from '@/lib/server/googleAuth';

export async function POST() {
  try {
    return Response.json(await refreshAccessToken());
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 502;
    return Response.json({ error: e instanceof Error ? e.message : 'Token refresh failed' }, { status });
  }
}
