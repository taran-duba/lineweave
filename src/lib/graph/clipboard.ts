import type { Cell, Graph } from '@maxgraph/core';
import { parseDrawio, serializeModel, sortCellsForOutput } from '@/lib/drawio/codec';
import type { CellData } from '@/lib/drawio/types';
import { insertCopies, readCell } from '@/lib/collab/cellEdits';
import type { YGraphBinding } from '@/lib/collab/yGraphBinding';
import { pageContent } from './importInto';

/**
 * Copy/paste as draw.io XML (a bare <mxGraphModel>), the same format
 * diagrams.net uses, so shapes paste between tabs, users and diagrams.net.
 * Copies are made from the Y.Doc, so unknown styles and custom data survive.
 */

const STEP = 10;

/** Selected cells plus their children, and connectors between copied shapes. */
export function selectionCells(graph: Graph, binding: YGraphBinding): CellData[] {
  const chosen = new Set<Cell>();
  const add = (c: Cell) => {
    chosen.add(c);
    c.children.forEach(add);
  };
  graph.getSelectionCells().forEach(add);
  for (const c of [...chosen]) {
    for (const e of c.edges) {
      if (e.source && e.target && chosen.has(e.source) && chosen.has(e.target)) chosen.add(e);
    }
  }
  const view = graph.view;
  const out: CellData[] = [];
  for (const c of chosen) {
    const data = c.id ? readCell(binding, c.id) : null;
    if (!data) continue;
    // A copied connector whose end isn't copied keeps its current end point instead.
    if (c.isEdge()) {
      const pts = view.getState(c)?.absolutePoints;
      const toModel = (p: { x: number; y: number } | null | undefined) =>
        p ? { x: Math.round(p.x / view.scale - view.translate.x), y: Math.round(p.y / view.scale - view.translate.y) } : undefined;
      const geometry = { ...data.geometry };
      if (data.source && !(c.source && chosen.has(c.source))) {
        delete data.source;
        geometry.sourcePoint = toModel(pts?.[0]);
      }
      if (data.target && !(c.target && chosen.has(c.target))) {
        delete data.target;
        geometry.targetPoint = toModel(pts?.at(-1));
      }
      data.geometry = geometry;
    }
    out.push(data);
  }
  return sortCellsForOutput(out.map((c) => (c.parent && out.some((o) => o.id === c.parent) ? c : { ...c, parent: undefined })));
}

export function selectionToXml(graph: Graph, binding: YGraphBinding): string | null {
  const cells = selectionCells(graph, binding);
  if (!cells.length) return null;
  return serializeModel([{ id: '0', order: 'a0' }, { id: '1', parent: '0', order: 'a0' }, ...cells.map((c) => ({ ...c, parent: c.parent ?? '1' }))]);
}

/** Parses clipboard text from this app or diagrams.net; null if it isn't a diagram. */
export function cellsFromText(text: string): CellData[] | null {
  let t = text.trim();
  if (t.startsWith('%3C')) {
    try {
      t = decodeURIComponent(t);
    } catch {
      return null;
    }
  }
  if (!t.startsWith('<mxGraphModel') && !t.startsWith('<mxfile')) return null;
  try {
    const cells = pageContent(parseDrawio(t).pages[0].cells);
    const ids = new Set(cells.map((c) => c.id));
    // Anything whose parent didn't come along becomes top-level too.
    return cells.map((c) => (c.parent && !ids.has(c.parent) ? { ...c, parent: undefined } : c));
  } catch {
    return null;
  }
}

let pasteCount = 0;
let lastXml: string | null = null;

/** Remembers what we copied, for menu-driven paste (no clipboard permission needed). */
export function rememberCopy(xml: string): void {
  lastXml = xml;
  pasteCount = 0;
}

export function lastCopied(): string | null {
  return lastXml;
}

/** Pastes cells into the current layer, offset a little more each time. Returns the pasted cells. */
export function pasteCells(graph: Graph, binding: YGraphBinding, cells: CellData[], fromSameCopy: boolean): Cell[] {
  pasteCount = fromSameCopy ? pasteCount + 1 : 1;
  const parent = graph.getDefaultParent();
  const ids = insertCopies(binding, cells, parent.id!, STEP * pasteCount, STEP * pasteCount);
  const model = graph.getDataModel();
  const pasted = ids.flatMap((id) => model.getCell(id) ?? []);
  graph.setSelectionCells(pasted);
  return pasted;
}
