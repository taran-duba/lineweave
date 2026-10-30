'use client';

import type { Attrs } from '@/lib/drawio/types';
import { pagesOf } from '@/lib/drawio/ydoc';
import { pageBlock, readPageSettings } from '@/lib/graph/pageView';
import { useEditor, useGraphVersion, useYVersion } from './hooks';

/**
 * Page view (draw.io's default): the paper the diagram is laid out on, drawn
 * behind the graph. Pages grow to cover all content; page breaks are dashed.
 */
export function PageLayer() {
  const { canvas, session, pageId } = useEditor();
  useGraphVersion(canvas);
  const page = pagesOf(session.doc).get(pageId);
  useYVersion(page);
  if (!canvas || !page) return null;
  const attrs = page.get('modelAttrs') as Attrs | undefined;
  const settings = readPageSettings(attrs);
  if (!settings.visible) return null;

  const { graph } = canvas;
  const { scale: s, translate: t } = graph.view;
  const block = pageBlock(graph, settings);
  const left = (block.x + t.x) * s;
  const top = (block.y + t.y) * s;
  const width = block.cols * settings.width * s;
  const height = block.rows * settings.height * s;

  const grid = graph.isGridEnabled();
  const minor = graph.gridSize * s;
  const major = minor * 4;
  // Grid lines stay aligned to model coordinates, wherever the page block starts.
  const ox = -(((block.x % (graph.gridSize * 4)) + graph.gridSize * 4) % (graph.gridSize * 4)) * s;
  const oy = -(((block.y % (graph.gridSize * 4)) + graph.gridSize * 4) % (graph.gridSize * 4)) * s;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" data-testid="page-layer">
      <div
        className="absolute shadow-[0_1px_4px_rgba(0,0,0,0.15)]"
        style={{
          left,
          top,
          width,
          height,
          backgroundColor: settings.background ?? 'var(--canvas)',
          backgroundImage: grid
            ? [
                'linear-gradient(to right, var(--grid-major) 1px, transparent 1px)',
                'linear-gradient(to bottom, var(--grid-major) 1px, transparent 1px)',
                'linear-gradient(to right, var(--grid-minor) 1px, transparent 1px)',
                'linear-gradient(to bottom, var(--grid-minor) 1px, transparent 1px)',
              ].join(',')
            : undefined,
          backgroundSize: `${major}px ${major}px, ${major}px ${major}px, ${minor}px ${minor}px, ${minor}px ${minor}px`,
          backgroundPosition: Array(4).fill(`${ox}px ${oy}px`).join(','),
        }}
      />
      {Array.from({ length: block.cols - 1 }, (_, i) => (
        <div
          key={`c${i}`}
          className="absolute border-l border-dashed border-[var(--page-break)]"
          style={{ left: left + (i + 1) * settings.width * s, top, height }}
        />
      ))}
      {Array.from({ length: block.rows - 1 }, (_, i) => (
        <div
          key={`r${i}`}
          className="absolute border-t border-dashed border-[var(--page-break)]"
          style={{ top: top + (i + 1) * settings.height * s, left, width }}
        />
      ))}
    </div>
  );
}
