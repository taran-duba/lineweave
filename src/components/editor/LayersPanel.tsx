'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, LockOpen, MoveRight, Plus, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import { Cell, type Graph } from '@maxgraph/core';
import { IconButton } from '@/components/ui';
import { isLocked } from '@/lib/graph/arrange';
import { useEditor, useGraphVersion } from './hooks';

function layersOf(graph: Graph): Cell[] {
  return graph.getDataModel().root?.children ?? [];
}

/** The layer new shapes go into; falls back if the chosen one was deleted (maybe by someone else). */
function activeLayer(graph: Graph): Cell {
  const model = graph.getDataModel();
  const current = graph.getDefaultParent();
  if (current.parent !== model.root || !model.contains(current)) graph.setDefaultParent(null);
  return graph.getDefaultParent();
}

/**
 * draw.io's Layers window. Layers are the root's children, so they're synced
 * and saved like everything else; which one is active is per person.
 */
export function LayersPanel({ onClose }: { onClose(): void }) {
  const { canvas, session } = useEditor();
  useGraphVersion(canvas);
  const [editing, setEditing] = useState<string | null>(null);
  if (!canvas) return null;
  const { graph } = canvas;
  const model = graph.getDataModel();
  const root = model.root!;
  const layers = layersOf(graph);
  const active = activeLayer(graph);
  const ro = session.readOnly;
  const selection = graph.getSelectionCells().filter((c) => c.parent?.parent === root);

  const add = () => {
    const names = new Set(layers.map((l) => String(l.value ?? '')));
    let n = layers.length;
    while (names.has(`Layer ${n}`)) n++;
    const layer = new Cell(`Layer ${n}`);
    model.add(root, layer);
    graph.setDefaultParent(layer);
  };
  const remove = (layer: Cell) => {
    if (layers.length < 2) return;
    const count = layer.children.length;
    if (count && !confirm(`Delete "${layer.value || 'Background'}" and its ${count} item${count === 1 ? '' : 's'} for everyone?`)) return;
    if (layer === active) graph.setDefaultParent(null);
    graph.removeCells([layer], true);
  };
  const move = (layer: Cell, dir: 1 | -1) => {
    const i = layers.indexOf(layer);
    const j = i + dir;
    if (j >= 0 && j < layers.length) model.add(root, layer, j);
  };

  return (
    <div
      role="dialog"
      aria-label="Layers"
      className="absolute right-3 top-3 z-30 w-64 overflow-hidden rounded-lg border border-border bg-panel shadow-xl"
      data-testid="layers-panel"
    >
      <div className="flex h-9 items-center justify-between border-b border-border pl-3 pr-1">
        <span className="text-[13px] font-semibold">Layers</span>
        <div className="flex items-center">
          {!ro && (
            <IconButton label="Add layer" onClick={add}>
              <Plus size={14} />
            </IconButton>
          )}
          <IconButton label="Close layers" onClick={onClose}>
            <X size={14} />
          </IconButton>
        </div>
      </div>
      <ul className="max-h-72 overflow-y-auto py-1">
        {/* Top-most layer first, as in draw.io. */}
        {[...layers].reverse().map((layer) => {
          const name = String(layer.value || 'Background');
          const locked = isLocked(layer);
          return (
            <li
              key={layer.id}
              className={clsx('group flex items-center gap-0.5 px-1.5 py-0.5', layer === active && 'bg-accent-soft')}
              onClick={() => graph.setDefaultParent(layer)}
            >
              <IconButton label={layer.visible ? `Hide ${name}` : `Show ${name}`} disabled={ro} onClick={(e) => {
                e.stopPropagation();
                model.setVisible(layer, !layer.visible);
              }}>
                {layer.visible ? <Eye size={14} /> : <EyeOff size={14} className="text-muted" />}
              </IconButton>
              <IconButton label={locked ? `Unlock ${name}` : `Lock ${name}`} disabled={ro} onClick={(e) => {
                e.stopPropagation();
                graph.setCellStyles('locked' as never, (locked ? undefined : 1) as never, [layer]);
              }}>
                {locked ? <Lock size={14} /> : <LockOpen size={14} className="text-muted" />}
              </IconButton>
              {editing === layer.id ? (
                <input
                  autoFocus
                  defaultValue={name}
                  className="h-7 min-w-0 flex-1 rounded border border-accent bg-bg px-1.5 text-[13px] outline-none"
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    if (e.target.value.trim()) model.setValue(layer, e.target.value.trim());
                    setEditing(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') setEditing(null);
                  }}
                />
              ) : (
                <span
                  className={clsx('min-w-0 flex-1 truncate px-1 text-[13px]', !layer.visible && 'text-muted')}
                  title={ro ? name : `${name} (double-click to rename)`}
                  onDoubleClick={() => !ro && setEditing(layer.id)}
                >
                  {name}
                  <span className="ml-1 text-[11px] text-muted">{layer.children.length}</span>
                </span>
              )}
              {!ro && (
                <span className="hidden items-center group-hover:flex">
                  <IconButton label={`Move ${name} up`} onClick={(e) => (e.stopPropagation(), move(layer, 1))}>
                    <ArrowUp size={13} />
                  </IconButton>
                  <IconButton label={`Move ${name} down`} onClick={(e) => (e.stopPropagation(), move(layer, -1))}>
                    <ArrowDown size={13} />
                  </IconButton>
                  {layers.length > 1 && (
                    <IconButton label={`Delete ${name}`} onClick={(e) => (e.stopPropagation(), remove(layer))}>
                      <Trash2 size={13} />
                    </IconButton>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {!ro && selection.length > 0 && (
        <button
          type="button"
          className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-[13px] hover:bg-panel-2"
          onClick={() => graph.moveCells(selection, 0, 0, false, active)}
        >
          <MoveRight size={14} /> Move selection to “{String(active.value || 'Background')}”
        </button>
      )}
    </div>
  );
}
