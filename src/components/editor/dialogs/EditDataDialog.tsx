'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog } from '@/components/overlays';
import { Button, IconButton } from '@/components/ui';
import { readCell, updateCell } from '@/lib/collab/cellEdits';
import type { Attrs } from '@/lib/drawio/types';
import type { CanvasHandle } from '../hooks';

/** Attribute names that are valid in XML and not reserved by the format. */
const NAME = /^[A-Za-z_][\w.-]*$/;
const RESERVED = new Set(['id', 'label']);

/**
 * draw.io's Edit Data: custom key/value properties stored on the cell's
 * <object> wrapper. `tooltip` shows on hover; `link` opens on ⌘/Ctrl+click.
 */
export function EditDataDialog({ canvas, cellId, onClose }: { canvas: CanvasHandle; cellId: string; onClose(): void }) {
  const cell = readCell(canvas.binding, cellId);
  const [rows, setRows] = useState<[string, string][]>(() => {
    const attrs = { tooltip: '', link: '', ...(cell?.objAttrs ?? {}) };
    return Object.entries(attrs);
  });
  const [newKey, setNewKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addRow = () => {
    const key = newKey.trim();
    if (!NAME.test(key) || RESERVED.has(key)) return setError(`"${key}" isn't a valid property name.`);
    if (rows.some(([k]) => k === key)) return setError(`"${key}" already exists.`);
    setRows([...rows, [key, '']]);
    setNewKey('');
    setError(null);
  };

  const save = () => {
    const attrs: Attrs = {};
    for (const [k, v] of rows) if (v !== '') attrs[k] = v;
    const has = Object.keys(attrs).length > 0;
    updateCell(canvas.binding, cellId, {
      objTag: has ? (cell?.objTag ?? 'object') : undefined,
      objAttrs: has ? attrs : undefined,
    });
    onClose();
  };

  return (
    <Dialog
      title="Edit data"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            Apply
          </Button>
        </>
      }
    >
      <p className="mb-3 text-[12px] text-muted">
        ID <code className="select-all rounded bg-panel-2 px-1">{cellId}</code>
      </p>
      <div className="flex flex-col gap-2">
        {rows.map(([k, v], i) => (
          <label key={k} className="flex items-center gap-2 text-[13px]">
            <span className="w-24 shrink-0 truncate text-muted" title={k}>
              {k}
            </span>
            <input
              value={v}
              placeholder={k === 'link' ? 'https://…' : k === 'tooltip' ? 'Shown on hover' : ''}
              onChange={(e) => setRows(rows.map((r, j) => (j === i ? [k, e.target.value] : r)))}
              className="h-8 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 outline-none focus:border-accent"
            />
            <IconButton label={`Remove ${k}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
              <Trash2 size={14} />
            </IconButton>
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
        <input
          value={newKey}
          placeholder="New property name"
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addRow()}
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 text-[13px] outline-none focus:border-accent"
        />
        <Button onClick={addRow} disabled={!newKey.trim()}>
          <Plus size={14} /> Add
        </Button>
      </div>
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
    </Dialog>
  );
}
