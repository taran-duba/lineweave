import { parseDrawio } from '@/lib/drawio/codec';
import { xmlFromPng, xmlFromSvg } from '@/lib/drawio/embed';
import type { FileData } from '@/lib/drawio/types';
import { csvToDrawio, isDrawioCsv } from './csv';
import { isMermaid, mermaidToDrawio } from './mermaid';
import { vsdxToDrawio } from './vsdx';

export const IMPORT_ACCEPT = '.drawio,.xml,.png,.svg,.vsdx,.csv,.mmd,.mermaid,.txt';

/** Text-based diagrams: draw.io XML, Mermaid flowcharts or draw.io-style CSV. */
export async function importText(text: string): Promise<FileData> {
  const t = text.trim();
  if (t.startsWith('<mxfile') || t.startsWith('<mxGraphModel')) return parseDrawio(t);
  if (t.startsWith('%3C')) return parseDrawio(decodeURIComponent(t));
  if (isMermaid(t)) return mermaidToDrawio(t);
  if (isDrawioCsv(t) || t.includes(',')) return csvToDrawio(t);
  throw new Error("That text isn't a diagram this app can read (draw.io XML, a Mermaid flowchart or CSV).");
}

/** Reads a file from the user's computer into diagram data. */
export async function importFile(file: File): Promise<FileData> {
  const name = file.name.toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (name.endsWith('.vsdx')) return vsdxToDrawio(bytes);
  if (name.endsWith('.png') || file.type === 'image/png') {
    const xml = xmlFromPng(bytes);
    if (!xml) throw new Error('That PNG has no diagram inside. Export from draw.io (or here) with "Include a copy of my diagram".');
    return parseDrawio(xml);
  }
  const text = new TextDecoder().decode(bytes);
  if (name.endsWith('.svg') || text.trimStart().startsWith('<svg') || text.includes('<svg')) {
    const xml = xmlFromSvg(text);
    if (!xml) throw new Error('That SVG has no diagram inside. Export it as an editable SVG first.');
    return parseDrawio(xml);
  }
  return importText(text);
}
