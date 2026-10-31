'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EditorSession } from '@/lib/collab/session';
import { printDocument } from '@/lib/graph/documentExport';
import { pagesOf, sortedPageIds } from '@/lib/drawio/ydoc';
import { Canvas } from './Canvas';
import { CanvasContextMenu } from './CanvasContextMenu';
import { EditDataDialog } from './dialogs/EditDataDialog';
import { EditStyleDialog } from './dialogs/EditStyleDialog';
import { FindPanel } from './dialogs/FindPanel';
import { ImportDialog } from './dialogs/ImportDialog';
import { InsertImageDialog } from './dialogs/InsertImageDialog';
import { ShortcutsDialog } from './dialogs/ShortcutsDialog';
import { LayersPanel } from './LayersPanel';
import { CollabLayer } from './CollabLayer';
import { FormatPanel } from './FormatPanel';
import { HoverArrows } from './HoverArrows';
import { Minimap } from './Minimap';
import { PageLayer } from './PageLayer';
import { EditorContext, useStore, useYVersion, type CanvasHandle, type DialogRequest, type EditorContextValue } from './hooks';
import { PageTabs } from './PageTabs';
import { ShapeLibrary } from './ShapeLibrary';
import { Toolbar } from './Toolbar';
import { TopBar } from './TopBar';

function Notice({ session }: { session: EditorSession }) {
  const notice = useStore(session.notice);
  if (!notice) return null;
  return (
    <div className="flex shrink-0 items-center justify-center gap-3 border-b border-border bg-accent-soft px-4 py-1.5 text-[13px]">
      <span>{notice.text}</span>
      {notice.action && (
        <button type="button" onClick={notice.action.run} className="font-medium text-accent underline-offset-2 hover:underline">
          {notice.action.label}
        </button>
      )}
    </div>
  );
}

export function EditorShell({ session }: { session: EditorSession }) {
  const pages = pagesOf(session.doc);
  useYVersion(pages);
  const [pageId, setPageIdState] = useState(() => sortedPageIds(session.doc)[0]);
  const [canvas, setCanvas] = useState<CanvasHandle | null>(null);

  // If the current page disappears (deleted by a collaborator), fall back to the first page.
  const validPageId = pages.has(pageId) ? pageId : sortedPageIds(session.doc)[0];

  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const closeDialog = useCallback(() => setDialog(null), []);

  const setPageId = useCallback((id: string) => setPageIdState(id), []);
  const liveCanvas = canvas?.pageId === validPageId ? canvas : null;
  const value = useMemo<EditorContextValue>(
    () => ({ session, canvas: liveCanvas, pageId: validPageId, setPageId, openDialog: setDialog, layersOpen, setLayersOpen }),
    [session, liveCanvas, validPageId, setPageId, layersOpen],
  );

  // Shortcuts that open panels and dialogs (editing shortcuts live in the canvas).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t?.tagName ?? '') || liveCanvas?.graph.isEditing()) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      const single = liveCanvas?.graph.getSelectionCount() === 1 ? liveCanvas.graph.getSelectionCell()?.id : null;
      const open = (d: DialogRequest) => {
        e.preventDefault();
        setDialog(d);
      };
      if (key === 'f' && !e.shiftKey) open({ kind: 'find' });
      else if (key === 'p' && !e.shiftKey) {
        e.preventDefault();
        void printDocument(session.doc, session.title.get()).catch((err) => alert(err instanceof Error ? err.message : String(err)));
      }
      else if (key === '/') open({ kind: 'shortcuts' });
      else if (key === 'e' && !e.shiftKey && single && !session.readOnly) open({ kind: 'style', cellId: single });
      else if (key === 'm' && !e.shiftKey && single && !session.readOnly) open({ kind: 'data', cellId: single });
      else if (key === 'l' && e.shiftKey) {
        e.preventDefault();
        setLayersOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [liveCanvas, session.readOnly, session.doc, session.title]);

  if (!validPageId) return null;
  return (
    <EditorContext.Provider value={value}>
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
        <TopBar />
        <Notice session={session} />
        <Toolbar />
        <div className="flex min-h-0 flex-1">
          {!session.readOnly && <ShapeLibrary />}
          <div className="flex min-w-0 flex-1 flex-col">
            <Canvas
              key={validPageId}
              doc={session.doc}
              pageId={validPageId}
              readOnly={session.readOnly}
              onReady={setCanvas}
              underlay={<PageLayer />}
            >
              <HoverArrows />
              {session.presence && <CollabLayer />}
              <Minimap />
              <CanvasContextMenu />
              {layersOpen && <LayersPanel onClose={() => setLayersOpen(false)} />}
              {dialog?.kind === 'find' && liveCanvas && (
                <FindPanel canvas={liveCanvas} readOnly={session.readOnly} onClose={closeDialog} />
              )}
            </Canvas>
            <PageTabs />
          </div>
          <FormatPanel />
        </div>
      </div>
      {liveCanvas && dialog?.kind === 'style' && <EditStyleDialog canvas={liveCanvas} cellId={dialog.cellId} onClose={closeDialog} />}
      {liveCanvas && dialog?.kind === 'data' && <EditDataDialog canvas={liveCanvas} cellId={dialog.cellId} onClose={closeDialog} />}
      {liveCanvas && dialog?.kind === 'image' && <InsertImageDialog canvas={liveCanvas} onClose={closeDialog} />}
      {liveCanvas && dialog?.kind === 'import' && <ImportDialog canvas={liveCanvas} doc={session.doc} onClose={closeDialog} />}
      {dialog?.kind === 'shortcuts' && <ShortcutsDialog onClose={closeDialog} />}
    </EditorContext.Provider>
  );
}
