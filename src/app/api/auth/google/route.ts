import { AuthError, exchangeCode } from '@/lib/server/googleAuth';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const code = body?.code;
  if (typeof code !== 'string' || !code || code.length > 2048) {
    return Response.json({ error: 'Missing authorization code' }, { status: 400 });
  }
  try {
    return Response.json(await exchangeCode(code));
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 502;
    return Response.json({ error: e instanceof Error ? e.message : 'Sign-in failed' }, { status });
  }
}
