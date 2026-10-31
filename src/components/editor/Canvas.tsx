'use client';

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import * as Y from 'yjs';
import { pagesOf } from '@/lib/drawio/ydoc';
import { YGraphBinding } from '@/lib/collab/yGraphBinding';
import { bindShortcuts, createActions } from '@/lib/graph/actions';
import { installTooltipsAndLinks } from '@/lib/graph/links';
import { createGraph, setGridVisible } from '@/lib/graph/createGraph';
import type { Attrs } from '@/lib/drawio/types';
import { readPageSettings } from '@/lib/graph/pageView';
import { PALETTES } from '@/lib/graph/palette';
import type { CanvasHandle } from './hooks';

export const PALETTE_MIME = 'application/x-drawio-palette-item';

interface Props {
  doc: Y.Doc;
  pageId: string;
  readOnly: boolean;
  onReady(handle: CanvasHandle | null): void;
  /** Rendered behind the graph (the page view's paper). */
  underlay?: ReactNode;
  /** Overlays rendered above the graph (remote cursors, etc.). */
  children?: ReactNode;
}

/** Mounts a maxGraph editor bound to one page of the Y.Doc. Remounted per page. */
export function Canvas({ doc, pageId, readOnly, onReady, underlay, children }: Props) {
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
    const undo = new Y.UndoManager(binding.cells, {
      trackedOrigins: new Set([binding.origin, binding.importOrigin]),
      captureTimeout: 0,
    });
    graph.setEnabled(!readOnly);
    const actions = createActions(graph, undo, binding);
    const uninstallLinks = installTooltipsAndLinks(graph, binding);
    const unbind = bindShortcuts(graph, actions);
    // Start with the content in view, or the page origin with a margin.
    if (graph.getDefaultParent().children.length) actions.fit();
    else graph.view.setTranslate(40, 40);

    // Grid, page view and background live in the page's mxGraphModel attributes,
    // so they're shared with collaborators and saved in the file.
    const syncPage = () => {
      const attrs = page.get('modelAttrs') as Attrs | undefined;
      const settings = readPageSettings(attrs);
      setGridVisible(graph, attrs?.grid !== '0');
      el.classList.toggle('page-view', settings.visible);
      el.style.backgroundColor = !settings.visible && settings.background ? settings.background : '';
    };
    syncPage();
    page.observe(syncPage);

    const handle: CanvasHandle = { graph, actions, undo, pageId, binding };
    handleRef.current = handle;
    onReadyRef.current(handle);
    // Handy for debugging and E2E tests; never exposed in production builds.
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __canvas?: CanvasHandle }).__canvas = handle;
    return () => {
      page.unobserve(syncPage);
      handleRef.current = null;
      onReadyRef.current(null);
      unbind();
      uninstallLinks();
      undo.destroy();
      binding.destroy();
      // Overlays (minimap, hover arrows, ...) clean up after this effect and still
      // need a live graph, so tear it down once React has finished unmounting.
      queueMicrotask(destroy);
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
    <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[var(--gutter)]">
      {underlay}
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
