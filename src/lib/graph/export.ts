import { ImageExport, SvgCanvas2D, type Graph } from '@maxgraph/core';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Renders the current page to a standalone SVG string at 100% scale. */
export function exportSvg(graph: Graph, { border = 10, html = true, background = '#ffffff' } = {}): string {
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
  const root = document.createElementNS(SVG_NS, 'g');
  svg.appendChild(root);

  const canvas = new SvgCanvas2D(root, false);
  canvas.foEnabled = html;
  canvas.translate(Math.floor(border - bounds.x / s), Math.floor(border - bounds.y / s));
  canvas.scale(1 / s);
  const state = view.getState(graph.getDataModel().root!);
  if (state) new ImageExport().drawState(state, canvas);
  return new XMLSerializer().serializeToString(svg);
}

/** Rasterizes the page via the SVG renderer (plain-text labels so the canvas isn't tainted). */
export async function exportPng(graph: Graph, scale = 2): Promise<Blob> {
  const svg = exportSvg(graph, { html: false });
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png'),
  );
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
