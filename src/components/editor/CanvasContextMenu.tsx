'use client';

import { useEffect, useState } from 'react';
import { ContextMenu, type ContextMenuEntry } from '@/components/overlays';
import { isLocked } from '@/lib/graph/arrange';
import { lastCopied } from '@/lib/graph/clipboard';
import { isMac, modKey, useEditor } from './hooks';

const CLICK_TOLERANCE = 4;

/**
 * Right-click menu for the canvas. Opens on a right-click that doesn't move
 * (right-drag still pans), or Ctrl+click on macOS.
 */
export function CanvasContextMenu() {
  const { canvas, session, openDialog, setLayersOpen } = useEditor();
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!canvas) return;
    const { graph } = canvas;
    const el = graph.container;
    let down: { x: number; y: number } | null = null;
    const open = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      const cell = graph.getCellAt(clientX - rect.left, clientY - rect.top);
      if (cell && !graph.isCellSelected(cell)) graph.setSelectionCell(cell);
      if (!cell) graph.clearSelection();
      setAt({ x: clientX, y: clientY });
    };
    const onDown = (e: PointerEvent) => {
      if (e.button === 2) down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (e.button !== 2 || !down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_TOLERANCE;
      down = null;
      if (!moved) open(e.clientX, e.clientY);
    };
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      if (isMac() && e.button === 0 && e.ctrlKey) open(e.clientX, e.clientY);
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('contextmenu', onContext);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('contextmenu', onContext);
    };
  }, [canvas]);

  if (!at || !canvas) return null;
  const { graph, actions: a } = canvas;
  const m = modKey();
  const cells = graph.getSelectionCells();
  const ro = session.readOnly;
  const single = cells.length === 1 ? cells[0] : null;
  const vertices = cells.filter((c) => c.isVertex());
  const edgesWithPoints = cells.some((c) => c.isEdge() && c.geometry?.points?.length);
  const allLocked = cells.length > 0 && cells.every(isLocked);

  const items: ContextMenuEntry[] = cells.length
    ? [
        { label: 'Cut', hint: `${m}X`, onSelect: a.cut, disabled: ro },
        { label: 'Copy', hint: `${m}C`, onSelect: a.copy },
        { label: 'Duplicate', hint: `${m}D`, onSelect: a.duplicate, disabled: ro },
        { label: 'Delete', hint: '⌫', onSelect: a.deleteSelection, disabled: ro },
        'separator',
        ...(single && !ro
          ? [
              { label: 'Edit style…', hint: `${m}E`, onSelect: () => openDialog({ kind: 'style', cellId: single.id! }) },
              { label: 'Edit data…', hint: `${m}M`, onSelect: () => openDialog({ kind: 'data', cellId: single.id! }) },
              'separator' as const,
            ]
          : []),
        ...(!ro
          ? [
              { label: 'Bring to front', onSelect: a.toFront },
              { label: 'Send to back', onSelect: a.toBack },
              ...(cells.length > 1 ? [{ label: 'Group', hint: `${m}G`, onSelect: a.group }] : []),
              ...(cells.some((c) => c.children.some((ch) => ch.isVertex()))
                ? [{ label: 'Ungroup', hint: `${m}⇧G`, onSelect: a.ungroup }]
                : []),
              'separator' as const,
              ...(vertices.length
                ? [
                    { label: 'Rotate 90°', hint: `${m}R`, onSelect: a.rotate90 },
                    { label: 'Flip horizontally', onSelect: () => a.flip('flipH') },
                    { label: 'Flip vertically', onSelect: () => a.flip('flipV') },
                  ]
                : []),
              { label: allLocked ? 'Unlock' : 'Lock', hint: `${m}L`, onSelect: a.toggleLock },
              ...(edgesWithPoints ? [{ label: 'Clear waypoints', onSelect: a.clearWaypoints }] : []),
            ]
          : []),
      ]
    : [
        { label: 'Paste', hint: `${m}V`, onSelect: a.paste, disabled: ro || !lastCopied() },
        'separator',
        { label: 'Select all', hint: `${m}A`, onSelect: a.selectAll },
        { label: 'Select shapes', hint: `${m}⇧I`, onSelect: a.selectVertices },
        { label: 'Select connectors', hint: `${m}⇧E`, onSelect: a.selectEdges },
        'separator',
        { label: 'Insert image…', onSelect: () => openDialog({ kind: 'image' }), disabled: ro },
        { label: 'Find…', hint: `${m}F`, onSelect: () => openDialog({ kind: 'find' }) },
        { label: 'Layers', hint: `${m}⇧L`, onSelect: () => setLayersOpen(true) },
      ];

  return <ContextMenu x={at.x} y={at.y} items={items} onClose={() => setAt(null)} />;
}
