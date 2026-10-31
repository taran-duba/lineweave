import type * as Y from 'yjs';
import type { Attrs } from '@/lib/drawio/types';
import type { YPage } from '@/lib/drawio/ydoc';
import { withTrueColors } from './darkCanvas';
import { exportPdf, exportSvg, printSvgs, renderSvg } from './export';
import { customBackground } from './pageView';
import { mapPages } from './renderPage';

/** A page's export background: its custom color, else white. */
export const backgroundOf = (page: YPage | undefined) =>
  customBackground((page?.get('modelAttrs') as Attrs | undefined)?.background) ?? '#ffffff';

/** Every page as a PDF page (vector; plain-text labels). */
export async function documentToPdf(doc: Y.Doc): Promise<Blob> {
  const pages = await mapPages(doc, (g, p) => ({ svg: withTrueColors(g, () => renderSvg(g, { html: false, background: backgroundOf(p) })) }));
  return exportPdf(pages);
}

/** Every page through the browser's print dialog (which can also save a PDF with rich labels). */
export async function printDocument(doc: Y.Doc, title: string): Promise<void> {
  const svgs = await mapPages(doc, (g, p) => exportSvg(g, { background: backgroundOf(p) }));
  printSvgs(svgs, title);
}
