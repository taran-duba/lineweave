'use client';

import { useEffect, useRef, useState } from 'react';
import type { Cell, InternalMouseEvent } from '@maxgraph/core';
import type { Direction } from '@/lib/graph/actions';
import { useEditor, useGraphVersion } from './hooks';

const OFFSET = 10;
const SIZE = 22;
const HIDE_DELAY_MS = 300;

const ROTATE: Record<Direction, number> = { north: -90, east: 0, south: 90, west: 180 };

/**
 * draw.io's blue hover arrows: hovering a shape shows an arrow on each side;
 * clicking one adds a copy of the shape in that direction, connected to it.
 */
export function HoverArrows() {
  const { canvas, session } = useEditor();
  useGraphVersion(canvas);
  const [cell, setCell] = useState<Cell | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const overArrows = useRef(false);

  useEffect(() => {
    if (!canvas || session.readOnly) return;
    const { graph } = canvas;
    let down = false;
    const show = (c: Cell) => {
      clearTimeout(hideTimer.current);
      setCell(c);
    };
    const scheduleHide = () => {
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => !overArrows.current && setCell(null), HIDE_DELAY_MS);
    };
    const listener = {
      mouseDown: () => {
        down = true;
        clearTimeout(hideTimer.current);
        setCell(null);
      },
      mouseMove: (_: unknown, me: InternalMouseEvent) => {
        if (down || graph.isEditing()) return;
        const c = me.getState()?.cell;
        if (c?.isVertex() && c.isConnectable() && graph.isConnectable()) show(c);
        else scheduleHide();
      },
      mouseUp: () => {
        down = false;
      },
    };
    graph.addMouseListener(listener);
    const leave = () => scheduleHide();
    graph.container.addEventListener('pointerleave', leave);
    return () => {
      clearTimeout(hideTimer.current);
      graph.removeMouseListener(listener);
      graph.container.removeEventListener('pointerleave', leave);
    };
  }, [canvas, session.readOnly]);

  if (!canvas || !cell || session.readOnly) return null;
  const state = canvas.graph.view.getState(cell);
  if (!state || !canvas.graph.getDataModel().contains(cell)) return null;

  const cx = state.x + state.width / 2;
  const cy = state.y + state.height / 2;
  const pos: Record<Direction, [number, number]> = {
    north: [cx - SIZE / 2, state.y - OFFSET - SIZE],
    south: [cx - SIZE / 2, state.y + state.height + OFFSET],
    west: [state.x - OFFSET - SIZE, cy - SIZE / 2],
    east: [state.x + state.width + OFFSET, cy - SIZE / 2],
  };

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" data-testid="hover-arrows">
      {(Object.keys(pos) as Direction[]).map((dir) => (
        <button
          key={dir}
          type="button"
          aria-label={`Add connected shape ${dir}`}
          title="Click to add a connected copy"
          className="pointer-events-auto absolute flex items-center justify-center rounded-full text-[#1a73e8] opacity-60 transition-opacity hover:opacity-100"
          style={{ left: pos[dir][0], top: pos[dir][1], width: SIZE, height: SIZE }}
          onPointerEnter={() => {
            overArrows.current = true;
            clearTimeout(hideTimer.current);
          }}
          onPointerLeave={() => {
            overArrows.current = false;
            hideTimer.current = setTimeout(() => setCell(null), HIDE_DELAY_MS);
          }}
          onClick={() => {
            overArrows.current = false;
            setCell(null);
            canvas.actions.cloneAndConnect(cell, dir);
          }}
        >
          <svg width={SIZE} height={SIZE} viewBox="0 0 22 22" style={{ transform: `rotate(${ROTATE[dir]}deg)` }}>
            <path d="M3 8.5h9V4l7 7-7 7v-4.5H3z" fill="currentColor" stroke="white" strokeWidth="1" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  );
}
