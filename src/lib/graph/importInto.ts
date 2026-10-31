import type * as Y from 'yjs';
import type { Graph } from '@maxgraph/core';
import { generateKeyBetween } from 'fractional-indexing';
import { insertCopies } from '@/lib/collab/cellEdits';
import type { YGraphBinding } from '@/lib/collab/yGraphBinding';
import { newId } from '@/lib/drawio/codec';
import type { CellData, FileData } from '@/lib/drawio/types';
import { pageToY, pagesOf, sortedPageIds } from '@/lib/drawio/ydoc';

/** A page's content without its root and layers (layer children become top-level). */
export function pageContent(cells: CellData[]): CellData[] {
  const root = cells.find((c) => !c.parent);
  const layers = new Set(cells.filter((c) => c.parent === root?.id).map((c) => c.id));
  return cells
    .filter((c) => c !== root && !layers.has(c.id))
    .map((c) => (c.parent && layers.has(c.parent) ? { ...c, parent: undefined } : c));
}

/**
 * Adds imported diagram data to the open document: the first page's shapes
 * are placed in the middle of the current view (as one undoable step), and
 * any further pages are added as new pages. Returns how many pages were added.
 */
export function importIntoDiagram(doc: Y.Doc, graph: Graph, binding: YGraphBinding, file: FileData): number {
  const [first, ...rest] = file.pages;
  const content = first ? pageContent(first.cells) : [];
  if (content.length) {
    const top = content.filter((c) => !c.parent && c.vertex && c.geometry);
    const minX = Math.min(...top.map((c) => c.geometry!.x ?? 0));
    const minY = Math.min(...top.map((c) => c.geometry!.y ?? 0));
    const maxX = Math.max(...top.map((c) => (c.geometry!.x ?? 0) + (c.geometry!.width ?? 0)));
    const maxY = Math.max(...top.map((c) => (c.geometry!.y ?? 0) + (c.geometry!.height ?? 0)));
    const { scale, translate } = graph.view;
    const cx = graph.container.clientWidth / 2 / scale - translate.x;
    const cy = graph.container.clientHeight / 2 / scale - translate.y;
    const grid = graph.gridSize || 10;
    let dx = top.length ? Math.round((cx - (minX + maxX) / 2) / grid) * grid : 0;
    let dy = top.length ? Math.round((cy - (minY + maxY) / 2) / grid) * grid : 0;
    // Don't drop the import on top of what's already there: put it to the right instead.
    const b = graph.getGraphBounds();
    if (top.length && b.width && b.height) {
      const ex = b.x / scale - translate.x;
      const ey = b.y / scale - translate.y;
      const overlaps =
        minX + dx < ex + b.width / scale && maxX + dx > ex && minY + dy < ey + b.height / scale && maxY + dy > ey;
      if (overlaps) {
        dx = Math.round((ex + b.width / scale + 60 - minX) / grid) * grid;
        dy = Math.round((ey - minY) / grid) * grid;
      }
    }
    const ids = insertCopies(binding, content, graph.getDefaultParent().id!, dx, dy);
    graph.setSelectionCells(ids.flatMap((id) => graph.getDataModel().getCell(id) ?? []));
  }
  if (rest.length) {
    const pages = pagesOf(doc);
    let last = (pages.get(sortedPageIds(doc).at(-1)!)?.get('order') as string | undefined) ?? null;
    doc.transact(() => {
      for (const p of rest) {
        last = generateKeyBetween(last, null);
        const id = newId();
        pages.set(id, pageToY({ ...p, id, order: last }));
      }
    });
  }
  return rest.length;
}
