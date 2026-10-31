import { ImageExport, SvgCanvas2D, type Graph } from '@maxgraph/core';
import { embedXmlInPng } from '@/lib/drawio/embed';
import { withTrueColors } from './darkCanvas';
import { flattenHtmlLabels } from './flattenLabels';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface SvgOptions {
  border?: number;
  /**
   * Rich (HTML) labels via foreignObject (true), or laid out by the browser and
   * converted to SVG text ('flatten') for raster/PDF output, which can't render foreignObject.
   */
  html?: boolean | 'flatten';
  background?: string;
  /** .drawio XML to embed, making the SVG re-editable in this app and diagrams.net. */
  embedXml?: string;
}

/** Renders a page to a standalone SVG string at 100% scale, in its true (saved) colors. */
export function exportSvg(graph: Graph, opts: SvgOptions = {}): string {
  return withTrueColors(graph, () => new XMLSerializer().serializeToString(renderSvg(graph, opts)));
}

export function renderSvg(graph: Graph, { border = 10, html = true, background = '#ffffff', embedXml }: SvgOptions = {}): SVGSVGElement {
  const view = graph.view;
  const bounds = graph.getGraphBounds();
  const s = view.scale;
  const width = Math.max(1, Math.ceil(bounds.width / s + 2 * border));
  const height = Math.max(1, Math.ceil(bounds.height / s + 2 * border));

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  svg.setAttribute('width', `${width}px`);
  svg.setAttribute('height', `${height}px`);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  if (background !== 'none') svg.setAttribute('style', `background-color: ${background}`);
  if (embedXml) svg.setAttribute('content', embedXml);
  const root = document.createElementNS(SVG_NS, 'g');
  svg.appendChild(root);

  const canvas = new SvgCanvas2D(root, false);
  canvas.foEnabled = !!html;
  canvas.translate(Math.floor(border - bounds.x / s), Math.floor(border - bounds.y / s));
  canvas.scale(1 / s);
  const state = view.getState(graph.getDataModel().root!);
  if (state) new ImageExport().drawState(state, canvas);
  return html === 'flatten' ? flattenHtmlLabels(svg) : svg;
}

async function rasterize(graph: Graph, type: 'image/png' | 'image/jpeg', scale: number, background: string): Promise<Blob> {
  // No foreignObject: it would taint the canvas.
  const svg = exportSvg(graph, { html: 'flatten', background });
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  const ctx = canvas.getContext('2d')!;
  // JPEG has no transparency; PNG keeps it only for an explicit "none" background.
  if (type === 'image/jpeg' || background !== 'none') {
    ctx.fillStyle = background === 'none' ? '#ffffff' : background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image export failed'))), type, 0.92),
  );
}

export async function exportPng(graph: Graph, { scale = 2, background = '#ffffff', embedXml }: { scale?: number; background?: string; embedXml?: string } = {}): Promise<Blob> {
  const blob = await rasterize(graph, 'image/png', scale, background);
  if (!embedXml) return blob;
  const bytes = embedXmlInPng(new Uint8Array(await blob.arrayBuffer()), embedXml);
  return new Blob([bytes as BlobPart], { type: 'image/png' });
}

export function exportJpeg(graph: Graph, { scale = 2, background = '#ffffff' } = {}): Promise<Blob> {
  return rasterize(graph, 'image/jpeg', scale, background);
}

// The PDF's built-in fonts only cover Windows-1252; spell out common symbols they lack.
const PDF_FALLBACKS: Record<string, string> = { 'Ω': ' ohm', 'Δ': 'delta', '→': '->', '←': '<-', '↑': '^', '↓': 'v', '≤': '<=', '≥': '>=', '≈': '~', '−': '-', '✓': 'v' };
const WIN_1252_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

function pdfSafeText(svg: SVGSVGElement): void {
  for (const t of Array.from(svg.getElementsByTagName('text'))) {
    const text = t.textContent ?? '';
    const safe = Array.from(text, (ch) => (ch.charCodeAt(0) < 256 || WIN_1252_EXTRA.has(ch) ? ch : (PDF_FALLBACKS[ch] ?? '?'))).join('').replace(/ {2,}/g, ' ');
    if (safe !== text) t.textContent = safe;
  }
}

/** A vector PDF with one page per diagram page, each sized to its content. */
export async function exportPdf(pages: { svg: SVGSVGElement }[]): Promise<Blob> {
  const [{ jsPDF }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const size = (svg: SVGSVGElement) => [parseFloat(svg.getAttribute('width')!), parseFloat(svg.getAttribute('height')!)] as const;
  const [w0, h0] = size(pages[0].svg);
  const pdf = new jsPDF({ unit: 'px', format: [w0, h0], orientation: w0 > h0 ? 'landscape' : 'portrait', hotfixes: ['px_scaling'] });
  for (let i = 0; i < pages.length; i++) {
    const [w, h] = size(pages[i].svg);
    if (i > 0) pdf.addPage([w, h], w > h ? 'landscape' : 'portrait');
    pdfSafeText(pages[i].svg);
    await pdf.svg(pages[i].svg, { x: 0, y: 0, width: w, height: h });
  }
  return pdf.output('blob');
}

/** Prints pages through the browser's print dialog (which can also save as PDF). */
export function printSvgs(svgs: string[], title: string): void {
  const frame = document.createElement('iframe');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  doc.open();
  doc.write(
    `<!doctype html><html><head><title>${esc(title)}</title><style>
      @page { margin: 12mm; }
      body { margin: 0; }
      .page { break-after: page; display: flex; justify-content: center; align-items: flex-start; }
      .page:last-child { break-after: auto; }
      .page svg { max-width: 100%; max-height: 95vh; height: auto; }
    </style></head><body>${svgs.map((s) => `<div class="page">${s}</div>`).join('')}</body></html>`,
  );
  doc.close();
  frame.contentWindow!.focus();
  // Give embedded images a moment to load before the dialog snapshots the page.
  setTimeout(() => {
    frame.contentWindow!.print();
    setTimeout(() => frame.remove(), 1000);
  }, 300);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
