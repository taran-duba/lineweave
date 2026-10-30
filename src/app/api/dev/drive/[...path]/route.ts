import { bumpRevision, driveStubEnabled, stubFiles, stubMeta, stubRole, stubUid, type StubFile } from '@/lib/server/driveStub';

/**
 * Fake Google Drive for local E2E tests. Mirrors the handful of v3 endpoints
 * src/lib/google/drive.ts uses. Disabled unless DRIVE_STUB=1 outside production.
 */

type Ctx = RouteContext<'/api/dev/drive/[...path]'>;

const err = (status: number, message: string) => Response.json({ error: { message } }, { status });

async function resolve(request: Request, ctx: Ctx) {
  if (!driveStubEnabled) return { error: err(404, 'Not found') } as const;
  const uid = stubUid(request.headers.get('authorization'));
  if (!uid) return { error: err(401, 'Missing stub token') } as const;
  const { path } = await ctx.params;
  return { uid, path, url: new URL(request.url) } as const;
}

function fileFor(id: string, uid: string): StubFile | Response {
  const f = stubFiles.get(id);
  if (!f || stubRole(f, uid) === 'none') return err(404, 'File not found');
  return f;
}

export async function GET(request: Request, ctx: Ctx) {
  const r = await resolve(request, ctx);
  if ('error' in r) return r.error;
  const [v, files, id] = r.path;
  if (v !== 'v3' || files !== 'files') return err(404, 'Not found');
  if (!id) {
    const list = [...stubFiles.values()].filter((f) => stubRole(f, r.uid) !== 'none').map((f) => stubMeta(f, r.uid));
    return Response.json({ files: list.sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime)) });
  }
  const f = fileFor(id, r.uid);
  if (f instanceof Response) return f;
  if (r.url.searchParams.get('alt') === 'media') return new Response(f.content, { headers: { 'Content-Type': 'application/xml' } });
  return Response.json(stubMeta(f, r.uid));
}

export async function POST(request: Request, ctx: Ctx) {
  const r = await resolve(request, ctx);
  if ('error' in r) return r.error;
  // Test helper: POST /api/dev/drive/share { fileId, uid, role }
  if (r.path[0] === 'share') {
    const { fileId, uid, role } = (await request.json()) as { fileId: string; uid: string; role: StubFile['roles'][string] };
    const f = stubFiles.get(fileId);
    if (!f) return err(404, 'File not found');
    f.roles[uid] = role;
    return Response.json({ ok: true });
  }
  if (r.path.join('/') !== 'upload/v3/files') return err(404, 'Not found');
  const boundary = request.headers.get('content-type')?.match(/boundary=(.+)$/)?.[1];
  const raw = await request.text();
  const parts = boundary ? raw.split(`--${boundary}`).slice(1, -1) : [];
  const bodyOf = (p: string) => p.slice(p.indexOf('\r\n\r\n') + 4).replace(/\r\n$/, '');
  const meta = JSON.parse(parts[0] ? bodyOf(parts[0]) : '{}') as { name?: string };
  const file: StubFile = {
    id: crypto.randomUUID().replace(/-/g, ''),
    name: meta.name ?? 'Untitled.drawio',
    content: parts[1] ? bodyOf(parts[1]) : '',
    headRevisionId: '',
    modifiedTime: '',
    owner: r.uid,
    roles: {},
  };
  bumpRevision(file);
  stubFiles.set(file.id, file);
  return Response.json(stubMeta(file, r.uid));
}

export async function PATCH(request: Request, ctx: Ctx) {
  const r = await resolve(request, ctx);
  if ('error' in r) return r.error;
  const upload = r.path[0] === 'upload';
  const [v, files, id] = upload ? r.path.slice(1) : r.path;
  if (v !== 'v3' || files !== 'files' || !id) return err(404, 'Not found');
  const f = fileFor(id, r.uid);
  if (f instanceof Response) return f;
  if (stubRole(f, r.uid) !== 'editor') return err(403, 'The user does not have sufficient permissions for this file.');
  if (upload) {
    f.content = await request.text();
    bumpRevision(f);
  } else {
    const { name } = (await request.json()) as { name?: string };
    if (name) f.name = name;
  }
  return Response.json(stubMeta(f, r.uid));
}
