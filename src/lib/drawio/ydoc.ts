import * as Y from 'yjs';
import type { CellData, FileData, PageData } from './types';

/**
 * The Y.Doc is the canonical, collaborative model of a .drawio file:
 *
 *   doc.getMap('file')  : { attrs }
 *   doc.getMap('pages') : pageId -> Y.Map { name, order, attrs, modelAttrs, cells }
 *   cells               : cellId -> Y.Map<CellData fields>
 *
 * Each cell field is its own map entry so concurrent edits to different
 * properties of the same cell (e.g. one user moves it, another recolors it)
 * merge cleanly.
 */

export type YCell = Y.Map<unknown>;
export type YCells = Y.Map<YCell>;
export type YPage = Y.Map<unknown>;

const CELL_FIELDS: (keyof CellData)[] = [
  'parent', 'value', 'style', 'vertex', 'edge', 'source', 'target',
  'geometry', 'order', 'objTag', 'objAttrs', 'attrs', 'extraChildren',
];

export const pagesOf = (doc: Y.Doc) => doc.getMap<YPage>('pages');
export const fileMetaOf = (doc: Y.Doc) => doc.getMap<unknown>('file');
export const cellsOf = (page: YPage) => page.get('cells') as YCells;

export function cellToY(cell: CellData): YCell {
  // Not yet part of a document, so only write (Yjs warns on reading prelim types).
  const m = new Y.Map<unknown>();
  for (const f of CELL_FIELDS) if (cell[f] !== undefined) m.set(f, cell[f]);
  return m;
}

/** Writes only fields whose value actually changed (deep compare for objects). */
export function writeCellFields(m: YCell, cell: Partial<CellData>): void {
  for (const f of CELL_FIELDS) {
    if (!(f in cell)) continue;
    const v = cell[f];
    if (v === undefined) {
      if (m.has(f)) m.delete(f);
    } else if (!sameValue(m.get(f), v)) {
      m.set(f, v);
    }
  }
}

export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function cellFromY(id: string, m: YCell): CellData {
  const c = { id } as CellData;
  for (const f of CELL_FIELDS) {
    const v = m.get(f);
    if (v !== undefined) (c as unknown as Record<string, unknown>)[f] = v;
  }
  c.order ??= 'a0';
  return c;
}

export function pageToY(page: PageData): YPage {
  const p = new Y.Map<unknown>();
  p.set('name', page.name);
  p.set('order', page.order);
  p.set('attrs', page.attrs);
  p.set('modelAttrs', page.modelAttrs);
  const cells: YCells = new Y.Map();
  for (const c of page.cells) cells.set(c.id, cellToY(c));
  p.set('cells', cells);
  return p;
}

export function pageFromY(id: string, p: YPage): PageData {
  const cells: CellData[] = [];
  cellsOf(p)?.forEach((m, cid) => cells.push(cellFromY(cid, m)));
  return {
    id,
    name: (p.get('name') as string) ?? 'Page',
    order: (p.get('order') as string) ?? 'a0',
    attrs: (p.get('attrs') as PageData['attrs']) ?? {},
    modelAttrs: (p.get('modelAttrs') as PageData['modelAttrs']) ?? {},
    cells,
  };
}

/** Replaces the whole document content with `file` in one transaction. */
export function loadFileIntoDoc(doc: Y.Doc, file: FileData, origin?: unknown): void {
  doc.transact(() => {
    const meta = fileMetaOf(doc);
    meta.set('attrs', file.attrs);
    const pages = pagesOf(doc);
    for (const id of Array.from(pages.keys())) pages.delete(id);
    for (const page of file.pages) pages.set(page.id, pageToY(page));
  }, origin);
}

export function docToFile(doc: Y.Doc): FileData {
  const pages: PageData[] = [];
  pagesOf(doc).forEach((p, id) => pages.push(pageFromY(id, p)));
  pages.sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));
  return { attrs: (fileMetaOf(doc).get('attrs') as FileData['attrs']) ?? {}, pages };
}

export function sortedPageIds(doc: Y.Doc): string[] {
  const entries: [string, string][] = [];
  pagesOf(doc).forEach((p, id) => entries.push([id, (p.get('order') as string) ?? 'a0']));
  return entries.sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[0] < b[0] ? -1 : 1)).map(([id]) => id);
}
