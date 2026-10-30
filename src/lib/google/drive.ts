import { driveStub, getDriveToken, NotSignedInError } from './auth';

/**
 * Minimal Google Drive v3 client (fetch + the user's drive.file token).
 * In stub mode the same requests go to /api/dev/drive, an in-memory fake.
 */

export const DRAWIO_MIME = 'application/vnd.jgraph.mxfile';
const API = driveStub ? '/api/dev/drive/v3' : 'https://www.googleapis.com/drive/v3';
const UPLOAD = driveStub ? '/api/dev/drive/upload/v3' : 'https://www.googleapis.com/upload/drive/v3';
const META_FIELDS = 'id,name,mimeType,headRevisionId,modifiedTime,webViewLink,capabilities(canEdit,canShare),owners(displayName)';

export interface DriveFile {
  id: string;
  name: string;
  mimeType?: string;
  headRevisionId?: string;
  modifiedTime?: string;
  webViewLink?: string;
  capabilities?: { canEdit?: boolean; canShare?: boolean };
  owners?: { displayName?: string }[];
}

export class DriveError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getDriveToken();
  const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new NotSignedInError();
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    const msg =
      res.status === 404
        ? "This file doesn't exist or hasn't been shared with you."
        : (body?.error?.message ?? `Google Drive returned ${res.status}`);
    throw new DriveError(msg, res.status);
  }
  return res;
}

export async function listDiagrams(): Promise<DriveFile[]> {
  const q = `(mimeType='${DRAWIO_MIME}' or name contains '.drawio') and trashed=false`;
  const params = new URLSearchParams({
    q,
    orderBy: 'modifiedTime desc',
    pageSize: '100',
    fields: `files(${META_FIELDS})`,
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  const res = await call(`${API}/files?${params}`);
  return ((await res.json()) as { files: DriveFile[] }).files;
}

export async function getFileMeta(id: string): Promise<DriveFile> {
  const res = await call(`${API}/files/${encodeURIComponent(id)}?fields=${META_FIELDS}&supportsAllDrives=true`);
  return res.json();
}

export async function downloadFile(id: string): Promise<string> {
  const res = await call(`${API}/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`);
  return res.text();
}

export async function createFile(name: string, xml: string): Promise<DriveFile> {
  const boundary = `drawio-${crypto.randomUUID()}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name, mimeType: DRAWIO_MIME }) +
    `\r\n--${boundary}\r\nContent-Type: ${DRAWIO_MIME}\r\n\r\n${xml}\r\n--${boundary}--`;
  const res = await call(`${UPLOAD}/files?uploadType=multipart&fields=${META_FIELDS}`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return res.json();
}

export async function updateFileContent(id: string, xml: string): Promise<DriveFile> {
  const res = await call(
    `${UPLOAD}/files/${encodeURIComponent(id)}?uploadType=media&fields=id,headRevisionId,modifiedTime&supportsAllDrives=true`,
    { method: 'PATCH', headers: { 'Content-Type': DRAWIO_MIME }, body: xml },
  );
  return res.json();
}

export async function renameFile(id: string, name: string): Promise<DriveFile> {
  const res = await call(`${API}/files/${encodeURIComponent(id)}?fields=id,name&supportsAllDrives=true`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return res.json();
}
