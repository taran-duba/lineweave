'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Download, ExternalLink, Workflow } from 'lucide-react';
import { serializeDrawio } from '@/lib/drawio/codec';
import { docToFile } from '@/lib/drawio/ydoc';
import { downloadBlob, exportPng, exportSvg } from '@/lib/graph/export';
import { Button } from '@/components/ui';
import { PresenceAvatars } from './PresenceAvatars';
import { SaveIndicator } from './SaveIndicator';
import { useEditor, useStore } from './hooks';

function safeName(title: string) {
  return title.replace(/\.drawio$/i, '').replace(/[\\/:*?"<>|]+/g, '-') || 'diagram';
}

function ExportMenu() {
  const { canvas, session } = useEditor();
  const title = useStore(session.title);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  const name = safeName(title);
  const run = async (kind: 'png' | 'svg' | 'drawio') => {
    setOpen(false);
    if (kind === 'drawio') {
      const xml = serializeDrawio(docToFile(session.doc));
      return downloadBlob(new Blob([xml], { type: 'application/xml' }), `${name}.drawio`);
    }
    if (!canvas) return;
    if (kind === 'svg') {
      return downloadBlob(new Blob([exportSvg(canvas.graph)], { type: 'image/svg+xml' }), `${name}.svg`);
    }
    downloadBlob(await exportPng(canvas.graph), `${name}.png`);
  };

  return (
    <div ref={ref} className="relative">
      <Button onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Download size={14} /> Export <ChevronDown size={14} />
      </Button>
      {open && (
        <div className="absolute right-0 top-9 z-50 w-48 overflow-hidden rounded-lg border border-border bg-panel py-1 shadow-lg">
          {(
            [
              ['png', 'PNG image (current page)'],
              ['svg', 'SVG image (current page)'],
              ['drawio', '.drawio file (all pages)'],
            ] as const
          ).map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              onClick={() => run(kind)}
              className="block w-full px-3 py-1.5 text-left text-[13px] hover:bg-panel-2"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TitleInput() {
  const { session } = useEditor();
  const title = useStore(session.title);
  const [draft, setDraft] = useState<string | null>(null);
  const editable = !!session.rename && !session.readOnly;
  const commit = async () => {
    const next = draft?.trim();
    setDraft(null);
    if (next && next !== title) await session.rename?.(next);
  };
  return (
    <input
      aria-label="Diagram name"
      value={draft ?? title}
      readOnly={!editable}
      onFocus={() => editable && setDraft(title)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(null);
          requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
        }
      }}
      className="h-8 min-w-0 max-w-80 flex-1 truncate rounded-md bg-transparent px-2 text-[15px] font-medium outline-none hover:bg-panel-2 focus:bg-panel-2"
    />
  );
}

export function TopBar() {
  const { session } = useEditor();
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-panel px-3">
      <Link href="/files" className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-white" title="All diagrams">
        <Workflow size={17} />
      </Link>
      <TitleInput />
      {session.readOnly && (
        <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[12px] font-medium text-muted">View only</span>
      )}
      <SaveIndicator />
      <div className="flex-1" />
      <PresenceAvatars />
      {session.driveUrl && (
        <a href={session.driveUrl} target="_blank" rel="noreferrer">
          <Button>
            <ExternalLink size={14} /> Share in Drive
          </Button>
        </a>
      )}
      <ExportMenu />
    </header>
  );
}
