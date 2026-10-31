import { InternalEvent, type Cell, type EventObject, type EventSource, type Graph, type TooltipHandler } from '@maxgraph/core';
import type { Attrs } from '@/lib/drawio/types';
import type { YGraphBinding } from '@/lib/collab/yGraphBinding';

/** Custom data draw.io keeps on a cell's <object> wrapper (tooltip, link, ...). */
export function objAttrsOf(binding: YGraphBinding, cell: Cell | null | undefined): Attrs {
  if (!cell?.id) return {};
  return (binding.cells.get(cell.id)?.get('objAttrs') as Attrs | undefined) ?? {};
}

/** Only web and mail links open; anything else (javascript:, data:, ...) is ignored. */
export function safeLink(link: string | undefined): string | null {
  if (!link) return null;
  try {
    const url = new URL(link);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Shows a cell's `tooltip` on hover (and its link, if any), and opens its
 * `link` on Cmd/Ctrl+click, like draw.io.
 */
export function installTooltipsAndLinks(graph: Graph, binding: YGraphBinding): () => void {
  graph.setTooltips(true);
  const tooltips = graph.getPlugin<TooltipHandler>('TooltipHandler');
  if (tooltips) {
    // Only cells with a tooltip or link get one (maxGraph defaults to showing the label).
    tooltips.getTooltipForCell = (cell: Cell) => {
      const attrs = objAttrsOf(binding, cell);
      const link = safeLink(attrs.link);
      return [attrs.tooltip, link && `${link}\n(⌘/Ctrl+click to open)`].filter(Boolean).join('\n\n');
    };
  }
  const onClick = (_: EventSource, evt: EventObject) => {
    const e = evt.getProperty('event') as MouseEvent | undefined;
    const cell = evt.getProperty('cell') as Cell | undefined;
    if (!e || !cell || !(e.metaKey || e.ctrlKey)) return;
    const link = safeLink(objAttrsOf(binding, cell).link);
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
      evt.consume();
    }
  };
  graph.addListener(InternalEvent.CLICK, onClick);
  return () => graph.removeListener(onClick);
}
