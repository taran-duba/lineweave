'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Plus, Search } from 'lucide-react';
import clsx from 'clsx';
import { Graph, Point, type Cell } from '@maxgraph/core';
import { getStyleValue, toCellStyle } from '@/lib/drawio/style';
import { DEFAULT_LIBRARIES, PALETTES, type PaletteItem } from '@/lib/graph/palette';
import { installDarkCanvas } from '@/lib/graph/darkCanvas';
import { applyDrawioStylesheet, registerDrawioShapes } from '@/lib/graph/shapes';
import { PALETTE_MIME } from './Canvas';
import { useEditor } from './hooks';

const BOX = 40;

/** Renders one palette item with a tiny read-only maxGraph so previews match the canvas exactly. */
function ShapePreview({ item }: { item: PaletteItem }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    registerDrawioShapes();
    const graph = new Graph(el, undefined, []);
    applyDrawioStylesheet(graph.getStylesheet());
    graph.setHtmlLabels(true);
    graph.setEnabled(false);
    // Previews sit on the dark sidebar, so they get the same display-only swap as the canvas.
    const uninstall = installDarkCanvas(graph);
    const w = item.width || 1;
    const h = item.edge ? w : item.height;
    const scale = Math.min((BOX - 4) / w, (BOX - 4) / h, 1);
    // Only text-only shapes show their label; other previews are pure geometry.
    const isText = item.style.startsWith('text;');
    const style = { ...toCellStyle(item.style), fontSize: isText ? 22 : 0 } as Cell['style'];
    graph.batchUpdate(() => {
      const parent = graph.getDefaultParent();
      if (item.edge) {
        const e = graph.insertEdge({ parent, value: '', style });
        e.geometry!.sourcePoint = new Point(0, h);
        e.geometry!.targetPoint = new Point(w, 0);
      } else {
        graph.insertVertex({ parent, value: isText ? 'Text' : '', position: [0, 0], size: [w, h], style });
      }
    });
    graph.view.scaleAndTranslate(scale, (BOX / scale - w) / 2, (BOX / scale - h) / 2);
    return () => {
      uninstall();
      graph.destroy();
    };
  }, [item]);
  return <div ref={ref} className="pointer-events-none h-10 w-10 overflow-hidden" />;
}

const LIBS_KEY = 'upgraded-drawio:libraries';

function readLibraries(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(LIBS_KEY) ?? 'null') as unknown;
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && PALETTES.some((p) => p.id === x));
  } catch {
    // Falls back to the defaults.
  }
  return DEFAULT_LIBRARIES;
}

export function ShapeLibrary() {
  const { canvas, session } = useEditor();
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [enabled, setEnabled] = useState<string[]>(readLibraries);
  const [picking, setPicking] = useState(false);
  const toggleLibrary = (id: string) =>
    setEnabled((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      try {
        localStorage.setItem(LIBS_KEY, JSON.stringify(next));
      } catch {
        // Remembering the choice is only a convenience.
      }
      return next;
    });
  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Searching looks through every library, not just the ones shown.
    if (q) {
      const matches = (i: PaletteItem) => `${i.title} ${i.tags ?? ''}`.toLowerCase().includes(q);
      return PALETTES.map((s) => ({ ...s, items: s.items.filter(matches) })).filter((s) => s.items.length);
    }
    return PALETTES.filter((s) => enabled.includes(s.id));
  }, [query, enabled]);
  const disabled = session.readOnly;

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-panel" aria-label="Shapes">
      <div className="border-b border-border p-2">
        <label className="flex h-8 items-center gap-2 rounded-md border border-border bg-bg px-2 text-sm focus-within:border-accent">
          <Search size={14} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shapes"
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {sections.map((section) => {
          const open = query ? true : !collapsed[section.id];
          return (
            <div key={section.id} className="border-b border-border">
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [section.id]: open }))}
                className="flex w-full items-center gap-1 px-3 py-2 text-[13px] font-medium hover:bg-panel-2"
              >
                <ChevronRight size={14} className={clsx('text-muted transition-transform', open && 'rotate-90')} />
                {section.title}
              </button>
              {open && (
                <div className={clsx('px-2 pb-2', section.list ? 'flex flex-col' : 'grid grid-cols-4 gap-1')}>
                  {section.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      title={item.title}
                      aria-label={`Insert ${item.title}`}
                      disabled={disabled}
                      draggable={!disabled}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(PALETTE_MIME, item.id);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      onClick={() => canvas?.actions.insert(item)}
                      className={clsx(
                        'flex items-center rounded-md hover:bg-panel-2 disabled:cursor-not-allowed disabled:opacity-40',
                        section.list ? 'h-10 gap-1 text-left text-[13px]' : 'h-12 justify-center',
                      )}
                    >
                      {section.list ? (
                        <>
                          {getStyleValue(item.style, 'fillColor')?.startsWith('#') ? (
                            <span
                              className="mx-1.5 h-5 w-7 shrink-0 rounded-sm border"
                              style={{ background: getStyleValue(item.style, 'fillColor'), borderColor: getStyleValue(item.style, 'strokeColor') }}
                            />
                          ) : (
                            <ShapePreview item={item} />
                          )}
                          <span className="min-w-0 truncate">{item.title}</span>
                        </>
                      ) : (
                        <ShapePreview item={item} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {!query && (
          <div className="p-2">
            <button
              type="button"
              onClick={() => setPicking((p) => !p)}
              className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-[13px] text-muted hover:bg-panel-2 hover:text-text"
              aria-expanded={picking}
            >
              <Plus size={14} /> More shapes
            </button>
            {picking && (
              <ul className="mt-2 flex flex-col gap-0.5" aria-label="Shape libraries">
                {PALETTES.map((p) => (
                  <li key={p.id}>
                    <label className="flex items-center gap-2 rounded px-2 py-1 text-[13px] hover:bg-panel-2">
                      <input type="checkbox" checked={enabled.includes(p.id)} onChange={() => toggleLibrary(p.id)} className="accent-[var(--accent)]" />
                      {p.title}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
