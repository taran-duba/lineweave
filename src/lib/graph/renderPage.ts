import * as Y from 'yjs';
import type { Graph } from '@maxgraph/core';
import { YGraphBinding } from '@/lib/collab/yGraphBinding';
import type { FileData } from '@/lib/drawio/types';
import { loadFileIntoDoc, pagesOf, sortedPageIds, type YPage } from '@/lib/drawio/ydoc';
import { createGraph } from './createGraph';

/**
 * Renders a page into a hidden, off-screen graph (for PDF, print, previews of
 * other pages or old revisions). The callback gets a fully laid-out graph;
 * everything is torn down afterwards.
 */
export async function withPageGraph<T>(page: YPage, fn: (graph: Graph) => T | Promise<T>): Promise<T> {
  const host = document.createElement('div');
  // In the DOM (text measuring needs layout) but out of sight.
  Object.assign(host.style, { position: 'fixed', left: '-100000px', top: '0', width: '1200px', height: '900px', overflow: 'hidden' });
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);
  const { graph, destroy } = createGraph(host);
  const binding = new YGraphBinding(graph.getDataModel(), page);
  try {
    return await fn(graph);
  } finally {
    binding.destroy();
    destroy();
    host.remove();
  }
}

/** Runs `fn` for every page of a document, in tab order. */
export async function mapPages<T>(doc: Y.Doc, fn: (graph: Graph, page: YPage) => T | Promise<T>): Promise<T[]> {
  const out: T[] = [];
  for (const id of sortedPageIds(doc)) {
    const page = pagesOf(doc).get(id)!;
    out.push(await withPageGraph(page, (g) => fn(g, page)));
  }
  return out;
}

/** A throwaway Y.Doc for plain file data (an old revision, an import preview). */
export function docFromFile(file: FileData): Y.Doc {
  const doc = new Y.Doc();
  loadFileIntoDoc(doc, file);
  return doc;
}
