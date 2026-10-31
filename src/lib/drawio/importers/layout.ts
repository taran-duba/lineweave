import { generateNKeysBetween } from 'fractional-indexing';
import { emptyPage } from '@/lib/drawio/codec';
import type { CellData, FileData } from '@/lib/drawio/types';
import { pageFromY, pagesOf, sortedPageIds } from '@/lib/drawio/ydoc';
import { applyLayout, type LayoutId } from '@/lib/graph/layouts';
import { docFromFile, withPageGraph } from '@/lib/graph/renderPage';

/**
 * Lays out generated cells (from CSV or Mermaid, which carry no positions)
 * with the same automatic layouts the editor offers, using a hidden graph.
 * Cells must be top-level children of layer "1".
 */
export async function layoutCells(cells: CellData[], layout: LayoutId | 'grid'): Promise<FileData> {
  // Valid fractional-index sibling keys, in the given order.
  const keys = generateNKeysBetween(null, null, cells.length);
  cells.forEach((c, i) => (c.order = keys[i]));
  const page = emptyPage('Page-1');
  page.cells.push(...cells);
  const file: FileData = { attrs: {}, pages: [page] };
  if (layout === 'grid') {
    const COLS = Math.ceil(Math.sqrt(cells.filter((c) => c.vertex).length));
    let i = 0;
    for (const c of cells) {
      if (!c.vertex || !c.geometry) continue;
      c.geometry.x = 40 + (i % COLS) * ((c.geometry.width ?? 120) + 40);
      c.geometry.y = 40 + Math.floor(i / COLS) * ((c.geometry.height ?? 60) + 40);
      i++;
    }
    return file;
  }
  const doc = docFromFile(file);
  const yPage = pagesOf(doc).get(sortedPageIds(doc)[0])!;
  await withPageGraph(yPage, (graph) => applyLayout(graph, layout));
  const laidOut = pageFromY(sortedPageIds(doc)[0], yPage);
  doc.destroy();
  return { attrs: {}, pages: [{ ...page, cells: laidOut.cells }] };
}

/** A rough label size, so generated shapes fit their text. */
export function textSize(text: string, min = { width: 80, height: 40 }): { width: number; height: number } {
  const lines = text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').split('\n');
  const longest = Math.max(...lines.map((l) => l.length));
  return {
    width: Math.max(min.width, Math.ceil(longest * 7.2 + 24)),
    height: Math.max(min.height, lines.length * 16 + 20),
  };
}
