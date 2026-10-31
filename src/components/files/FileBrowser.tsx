'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { FileUp, FolderOpen, Loader2, LogOut, Plus, RefreshCw, Workflow } from 'lucide-react';
import { Button } from '@/components/ui';
import { serializeDrawio } from '@/lib/drawio/codec';
import { TEMPLATES } from '@/lib/templates';
import { NewDiagramDialog } from './NewDiagramDialog';
import { displayTitle } from '@/lib/collab/openRoom';
import { IMPORT_ACCEPT, importFile } from '@/lib/drawio/importers';
import { firebase } from '@/lib/firebase/client';
import { clearSessionHint } from '@/lib/sessionHint';
import { driveStub, NotSignedInError, signOut } from '@/lib/google/auth';
import { createFile, listDiagrams, type DriveFile } from '@/lib/google/drive';

const PALETTES: [string, string][] = [
  ['#0f766e', '#14b8a6'],
  ['#f97316', '#f59e0b'],
  ['#0ea5e9', '#0d9488'],
  ['#e11d48', '#f97316'],
  ['#16a34a', '#0d9488'],
  ['#d97706', '#dc2626'],
];

function paletteFor(id: string): [string, string] {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

/** A colorful stand-in thumbnail, unique per file, drawn as a tiny flowchart. */
function Thumb({ id }: { id: string }) {
  const [from, to] = paletteFor(id);
  return (
    <div className="relative h-28 overflow-hidden" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
      <svg viewBox="0 0 200 112" className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-110" aria-hidden>
        <path d="M70 40 H96 M136 40 H152 M116 52 V68" stroke="#fff" strokeOpacity=".7" strokeWidth="2" fill="none" />
        <rect x="26" y="26" width="44" height="28" rx="7" fill="#fff" fillOpacity=".9" />
        <rect x="96" y="26" width="40" height="28" rx="7" fill="#fff" fillOpacity=".55" />
        <rect x="152" y="26" width="30" height="28" rx="7" fill="#fff" fillOpacity=".35" />
        <path d="M116 68 L138 82 L116 96 L94 82 Z" fill="#fff" fillOpacity=".8" />
      </svg>
    </div>
  );
}

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
  const fileInput = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => onAuthStateChanged(firebase().auth, setUser), []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setFiles(await listDiagrams());
    } catch (e) {
      if (e instanceof NotSignedInError) {
        clearSessionHint();
        router.replace('/?next=/files');
      }
      else setError(e instanceof Error ? e.message : String(e));
    }
  }, [router]);

  useEffect(() => {
    if (user === null) {
      clearSessionHint();
      router.replace('/?next=/files');
    }
    // Fetching on sign-in is synchronizing with Drive, an external system.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else if (user) void refresh();
  }, [user, refresh, router]);

  const create = async (name: string, templateId: string) => {
    setBusy(true);
    try {
      const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];
      const file = await createFile(`${name}.drawio`, template.build());
      router.push(`/d/${file.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  /** Creates a new Drive diagram from a file on this computer. */
  const importLocal = async (local: File) => {
    setBusy(true);
    setError(null);
    try {
      const data = await importFile(local);
      const base = local.name.replace(/\.(drawio\.(png|svg)|drawio|xml|png|svg|vsdx|csv|mmd|mermaid|txt)$/i, '') || 'Imported diagram';
      const file = await createFile(`${base}.drawio`, serializeDrawio(data));
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

  const initial = (user.displayName || user.email || '?').trim()[0]?.toUpperCase();
  const actionCard =
    'lw-spot group flex items-center gap-3 rounded-xl border border-border bg-panel px-4 py-3 text-left text-sm font-medium transition-shadow hover:shadow-lg disabled:opacity-50';
  const iconTile = (color: string) => ({ background: `color-mix(in srgb, ${color} 16%, transparent)`, color });

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <div className="lw-blob lw-blob-a" aria-hidden />
      <div className="lw-blob lw-blob-b" aria-hidden />
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-bg/70 px-6 backdrop-blur-md">
        <Link href="/" aria-label="Lineweave home" className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-teal-800 to-teal-600 text-white shadow-sm">
          <Workflow size={17} />
        </Link>
        <span className="font-semibold">Lineweave</span>
        <div className="flex-1" />
        <span className="hidden text-sm text-muted sm:inline">{user.email}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-rose-500 text-sm font-semibold text-white">{initial}</span>
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
      <main className="relative mx-auto max-w-5xl px-6 py-10">
        <div className="lw-rise mb-8 flex items-end gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Your <span className="lw-gradient-text">diagrams</span>
            </h1>
            <p className="mt-1 text-sm text-muted">
              {files === null ? 'Loading from Drive…' : `${files.length} ${files.length === 1 ? 'diagram' : 'diagrams'} in your Drive`}
            </p>
          </div>
          <div className="flex-1" />
          <Button variant="ghost" onClick={refresh} aria-label="Refresh">
            <RefreshCw size={14} />
          </Button>
        </div>

        <div className="lw-rise mb-10 grid gap-3 sm:grid-cols-3" style={{ animationDelay: '80ms' }}>
          <button
            type="button"
            onClick={() => setCreating(true)}
            disabled={busy}
            className="group flex items-center gap-3 rounded-xl bg-gradient-to-br from-teal-800 to-teal-600 px-4 py-3 text-left text-sm font-semibold text-white shadow-[0_12px_30px_-12px_rgba(15,118,110,0.6)] transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
              {busy ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />}
            </span>
            New diagram
          </button>
          <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} className={actionCard}>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={iconTile('#0ea5e9')}>
              <FileUp size={17} />
            </span>
            Import a file
          </button>
          {!driveStub && (
            <button type="button" onClick={open} className={actionCard}>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={iconTile('#f97316')}>
                <FolderOpen size={17} />
              </span>
              Open from Drive
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept={IMPORT_ACCEPT}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void importLocal(f);
            }}
          />
        </div>

        {error && <p className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        {files === null ? (
          <div className="flex justify-center py-16 text-muted">
            <Loader2 className="animate-spin" />
          </div>
        ) : files.length === 0 ? (
          <div className="lw-cta rounded-2xl border border-border px-6 py-16 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-800 to-teal-600 text-white shadow-lg">
              <Workflow size={26} />
            </span>
            <p className="mt-4 text-lg font-semibold">No diagrams yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Create one, or open a .drawio file someone shared with you.</p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {files.map((f, i) => (
              <li key={f.id} className="lw-rise" style={{ animationDelay: `${160 + Math.min(i, 8) * 60}ms` }}>
                <Link
                  href={`/d/${f.id}`}
                  className="group block overflow-hidden rounded-xl border border-border bg-panel transition-all hover:-translate-y-1 hover:shadow-xl"
                >
                  <Thumb id={f.id} />
                  <div className="px-4 py-3">
                    <p className="truncate text-sm font-semibold">{displayTitle(f.name)}</p>
                    <p className="mt-0.5 flex items-center gap-2 truncate text-[13px] text-muted">
                      <span className="truncate">{f.owners?.[0]?.displayName}</span>
                      <span className="ml-auto shrink-0">{when(f.modifiedTime)}</span>
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-8 text-[13px] text-muted">
          Only diagrams created here or opened with “Open from Drive” appear in this list. To collaborate, share the file
          in Google Drive and have the other person open it from Drive.
        </p>
      </main>
      {creating && <NewDiagramDialog busy={busy} onCreate={create} onClose={() => !busy && setCreating(false)} />}
    </div>
  );
}
