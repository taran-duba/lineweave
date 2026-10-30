import type * as Y from 'yjs';
import { generateKeyBetween } from 'fractional-indexing';
import { emptyPage } from './codec';
import { pageToY, pagesOf, sortedPageIds } from './ydoc';

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
