'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import type { Cell, Graph } from '@maxgraph/core';
import { Button, IconButton } from '@/components/ui';
import type { CanvasHandle } from '../hooks';

const stripTags = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Replaces text outside of HTML tags, so formatted labels keep their markup. */
function replaceInLabel(value: string, re: RegExp, replacement: string): string {
  return value
    .split(/(<[^>]*>)/)
    .map((part) => (part.startsWith('<') ? part : part.replace(re, replacement)))
    .join('');
}

function centerOn(graph: Graph, cell: Cell): void {
  const state = graph.view.getState(cell);
  if (!state) return;
  const { scale, translate } = graph.view;
  const c = graph.container;
  const cx = state.getCenterX() / scale - translate.x;
  const cy = state.getCenterY() / scale - translate.y;
  graph.view.setTranslate(c.clientWidth / 2 / scale - cx, c.clientHeight / 2 / scale - cy);
}

/** Find & replace in shape and connector labels on the current page. */
export function FindPanel({ canvas, readOnly, onClose }: { canvas: CanvasHandle; readOnly: boolean; onClose(): void }) {
  const { graph } = canvas;
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [index, setIndex] = useState(-1);
  const [version, setVersion] = useState(0);

  const re = useMemo(() => (query ? new RegExp(escapeRe(query), matchCase ? 'g' : 'gi') : null), [query, matchCase]);
  const matches = useMemo(() => {
    void version;
    if (!re) return [];
    const out: Cell[] = [];
    const visit = (c: Cell) => {
      if ((c.isVertex() || c.isEdge()) && typeof c.value === 'string' && stripTags(c.value).match(new RegExp(re.source, re.flags))) out.push(c);
      c.children.forEach(visit);
    };
    visit(graph.getDataModel().root!);
    return out;
  }, [graph, re, version]);

  const go = (dir: 1 | -1) => {
    if (!matches.length) return;
    const next = (index + dir + matches.length) % matches.length;
    setIndex(next);
    graph.setSelectionCell(matches[next]);
    centerOn(graph, matches[next]);
  };

  const replace = (all: boolean) => {
    if (!re || readOnly) return;
    const targets = all ? matches : matches[index] ? [matches[index]] : [];
    const model = graph.getDataModel();
    graph.batchUpdate(() => {
      for (const c of targets) model.setValue(c, replaceInLabel(String(c.value), new RegExp(re.source, re.flags), replacement));
    });
    setVersion((v) => v + 1);
    if (!all) go(1);
  };

  const field = 'h-8 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 text-[13px] outline-none focus:border-accent';
  return (
    <div
      role="dialog"
      aria-label="Find and replace"
      className="absolute right-3 top-3 z-40 w-80 rounded-lg border border-border bg-panel p-3 shadow-xl"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-semibold">Find</span>
        <IconButton label="Close find" onClick={onClose}>
          <X size={14} />
        </IconButton>
      </div>
      <div className="flex items-center gap-1">
        <input
          autoFocus
          aria-label="Find"
          placeholder="Find in labels"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(-1);
          }}
          onKeyDown={(e) => e.key === 'Enter' && go(e.shiftKey ? -1 : 1)}
          className={field}
        />
        <IconButton label="Previous match" disabled={!matches.length} onClick={() => go(-1)}>
          <ChevronUp size={15} />
        </IconButton>
        <IconButton label="Next match" disabled={!matches.length} onClick={() => go(1)}>
          <ChevronDown size={15} />
        </IconButton>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[12px] text-muted">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} className="accent-[var(--accent)]" />
          Match case
        </label>
        <span aria-live="polite">{query ? `${matches.length ? index + 1 || 0 : 0} of ${matches.length}` : ''}</span>
      </div>
      {!readOnly && (
        <>
          <input
            aria-label="Replace with"
            placeholder="Replace with"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            className={`${field} mt-2 w-full`}
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button disabled={index < 0 || !matches.length} onClick={() => replace(false)}>
              Replace
            </Button>
            <Button disabled={!matches.length} onClick={() => replace(true)}>
              Replace all
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
