'use client';

import { useEffect, useRef, useState } from 'react';
import { Map as MapIcon, X } from 'lucide-react';
import { Outline } from '@maxgraph/core';
import { useEditor } from './hooks';

const STORAGE_KEY = 'upgraded-drawio:minimap';

function readOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** draw.io's outline window: an overview of the page; drag the frame to pan. */
export function Minimap() {
  const { canvas } = useEditor();
  const [open, setOpen] = useState(readOpen);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
    } catch {
      // Remembering the toggle is only a convenience.
    }
  }, [open]);

  useEffect(() => {
    if (!open || !canvas || !ref.current) return;
    const outline = new Outline(canvas.graph, ref.current);
    return () => outline.destroy();
  }, [open, canvas]);

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Show minimap"
        title="Show minimap"
        onClick={() => setOpen(true)}
        className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-md border border-border bg-panel text-muted shadow-sm hover:text-text"
      >
        <MapIcon size={15} />
      </button>
    );
  }
  return (
    <div className="absolute bottom-3 right-3 w-52 overflow-hidden rounded-lg border border-border bg-panel shadow-lg" data-testid="minimap">
      <div className="flex h-7 items-center justify-between border-b border-border pl-2.5 pr-1 text-[12px] text-muted">
        Overview
        <button type="button" aria-label="Hide minimap" onClick={() => setOpen(false)} className="rounded p-1 hover:bg-panel-2">
          <X size={12} />
        </button>
      </div>
      <div ref={ref} className="h-36 w-full overflow-hidden bg-[var(--canvas)]" />
    </div>
  );
}
