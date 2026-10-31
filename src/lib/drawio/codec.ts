import { inflateRaw } from 'pako';
import { generateNKeysBetween } from 'fractional-indexing';
import type { Attrs, CellData, FileData, GeometryData, PageData, Point } from './types';

/**
 * Reads and writes the diagrams.net `.drawio` format (`<mxfile>` with one
 * `<diagram>` per page). Anything we don't model is captured verbatim so a
 * load → save cycle never loses data.
 */

const CELL_KNOWN = new Set(['id', 'parent', 'value', 'style', 'vertex', 'edge', 'source', 'target']);
const GEOM_KNOWN = new Set(['x', 'y', 'width', 'height', 'relative', 'as']);
const DIAGRAM_KNOWN = new Set(['id', 'name']);

export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  return Array.from(bytes, (b) => alphabet[b & 63]).join('');
}

function attrsOf(el: Element, skip: Set<string>): Attrs | undefined {
  const out: Attrs = {};
  for (const a of Array.from(el.attributes)) if (!skip.has(a.name)) out[a.name] = a.value;
  return Object.keys(out).length ? out : undefined;
}

function num(el: Element, name: string): number | undefined {
  const v = el.getAttribute(name);
  return v === null || v === '' ? undefined : Number(v);
}

function readPoint(el: Element): Point {
  return { x: num(el, 'x') ?? 0, y: num(el, 'y') ?? 0 };
}

const serializer = () => new XMLSerializer();

function readGeometry(el: Element): GeometryData {
  const g: GeometryData = {};
  for (const k of ['x', 'y', 'width', 'height'] as const) {
    const v = num(el, k);
    if (v !== undefined) g[k] = v;
  }
  if (el.getAttribute('relative') === '1') g.relative = true;
  const attrs = attrsOf(el, GEOM_KNOWN);
  if (attrs) g.attrs = attrs;
  const extra: string[] = [];
  for (const child of Array.from(el.children)) {
    const as = child.getAttribute('as');
    if (child.nodeName === 'mxPoint' && (as === 'sourcePoint' || as === 'targetPoint' || as === 'offset')) {
      g[as] = readPoint(child);
    } else if (child.nodeName === 'Array' && as === 'points') {
      g.points = Array.from(child.children).filter((c) => c.nodeName === 'mxPoint').map(readPoint);
    } else {
      extra.push(serializer().serializeToString(child));
    }
  }
  if (extra.length) g.extraChildren = extra;
  return g;
}

function readCell(cellEl: Element, wrapper: Element | null): Omit<CellData, 'order'> {
  const c: Omit<CellData, 'order'> = { id: (wrapper ?? cellEl).getAttribute('id') ?? newId() };
  const parent = cellEl.getAttribute('parent');
  if (parent !== null) c.parent = parent;
  const style = cellEl.getAttribute('style');
  if (style !== null) c.style = style;
  if (cellEl.getAttribute('vertex') === '1') c.vertex = true;
  if (cellEl.getAttribute('edge') === '1') c.edge = true;
  const source = cellEl.getAttribute('source');
  if (source) c.source = source;
  const target = cellEl.getAttribute('target');
  if (target) c.target = target;
  if (wrapper) {
    c.objTag = wrapper.nodeName;
    c.value = wrapper.getAttribute('label') ?? '';
    const objAttrs = attrsOf(wrapper, new Set(['id', 'label']));
    if (objAttrs) c.objAttrs = objAttrs;
  } else {
    const value = cellEl.getAttribute('value');
    if (value !== null) c.value = value;
  }
  const attrs = attrsOf(cellEl, CELL_KNOWN);
  if (attrs) c.attrs = attrs;
  const extra: string[] = [];
  for (const child of Array.from(cellEl.children)) {
    if (child.nodeName === 'mxGeometry' && child.getAttribute('as') === 'geometry') c.geometry = readGeometry(child);
    else extra.push(serializer().serializeToString(child));
  }
  if (extra.length) c.extraChildren = extra;
  return c;
}

/** Decodes a compressed <diagram> payload: base64 → raw deflate → URI-encoded XML. */
export function decompressDiagram(data: string): string {
  const bin = atob(data.trim());
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  const text = new TextDecoder().decode(inflateRaw(bytes));
  return decodeURIComponent(text);
}

function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const err = doc.getElementsByTagName('parsererror')[0];
  if (err) throw new Error(`Invalid diagram XML: ${err.textContent?.slice(0, 200)}`);
  return doc;
}

function readModel(modelEl: Element | null): { modelAttrs: Attrs; cells: CellData[] } {
  if (!modelEl) return { modelAttrs: {}, cells: [] };
  const rootEl = Array.from(modelEl.children).find((c) => c.nodeName === 'root');
  const raw: Omit<CellData, 'order'>[] = [];
  for (const el of Array.from(rootEl?.children ?? [])) {
    if (el.nodeName === 'mxCell') raw.push(readCell(el, null));
    else {
      const inner = Array.from(el.children).find((c) => c.nodeName === 'mxCell');
      if (inner) raw.push(readCell(inner, el));
    }
  }
  // Assign sibling order keys following document order.
  const byParent = new Map<string, Omit<CellData, 'order'>[]>();
  for (const c of raw) {
    const key = c.parent ?? '';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }
  const orders = new Map<Omit<CellData, 'order'>, string>();
  for (const siblings of byParent.values()) {
    const keys = generateNKeysBetween(null, null, siblings.length);
    siblings.forEach((c, i) => orders.set(c, keys[i]));
  }
  return {
    modelAttrs: attrsOf(modelEl, new Set()) ?? {},
    cells: raw.map((c) => ({ ...c, order: orders.get(c)! })),
  };
}

export function emptyPage(name = 'Page-1', order = 'a0'): PageData {
  return {
    id: newId(),
    name,
    order,
    attrs: {},
    modelAttrs: { grid: '1', gridSize: '10', guides: '1', connect: '1', arrows: '1', page: '1', pageScale: '1', pageWidth: '850', pageHeight: '1100' },
    cells: [
      { id: '0', order: 'a0' },
      { id: '1', parent: '0', order: 'a0' },
    ],
  };
}

export function emptyFile(): FileData {
  return { attrs: { host: 'sketchwave' }, pages: [emptyPage()] };
}

/** Parses a .drawio file (or a bare <mxGraphModel>) into plain data. */
export function parseDrawio(xml: string): FileData {
  if (!xml.trim()) return emptyFile();
  const doc = parseXml(xml);
  const root = doc.documentElement;
  if (root.nodeName === 'mxGraphModel') {
    const { modelAttrs, cells } = readModel(root);
    return { attrs: {}, pages: [{ id: newId(), name: 'Page-1', order: 'a0', attrs: {}, modelAttrs, cells }] };
  }
  if (root.nodeName !== 'mxfile') throw new Error(`Unsupported root element <${root.nodeName}>`);
  const diagrams = Array.from(root.children).filter((c) => c.nodeName === 'diagram');
  const keys = generateNKeysBetween(null, null, diagrams.length);
  const pages = diagrams.map((d, i): PageData => {
    let modelEl = Array.from(d.children).find((c) => c.nodeName === 'mxGraphModel') ?? null;
    if (!modelEl && d.textContent?.trim()) {
      modelEl = parseXml(decompressDiagram(d.textContent)).documentElement;
    }
    const { modelAttrs, cells } = readModel(modelEl);
    return {
      id: d.getAttribute('id') ?? newId(),
      name: d.getAttribute('name') ?? `Page-${i + 1}`,
      order: keys[i],
      attrs: attrsOf(d, DIAGRAM_KNOWN) ?? {},
      modelAttrs,
      cells,
    };
  });
  const file: FileData = { attrs: attrsOf(root, new Set(['compressed'])) ?? {}, pages };
  return file.pages.length ? file : { ...file, pages: emptyFile().pages };
}

// ---------------------------------------------------------------- writing

function esc(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '&#10;')
    .replace(/\r/g, '&#13;')
    .replace(/\t/g, '&#9;');
}

function attrString(pairs: [string, string | number | undefined][]): string {
  return pairs
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${esc(String(v))}"`)
    .join('');
}

function pointXml(p: Point, as?: string): string {
  return `<mxPoint${attrString([['x', p.x || undefined], ['y', p.y || undefined], ['as', as]])} />`;
}

function geometryXml(g: GeometryData): string {
  const attrs = attrString([
    ['x', g.x],
    ['y', g.y],
    ['width', g.width],
    ['height', g.height],
    ['relative', g.relative ? '1' : undefined],
    ...Object.entries(g.attrs ?? {}),
    ['as', 'geometry'],
  ]);
  const children: string[] = [];
  if (g.sourcePoint) children.push(pointXml(g.sourcePoint, 'sourcePoint'));
  if (g.targetPoint) children.push(pointXml(g.targetPoint, 'targetPoint'));
  if (g.points?.length) children.push(`<Array as="points">${g.points.map((p) => pointXml(p)).join('')}</Array>`);
  if (g.offset) children.push(pointXml(g.offset, 'offset'));
  children.push(...(g.extraChildren ?? []));
  return children.length ? `<mxGeometry${attrs}>${children.join('')}</mxGeometry>` : `<mxGeometry${attrs} />`;
}

function cellXml(c: CellData): string {
  const wrapped = !!c.objTag;
  const attrs = attrString([
    ['id', wrapped ? undefined : c.id],
    ['value', wrapped ? undefined : c.value],
    ['style', c.style],
    ['vertex', c.vertex ? '1' : undefined],
    ['edge', c.edge ? '1' : undefined],
    ['parent', c.parent],
    ['source', c.source],
    ['target', c.target],
    ...Object.entries(c.attrs ?? {}),
  ]);
  const children = [c.geometry ? geometryXml(c.geometry) : '', ...(c.extraChildren ?? [])].join('');
  const cell = children ? `<mxCell${attrs}>${children}</mxCell>` : `<mxCell${attrs} />`;
  if (!wrapped) return cell;
  const objAttrs = attrString([['label', c.value ?? ''], ...Object.entries(c.objAttrs ?? {}), ['id', c.id]]);
  return `<${c.objTag}${objAttrs}>${cell}</${c.objTag}>`;
}

const byOrder = <T extends { order: string; id: string }>(a: T, b: T) =>
  a.order < b.order ? -1 : a.order > b.order ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/**
 * Orders cells depth-first (parents before children, siblings by order key).
 * Cells whose parent no longer exists (e.g. a child added while a
 * collaborator deleted its container) are dropped: diagrams.net can't load them.
 */
export function sortCellsForOutput(cells: CellData[]): CellData[] {
  const ids = new Set(cells.map((c) => c.id));
  const children = new Map<string, CellData[]>();
  const roots: CellData[] = [];
  for (const c of cells) {
    if (!c.parent) roots.push(c);
    else if (ids.has(c.parent) && c.parent !== c.id) {
      if (!children.has(c.parent)) children.set(c.parent, []);
      children.get(c.parent)!.push(c);
    }
  }
  const out: CellData[] = [];
  const seen = new Set<string>();
  const visit = (c: CellData) => {
    if (seen.has(c.id)) return;
    seen.add(c.id);
    out.push(c);
    for (const child of (children.get(c.id) ?? []).sort(byOrder)) visit(child);
  };
  roots.sort(byOrder).forEach(visit);
  return out;
}

/** A bare <mxGraphModel> (what diagrams.net puts on the clipboard). */
export function serializeModel(cells: CellData[], modelAttrs: Attrs = {}): string {
  const body = sortCellsForOutput(cells).map(cellXml).join('');
  return `<mxGraphModel${attrString(Object.entries(modelAttrs))}><root>${body}</root></mxGraphModel>`;
}

export function serializeDrawio(file: FileData): string {
  const pages = [...file.pages].sort(byOrder);
  const diagrams = pages.map((p) => {
    const dAttrs = attrString([['name', p.name], ['id', p.id], ...Object.entries(p.attrs)]);
    return `<diagram${dAttrs}>${serializeModel(p.cells, p.modelAttrs)}</diagram>`;
  });
  return `<mxfile${attrString(Object.entries(file.attrs))}>${diagrams.join('')}</mxfile>`;
}
