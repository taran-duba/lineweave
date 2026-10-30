import type { Graph } from '@maxgraph/core';
import type { Attrs } from '@/lib/drawio/types';

/** draw.io's paper sizes, in its 100-units-per-inch coordinate space (portrait). */
export const PAPER_SIZES = [
  { id: 'letter', label: 'US Letter', width: 850, height: 1100 },
  { id: 'legal', label: 'US Legal', width: 850, height: 1400 },
  { id: 'tabloid', label: 'Tabloid', width: 1100, height: 1700 },
  { id: 'a3', label: 'A3', width: 1169, height: 1654 },
  { id: 'a4', label: 'A4', width: 827, height: 1169 },
  { id: 'a5', label: 'A5', width: 583, height: 827 },
] as const;

export interface PageSettings {
  /** Page view on: content sits on paper-sized pages over a gutter. */
  visible: boolean;
  width: number;
  height: number;
  /** Custom background color, or null for the default canvas color. */
  background: string | null;
}

/** White (draw.io's usual explicit value) counts as default so dark mode stays dark. */
export function customBackground(value: string | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  return ['none', '#ffffff', '#fff', 'white', 'default'].includes(v) ? null : value;
}

export function readPageSettings(attrs: Attrs | undefined): PageSettings {
  const a = attrs ?? {};
  const scale = Number(a.pageScale) || 1;
  return {
    // draw.io shows the page unless page="0".
    visible: a.page !== '0',
    width: (Number(a.pageWidth) || 850) * scale,
    height: (Number(a.pageHeight) || 1100) * scale,
    background: customBackground(a.background),
  };
}

export function paperSizeId(s: PageSettings): string {
  const w = Math.min(s.width, s.height);
  const h = Math.max(s.width, s.height);
  return PAPER_SIZES.find((p) => p.width === w && p.height === h)?.id ?? 'custom';
}

/** The block of pages (in model coordinates) that covers all content, at least one page. */
export function pageBlock(graph: Graph, s: PageSettings): { x: number; y: number; cols: number; rows: number } {
  const view = graph.view;
  const b = graph.getGraphBounds();
  if (!b.width || !b.height) return { x: 0, y: 0, cols: 1, rows: 1 };
  const minX = b.x / view.scale - view.translate.x;
  const minY = b.y / view.scale - view.translate.y;
  const maxX = minX + b.width / view.scale;
  const maxY = minY + b.height / view.scale;
  const c0 = Math.floor(minX / s.width);
  const r0 = Math.floor(minY / s.height);
  const c1 = Math.max(c0 + 1, Math.ceil(maxX / s.width));
  const r1 = Math.max(r0 + 1, Math.ceil(maxY / s.height));
  return { x: c0 * s.width, y: r0 * s.height, cols: c1 - c0, rows: r1 - r0 };
}
