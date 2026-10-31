'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { Dialog } from '@/components/overlays';
import { Button } from '@/components/ui';
import type { Revision, VersionsApi } from '@/lib/collab/session';
import { parseDrawio } from '@/lib/drawio/codec';
import { pagesOf, sortedPageIds } from '@/lib/drawio/ydoc';
import { backgroundOf } from '@/lib/graph/documentExport';
import { exportSvg } from '@/lib/graph/export';
import { docFromFile, withPageGraph } from '@/lib/graph/renderPage';

function when(iso: string): string {
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Renders a revision's first page as an image (an <img>, so label HTML can't run scripts). */
async function previewOf(xml: string): Promise<{ src: string; pages: number }> {
  const file = parseDrawio(xml);
  const doc = docFromFile(file);
  try {
    const page = pagesOf(doc).get(sortedPageIds(doc)[0])!;
    const svg = await withPageGraph(page, (g) => exportSvg(g, { background: backgroundOf(page) }));
    return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, pages: file.pages.length };
  } finally {
    doc.destroy();
  }
}

/** Drive's version history: browse earlier versions and restore one for everyone. */
export function VersionsDialog({ versions, readOnly, onClose }: { versions: VersionsApi; readOnly: boolean; onClose(): void }) {
  const [list, setList] = useState<Revision[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: string; src: string; pages: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    versions
      .list()
      .then((l) => {
        setList(l);
        setSelected(l[0]?.id ?? null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [versions]);

  useEffect(() => {
    if (!selected) return;
    let live = true;
    versions
      .load(selected)
      .then(previewOf)
      .then((p) => live && setPreview({ id: selected, ...p }))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [versions, selected]);

  const restore = async () => {
    if (!selected || !confirm('Restore this version for everyone? The current version stays in the history.')) return;
    setRestoring(true);
    try {
      await versions.restore(selected);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRestoring(false);
    }
  };

  return (
    <Dialog
      title="Version history"
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {!readOnly && (
            <Button variant="primary" disabled={!selected || selected === list?.[0]?.id || restoring} onClick={restore}>
              {restoring && <Loader2 size={14} className="animate-spin" />} Restore this version
            </Button>
          )}
        </>
      }
    >
      {error && <p className="mb-2 text-[12px] text-danger">{error}</p>}
      {!list ? (
        <div className="flex justify-center py-12 text-muted">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="flex h-96 gap-3">
          <ul className="w-52 shrink-0 overflow-y-auto rounded-md border border-border" aria-label="Versions">
            {list.map((r, i) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelected(r.id)}
                  className={clsx('block w-full px-3 py-2 text-left text-[13px] hover:bg-panel-2', selected === r.id && 'bg-accent-soft')}
                >
                  <span className="block font-medium">{i === 0 ? 'Current version' : when(r.modifiedTime)}</span>
                  <span className="block text-[12px] text-muted">{i === 0 ? when(r.modifiedTime) : (r.author ?? 'Unknown')}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex min-w-0 flex-1 items-center justify-center overflow-hidden rounded-md border border-border bg-white">
            {preview && preview.id === selected ? (
              <figure className="flex h-full w-full flex-col">
                {/* eslint-disable-next-line @next/next/no-img-element -- a generated data: URL preview */}
                <img src={preview.src} alt="Preview of this version" className="min-h-0 flex-1 object-contain p-3" />
                {preview.pages > 1 && (
                  <figcaption className="border-t border-border px-3 py-1.5 text-[12px] text-muted">
                    First of {preview.pages} pages
                  </figcaption>
                )}
              </figure>
            ) : (
              <Loader2 className="animate-spin text-muted" />
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
