import { bumpRevision, driveStubEnabled, stubFiles, stubMeta, stubRole, stubUid, type StubComment, type StubFile } from '@/lib/server/driveStub';

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
  const [v, files, id, sub, subId] = r.path;
  if (v !== 'v3' || files !== 'files') return err(404, 'Not found');
  if (id && sub) {
    const f = fileFor(id, r.uid);
    if (f instanceof Response) return f;
    if (sub === 'revisions' && !subId) {
      return Response.json({
        revisions: f.revisions.map((rev) => ({
          id: rev.id,
          modifiedTime: rev.modifiedTime,
          size: String(rev.content.length),
          lastModifyingUser: { displayName: rev.by },
        })),
      });
    }
    if (sub === 'revisions' && subId) {
      const rev = f.revisions.find((x) => x.id === subId);
      return rev ? new Response(rev.content, { headers: { 'Content-Type': 'application/xml' } }) : err(404, 'Revision not found');
    }
    if (sub === 'comments') return Response.json({ comments: f.comments });
    return err(404, 'Not found');
  }
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
  // Comments: POST v3/files/{id}/comments and v3/files/{id}/comments/{cid}/replies
  if (r.path[0] === 'v3' && r.path[3] === 'comments') {
    const f = fileFor(r.path[2], r.uid);
    if (f instanceof Response) return f;
    const body = (await request.json()) as { content?: string; action?: string };
    const now = new Date().toISOString();
    const author = { displayName: r.uid };
    if (!r.path[4]) {
      const c: StubComment = { id: crypto.randomUUID(), content: body.content ?? '', createdTime: now, resolved: false, author, replies: [] };
      f.comments.push(c);
      return Response.json({ id: c.id });
    }
    const c = f.comments.find((x) => x.id === r.path[4]);
    if (!c) return err(404, 'Comment not found');
    if (body.action === 'resolve') c.resolved = true;
    const reply = { id: crypto.randomUUID(), content: body.content ?? '', createdTime: now, action: body.action, author };
    c.replies.push(reply);
    return Response.json({ id: reply.id });
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
    revisions: [],
    comments: [],
  };
  bumpRevision(file, r.uid);
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
    bumpRevision(f, r.uid);
  } else {
    const { name } = (await request.json()) as { name?: string };
    if (name) f.name = name;
  }
  return Response.json(stubMeta(f, r.uid));
}
