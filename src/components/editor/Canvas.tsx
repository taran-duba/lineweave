'use client';

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import * as Y from 'yjs';
import { pagesOf } from '@/lib/drawio/ydoc';
import { YGraphBinding } from '@/lib/collab/yGraphBinding';
import { bindShortcuts, createActions } from '@/lib/graph/actions';
import { createGraph, setGridVisible } from '@/lib/graph/createGraph';
import type { Attrs } from '@/lib/drawio/types';
import { PALETTES } from '@/lib/graph/palette';
import type { CanvasHandle } from './hooks';

export const PALETTE_MIME = 'application/x-drawio-palette-item';

interface Props {
  doc: Y.Doc;
  pageId: string;
  readOnly: boolean;
  onReady(handle: CanvasHandle | null): void;
  /** Overlays rendered above the graph (remote cursors, etc.). */
  children?: ReactNode;
}

/** Mounts a maxGraph editor bound to one page of the Y.Doc. Remounted per page. */
export function Canvas({ doc, pageId, readOnly, onReady, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const handleRef = useRef<CanvasHandle | null>(null);
  const onReadyRef = useRef(onReady);
  useLayoutEffect(() => {
    onReadyRef.current = onReady;
  });

  useEffect(() => {
    const el = ref.current;
    const page = pagesOf(doc).get(pageId);
    if (!el || !page) return;
    const { graph, destroy } = createGraph(el);
    const binding = new YGraphBinding(graph.getDataModel(), page);
    const undo = new Y.UndoManager(binding.cells, { trackedOrigins: new Set([binding.origin]), captureTimeout: 0 });
    graph.setEnabled(!readOnly);
    const actions = createActions(graph, undo);
    const unbind = bindShortcuts(graph, actions);
    // Start with the content in view, or the page origin with a margin.
    if (graph.getDefaultParent().children.length) actions.fit();
    else graph.view.setTranslate(40, 40);

    // Grid visibility lives in the page's mxGraphModel attributes, so it's shared and saved.
    const syncGrid = () => setGridVisible(graph, (page.get('modelAttrs') as Attrs | undefined)?.grid !== '0');
    syncGrid();
    page.observe(syncGrid);

    const handle: CanvasHandle = { graph, actions, undo, pageId };
    handleRef.current = handle;
    onReadyRef.current(handle);
    // Handy for debugging and E2E tests; never exposed in production builds.
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __canvas?: CanvasHandle }).__canvas = handle;
    return () => {
      page.unobserve(syncGrid);
      handleRef.current = null;
      onReadyRef.current(null);
      unbind();
      undo.destroy();
      binding.destroy();
      destroy();
    };
  }, [doc, pageId, readOnly]);

  const onDrop = (e: React.DragEvent) => {
    const id = e.dataTransfer.getData(PALETTE_MIME);
    const handle = handleRef.current;
    const item = PALETTES.flatMap((p) => p.items).find((i) => i.id === id);
    if (!handle || !item) return;
    e.preventDefault();
    const { scale, translate } = handle.graph.view;
    const rect = ref.current!.getBoundingClientRect();
    handle.actions.insert(item, {
      x: (e.clientX - rect.left) / scale - translate.x,
      y: (e.clientY - rect.top) / scale - translate.y,
    });
    ref.current?.focus();
  };

  return (
    <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
      <div
        ref={ref}
        tabIndex={0}
        data-testid="graph-canvas"
        className="graph-canvas absolute inset-0 overflow-hidden"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(PALETTE_MIME)) e.preventDefault();
        }}
        onDrop={onDrop}
      />
      {children}
    </div>
  );
}
