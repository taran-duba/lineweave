'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { FileText, FolderOpen, Loader2, LogOut, Plus, RefreshCw, Workflow } from 'lucide-react';
import { Button } from '@/components/ui';
import { serializeDrawio, emptyFile } from '@/lib/drawio/codec';
import { displayTitle } from '@/lib/collab/openRoom';
import { firebase } from '@/lib/firebase/client';
import { driveStub, NotSignedInError, signOut } from '@/lib/google/auth';
import { createFile, listDiagrams, type DriveFile } from '@/lib/google/drive';

function when(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString();
}

export default function FileBrowser() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => onAuthStateChanged(firebase().auth, setUser), []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setFiles(await listDiagrams());
    } catch (e) {
      if (e instanceof NotSignedInError) router.replace('/?next=/files');
      else setError(e instanceof Error ? e.message : String(e));
    }
  }, [router]);

  useEffect(() => {
    if (user === null) router.replace('/?next=/files');
    // Fetching on sign-in is synchronizing with Drive, an external system.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else if (user) void refresh();
  }, [user, refresh, router]);

  const create = async () => {
    const name = prompt('Name your diagram', 'Untitled diagram')?.trim();
    if (!name) return;
    setBusy(true);
    try {
      const file = await createFile(`${name}.drawio`, serializeDrawio(emptyFile()));
      router.push(`/d/${file.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const open = async () => {
    try {
      const { pickDiagram } = await import('@/lib/google/picker');
      const picked = await pickDiagram();
      if (picked) router.push(`/d/${picked.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (!user) {
    return (
      <div className="flex h-dvh items-center justify-center text-muted">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="flex h-14 items-center gap-3 border-b border-border bg-panel px-6">
        <Link href="/" className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-white">
          <Workflow size={17} />
        </Link>
        <span className="font-semibold">Your diagrams</span>
        <div className="flex-1" />
        <span className="hidden text-sm text-muted sm:inline">{user.email}</span>
        <Button
          variant="ghost"
          onClick={async () => {
            await signOut();
            router.replace('/');
          }}
        >
          <LogOut size={14} /> Sign out
        </Button>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={create} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} New diagram
          </Button>
          {!driveStub && (
            <Button onClick={open}>
              <FolderOpen size={14} /> Open from Drive
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" onClick={refresh} aria-label="Refresh">
            <RefreshCw size={14} />
          </Button>
        </div>
        {error && <p className="mb-4 rounded-md bg-accent-soft px-3 py-2 text-sm text-danger">{error}</p>}
        {files === null ? (
          <div className="flex justify-center py-16 text-muted">
            <Loader2 className="animate-spin" />
          </div>
        ) : files.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center text-sm text-muted">
            No diagrams yet. Create one, or open a .drawio file someone shared with you.
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-panel">
            {files.map((f) => (
              <li key={f.id}>
                <Link href={`/d/${f.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-panel-2">
                  <FileText size={18} className="shrink-0 text-accent" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{displayTitle(f.name)}</span>
                  <span className="hidden truncate text-[13px] text-muted sm:inline">{f.owners?.[0]?.displayName}</span>
                  <span className="w-20 shrink-0 text-right text-[13px] text-muted">{when(f.modifiedTime)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-[13px] text-muted">
          Only diagrams created here or opened with “Open from Drive” appear in this list. To collaborate, share the file
          in Google Drive and have the other person open it from Drive.
        </p>
      </main>
    </div>
  );
}
