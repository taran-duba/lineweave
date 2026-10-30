'use client';

import { useEffect } from 'react';
import { InternalEvent } from '@maxgraph/core';
import { useEditor, useGraphVersion, useStore } from './hooks';

/**
 * Publishes the local cursor and selection, and draws collaborators' cursors
 * and selection outlines on top of the canvas. Positions are exchanged in
 * graph coordinates, so they line up regardless of each person's zoom/pan.
 */
export function CollabLayer() {
  const { session, canvas, pageId } = useEditor();
  const presence = session.presence;
  useGraphVersion(canvas);
  const others = useStore(presence?.others) ?? [];
  const cursors = useStore(presence?.cursors) ?? {};

  useEffect(() => {
    if (!presence || !canvas) return;
    const { graph } = canvas;
    const container = graph.container;
    const onMove = (e: PointerEvent) => {
      const { scale, translate } = graph.view;
      const rect = container.getBoundingClientRect();
      presence.setCursor({
        pageId,
        x: (e.clientX - rect.left) / scale - translate.x,
        y: (e.clientY - rect.top) / scale - translate.y,
      });
    };
    const onLeave = () => presence.setCursor(null);
    const publishSelection = () =>
      presence.setSelection(
        pageId,
        graph.getSelectionCells().flatMap((c) => (c.id ? [c.id] : [])),
      );
    container.addEventListener('pointermove', onMove);
    container.addEventListener('pointerleave', onLeave);
    graph.getSelectionModel().addListener(InternalEvent.CHANGE, publishSelection);
    publishSelection();
    return () => {
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerleave', onLeave);
      graph.getSelectionModel().removeListener(publishSelection);
    };
  }, [presence, canvas, pageId]);

  if (!presence || !canvas) return null;
  const { graph } = canvas;
  const { scale, translate } = graph.view;
  const here = others.filter((c) => c.pageId === pageId);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" data-testid="collab-layer">
      {here.flatMap((c) =>
        (c.selection ?? []).flatMap((id) => {
          const cell = graph.getDataModel().getCell(id);
          const state = cell && graph.view.getState(cell);
          if (!state) return [];
          return [
            <div
              key={`${c.uid}:${id}`}
              className="absolute rounded-[3px]"
              style={{
                left: state.x - 3,
                top: state.y - 3,
                width: state.width + 6,
                height: state.height + 6,
                outline: `2px solid ${c.color}`,
              }}
            />,
          ];
        }),
      )}
      {here.map((c) => {
        const pos = cursors[c.uid];
        if (!pos || pos.pageId !== pageId) return null;
        const x = (pos.x + translate.x) * scale;
        const y = (pos.y + translate.y) * scale;
        return (
          <div
            key={c.uid}
            data-testid="remote-cursor"
            className="absolute left-0 top-0 transition-transform duration-100 ease-linear"
            style={{ transform: `translate(${x}px, ${y}px)` }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" className="drop-shadow-sm">
              <path d="M1 1 L16 7.5 L9 9.5 L6.5 16.5 Z" fill={c.color} stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span
              className="absolute left-4 top-4 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium text-white shadow"
              style={{ background: c.color }}
            >
              {c.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
