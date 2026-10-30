'use client';

import { useCallback, useMemo, useState } from 'react';
import type { EditorSession } from '@/lib/collab/session';
import { pagesOf, sortedPageIds } from '@/lib/drawio/ydoc';
import { Canvas } from './Canvas';
import { CollabLayer } from './CollabLayer';
import { FormatPanel } from './FormatPanel';
import { EditorContext, useStore, useYVersion, type CanvasHandle, type EditorContextValue } from './hooks';
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

  const setPageId = useCallback((id: string) => setPageIdState(id), []);
  const value = useMemo<EditorContextValue>(
    () => ({ session, canvas: canvas?.pageId === validPageId ? canvas : null, pageId: validPageId, setPageId }),
    [session, canvas, validPageId, setPageId],
  );

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
            <Canvas key={validPageId} doc={session.doc} pageId={validPageId} readOnly={session.readOnly} onReady={setCanvas}>
              {session.presence && <CollabLayer />}
            </Canvas>
            <PageTabs />
          </div>
          <FormatPanel />
        </div>
      </div>
    </EditorContext.Provider>
  );
}
