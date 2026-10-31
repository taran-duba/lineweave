import type * as Y from 'yjs';
import { generateKeyBetween } from 'fractional-indexing';
import { emptyPage, newId } from './codec';
import { pageFromY, pageToY, pagesOf, sortedPageIds } from './ydoc';

export function addPage(doc: Y.Doc): string {
  const ids = sortedPageIds(doc);
  const pages = pagesOf(doc);
  const lastOrder = ids.length ? (pages.get(ids.at(-1)!)!.get('order') as string) : null;
  const names = new Set(ids.map((id) => pages.get(id)!.get('name')));
  let n = ids.length + 1;
  while (names.has(`Page-${n}`)) n++;
  const page = emptyPage(`Page-${n}`, generateKeyBetween(lastOrder, null));
  doc.transact(() => pages.set(page.id, pageToY(page)));
  return page.id;
}

export function renamePage(doc: Y.Doc, pageId: string, name: string): void {
  const page = pagesOf(doc).get(pageId);
  if (page && name.trim()) page.set('name', name.trim());
}

/** Deletes a page unless it's the last one; returns the id of a neighbor to show next. */
export function deletePage(doc: Y.Doc, pageId: string): string | null {
  const ids = sortedPageIds(doc);
  if (ids.length <= 1) return null;
  const i = ids.indexOf(pageId);
  pagesOf(doc).delete(pageId);
  return ids[i + 1] ?? ids[i - 1] ?? null;
}

function orderOf(doc: Y.Doc, id: string | undefined): string | null {
  return id ? ((pagesOf(doc).get(id)?.get('order') as string | undefined) ?? null) : null;
}

/** Copies a page (cells keep their ids, which only need to be unique per page) right after it. */
export function duplicatePage(doc: Y.Doc, pageId: string): string | null {
  const pages = pagesOf(doc);
  const src = pages.get(pageId);
  if (!src) return null;
  const ids = sortedPageIds(doc);
  const i = ids.indexOf(pageId);
  const copy = pageFromY(pageId, src);
  copy.id = newId();
  copy.name = `${copy.name} (copy)`;
  copy.order = generateKeyBetween(orderOf(doc, pageId), orderOf(doc, ids[i + 1]));
  doc.transact(() => pages.set(copy.id, pageToY(copy)));
  return copy.id;
}

/** Moves a page one place left (-1) or right (+1) in the tabs. */
export function movePage(doc: Y.Doc, pageId: string, dir: -1 | 1): void {
  const ids = sortedPageIds(doc);
  const i = ids.indexOf(pageId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  // Slot between the neighbor we're passing and the one beyond it.
  const [lo, hi] = dir === 1 ? [ids[j], ids[j + 1]] : [ids[j - 1], ids[j]];
  pagesOf(doc).get(pageId)!.set('order', generateKeyBetween(orderOf(doc, lo), orderOf(doc, hi)));
}
