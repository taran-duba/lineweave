'use client';

import { useState } from 'react';
import { Dialog } from '@/components/overlays';
import { Button } from '@/components/ui';
import { readCell, updateCell } from '@/lib/collab/cellEdits';
import type { CanvasHandle } from '../hooks';

/** draw.io's Edit Style: the raw style string, exactly as saved in the file. */
export function EditStyleDialog({ canvas, cellId, onClose }: { canvas: CanvasHandle; cellId: string; onClose(): void }) {
  // One key per line while editing; joined back into a single string on apply.
  const [value, setValue] = useState(() => (readCell(canvas.binding, cellId)?.style ?? '').replace(/;(?=.)/g, ';\n'));
  const apply = () => {
    const style = value.replace(/\s*\n\s*/g, '').trim();
    updateCell(canvas.binding, cellId, { style: style || undefined });
    onClose();
  };
  return (
    <Dialog
      title="Edit style"
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={apply}>
            Apply
          </Button>
        </>
      }
    >
      <p className="mb-2 text-[12px] text-muted">
        Semicolon-separated <code>key=value</code> pairs, the same as in draw.io. Unknown keys are kept.
      </p>
      <textarea
        aria-label="Style"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) apply();
        }}
        spellCheck={false}
        rows={12}
        className="w-full resize-y rounded-md border border-border bg-bg p-2 font-mono text-[12px] leading-relaxed outline-none focus:border-accent"
      />
    </Dialog>
  );
}
