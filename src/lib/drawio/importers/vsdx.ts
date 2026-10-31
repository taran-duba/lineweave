import { strFromU8, unzipSync } from 'fflate';
import { generateNKeysBetween } from 'fractional-indexing';
import { emptyPage, newId } from '@/lib/drawio/codec';
import type { CellData, FileData, PageData } from '@/lib/drawio/types';

/**
 * Basic Visio (.vsdx) import, also how Lucidchart diagrams come in (Lucid
 * exports .vsdx). Covers shapes (mapped by their master's name), groups,
 * connectors and their connections, colors, text, rotation and bitmaps.
 * Custom stencil geometry, themes and Visio-specific formatting aren't converted.
 */

const PX_PER_INCH = 100;

type Zip = Record<string, Uint8Array>;
type Cells = Record<string, string>;

interface MasterShape {
  cells: Cells;
  text: string;
  char: Cells;
}

const kids = (el: Element, name: string) => Array.from(el.children).filter((c) => c.localName === name);
const kid = (el: Element, name: string) => kids(el, name)[0];

function readXml(zip: Zip, path: string): Document | null {
  const bytes = zip[path];
  return bytes ? new DOMParser().parseFromString(strFromU8(bytes), 'text/xml') : null;
}

/** Relationship id → target path, resolved against the part's folder. */
function rels(zip: Zip, partPath: string): Record<string, string> {
  const dir = partPath.slice(0, partPath.lastIndexOf('/'));
  const doc = readXml(zip, `${dir}/_rels/${partPath.slice(dir.length + 1)}.rels`);
  const out: Record<string, string> = {};
  for (const r of Array.from(doc?.getElementsByTagName('Relationship') ?? [])) {
    const parts = `${dir}/${r.getAttribute('Target')}`.split('/');
    const resolved: string[] = [];
    for (const p of parts) {
      if (p === '..') resolved.pop();
      else resolved.push(p);
    }
    out[r.getAttribute('Id')!] = resolved.join('/');
  }
  return out;
}

const relId = (el: Element | undefined) =>
  el?.getAttribute('r:id') ?? el?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? '';

function cellsOf(shape: Element): Cells {
  const out: Cells = {};
  for (const c of kids(shape, 'Cell')) out[c.getAttribute('N')!] = c.getAttribute('V') ?? '';
  return out;
}

function charOf(shape: Element): Cells {
  const section = kids(shape, 'Section').find((s) => s.getAttribute('N') === 'Character');
  const row = section && kids(section, 'Row')[0];
  return row ? cellsOf(row) : {};
}

const textOf = (shape: Element) => kid(shape, 'Text')?.textContent?.trim() ?? '';

function loadMasters(zip: Zip): Map<string, { name: string; shapes: Map<string, MasterShape>; top?: MasterShape }> {
  const out = new Map<string, { name: string; shapes: Map<string, MasterShape>; top?: MasterShape }>();
  const doc = readXml(zip, 'visio/masters/masters.xml');
  if (!doc) return out;
  const r = rels(zip, 'visio/masters/masters.xml');
  for (const m of Array.from(doc.getElementsByTagName('Master'))) {
    const shapes = new Map<string, MasterShape>();
    const contents = readXml(zip, r[relId(kid(m, 'Rel'))] ?? '');
    for (const s of Array.from(contents?.getElementsByTagName('Shape') ?? [])) {
      shapes.set(s.getAttribute('ID')!, { cells: cellsOf(s), text: textOf(s), char: charOf(s) });
    }
    out.set(m.getAttribute('ID')!, { name: m.getAttribute('NameU') ?? m.getAttribute('Name') ?? '', shapes, top: shapes.values().next().value });
  }
  return out;
}

function shapeStyle(master: string, type: string): string {
  const n = master.toLowerCase();
  if (type === 'Foreign') return 'shape=image;imageAspect=0;';
  if (/ellipse|circle|oval/.test(n)) return 'ellipse;';
  if (/diamond|decision/.test(n)) return 'rhombus;';
  if (/triangle/.test(n)) return 'triangle;';
  if (/start\/end|terminator|rounded rectangle/.test(n)) return 'rounded=1;arcSize=50;';
  if (/parallelogram|^data$/.test(n)) return 'shape=parallelogram;perimeter=parallelogramPerimeter;fixedSize=1;';
  if (/document/.test(n)) return 'shape=document;boundedLbl=1;';
  if (/database|cylinder/.test(n)) return 'shape=cylinder3;boundedLbl=1;backgroundOutline=1;size=15;';
  if (/hexagon|preparation/.test(n)) return 'shape=hexagon;perimeter=hexagonPerimeter2;fixedSize=1;';
  if (/cloud/.test(n)) return 'ellipse;shape=cloud;';
  if (/^text/.test(n)) return 'text;strokeColor=none;fillColor=none;';
  return 'rounded=0;';
}

const color = (v: string | undefined) => (v && /^#[0-9a-f]{6}$/i.test(v) ? v : undefined);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

function convertPage(zip: Zip, pagePath: string, pageEl: Element, masters: ReturnType<typeof loadMasters>, order: string): PageData {
  const page = emptyPage(pageEl.getAttribute('NameU') ?? pageEl.getAttribute('Name') ?? 'Page', order);
  const pageSheet = kid(pageEl, 'PageSheet');
  const pageCells = pageSheet ? cellsOf(pageSheet) : {};
  const pageW = Number(pageCells.PageWidth || 8.5);
  const pageH = Number(pageCells.PageHeight || 11);
  page.modelAttrs.pageWidth = String(Math.round(pageW * PX_PER_INCH));
  page.modelAttrs.pageHeight = String(Math.round(pageH * PX_PER_INCH));
  const doc = readXml(zip, pagePath);
  const media = rels(zip, pagePath);
  if (!doc) return page;

  const ids = new Map<string, string>();
  const cells: CellData[] = [];

  const visit = (shape: Element, parent: string, parentH: number) => {
    const masterId = shape.getAttribute('Master');
    const master = masterId ? masters.get(masterId) : undefined;
    const fromMaster = (master && shape.getAttribute('MasterShape') ? master.shapes.get(shape.getAttribute('MasterShape')!) : master?.top) ?? undefined;
    const c = { ...(fromMaster?.cells ?? {}), ...cellsOf(shape) };
    const ch = { ...(fromMaster?.char ?? {}), ...charOf(shape) };
    const num = (k: string, d = 0) => (c[k] !== undefined && c[k] !== '' && Number.isFinite(Number(c[k])) ? Number(c[k]) : d);
    const id = newId();
    ids.set(shape.getAttribute('ID')!, id);
    const text = textOf(shape) || fromMaster?.text || '';
    const type = shape.getAttribute('Type') ?? 'Shape';
    const name = master?.name ?? '';
    const style: string[] = [];
    const stroke = c.LinePattern === '0' ? 'none' : color(c.LineColor);
    if (stroke) style.push(`strokeColor=${stroke};`);
    if (c.LineWeight) style.push(`strokeWidth=${Math.max(1, Math.round(num('LineWeight') * PX_PER_INCH))};`);
    if (color(ch.Color)) style.push(`fontColor=${ch.Color};`);
    if (ch.Size) style.push(`fontSize=${Math.round(Number(ch.Size) * 72)};`);
    if (c.LinePattern && !['0', '1'].includes(c.LinePattern)) style.push('dashed=1;');

    if (c.BeginX !== undefined && c.EndX !== undefined && type !== 'Group') {
      // A 1-D shape: a connector.
      const pt = (x: string, y: string) => ({ x: Math.round(num(x) * PX_PER_INCH), y: Math.round((parentH - num(y)) * PX_PER_INCH) });
      if (/dynamic connector/i.test(name)) style.unshift('edgeStyle=orthogonalEdgeStyle;rounded=0;');
      style.push(Number(c.EndArrow) > 0 ? 'endArrow=classic;' : 'endArrow=none;');
      if (Number(c.BeginArrow) > 0) style.push('startArrow=classic;');
      style.push('html=1;');
      cells.push({ id, parent, value: text ? esc(text) : undefined, style: style.join(''), edge: true, order: '', geometry: { relative: true, sourcePoint: pt('BeginX', 'BeginY'), targetPoint: pt('EndX', 'EndY') } });
      return;
    }

    const w = num('Width') * PX_PER_INCH;
    const h = num('Height') * PX_PER_INCH;
    const x = (num('PinX') - num('LocPinX', num('Width') / 2)) * PX_PER_INCH;
    const y = (parentH - num('PinY') - (num('Height') - num('LocPinY', num('Height') / 2))) * PX_PER_INCH;
    if (type === 'Group') style.unshift('group;');
    else {
      style.unshift(shapeStyle(name, type));
      const fill = c.FillPattern === '0' ? 'none' : color(c.FillForegnd);
      if (fill) style.push(`fillColor=${fill};`);
      style.push('whiteSpace=wrap;html=1;');
    }
    const angle = -num('Angle') * (180 / Math.PI);
    if (Math.round(angle) % 360) style.push(`rotation=${Math.round(((angle % 360) + 360) % 360)};`);
    if (type === 'Foreign') {
      const target = media[relId(kid(kid(shape, 'ForeignData') ?? shape, 'Rel'))];
      const bytes = target && zip[target];
      if (bytes) {
        const ext = target.split('.').pop()!.toLowerCase();
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        style.push(`image=data:${mime},${btoa(bin)};`);
      }
    }
    cells.push({
      id,
      parent,
      value: text ? esc(text) : undefined,
      style: style.join(''),
      vertex: true,
      order: '',
      geometry: { x: Math.round(x), y: Math.round(y), width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) },
    });
    const inner = kid(shape, 'Shapes');
    if (inner) for (const child of kids(inner, 'Shape')) visit(child, id, num('Height'));
  };

  const top = kid(doc.documentElement, 'Shapes');
  if (top) for (const s of kids(top, 'Shape')) visit(s, '1', pageH);

  // Glue: which shape each connector end is attached to.
  const connects = kid(doc.documentElement, 'Connects');
  for (const conn of connects ? kids(connects, 'Connect') : []) {
    const edge = cells.find((x) => x.id === ids.get(conn.getAttribute('FromSheet')!));
    const to = ids.get(conn.getAttribute('ToSheet')!);
    if (!edge?.edge || !to) continue;
    if (conn.getAttribute('FromCell') === 'BeginX') edge.source = to;
    if (conn.getAttribute('FromCell') === 'EndX') edge.target = to;
  }
  const byParent = new Map<string, CellData[]>();
  for (const c of cells) byParent.set(c.parent!, [...(byParent.get(c.parent!) ?? []), c]);
  for (const group of byParent.values()) generateNKeysBetween(null, null, group.length).forEach((k, i) => (group[i].order = k));
  page.cells.push(...cells);
  return page;
}

export function vsdxToDrawio(bytes: Uint8Array): FileData {
  let zip: Zip;
  try {
    zip = unzipSync(bytes);
  } catch {
    throw new Error("That file isn't a valid .vsdx (Visio) file.");
  }
  const pagesDoc = readXml(zip, 'visio/pages/pages.xml');
  if (!pagesDoc) throw new Error("That file isn't a valid .vsdx (Visio) file.");
  const masters = loadMasters(zip);
  const pageRels = rels(zip, 'visio/pages/pages.xml');
  const pageEls = Array.from(pagesDoc.getElementsByTagName('Page')).filter((p) => p.getAttribute('Background') !== '1');
  const orders = generateNKeysBetween(null, null, pageEls.length);
  const pages = pageEls.map((p, i) => convertPage(zip, pageRels[relId(kid(p, 'Rel'))] ?? '', p, masters, orders[i]));
  if (!pages.length) throw new Error('That Visio file has no pages.');
  return { attrs: {}, pages };
}
