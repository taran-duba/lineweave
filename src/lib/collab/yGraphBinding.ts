import * as Y from 'yjs';
import { Cell, Geometry, InternalEvent, Point, type EventObject, type EventSource, type GraphDataModel } from '@maxgraph/core';
import { generateKeyBetween } from 'fractional-indexing';
import { newId } from '@/lib/drawio/codec';
import { mergeCellStyle, toCellStyle } from '@/lib/drawio/style';
import type { Attrs, CellData, GeometryData, Point as P } from '@/lib/drawio/types';
import { cellFromY, cellsOf, writeCellFields, type YCell, type YCells, type YPage } from '@/lib/drawio/ydoc';

/**
 * Two-way binding between one page of the Y.Doc and a maxGraph GraphDataModel.
 *
 * - Local edits: maxGraph emits CHANGE with a list of undoable changes. We
 *   collect the touched cells and write their current state into Y in one
 *   transaction tagged with `this.origin`.
 * - Remote edits (and Y.UndoManager undo/redo): we observe the cells map and
 *   reconcile the maxGraph model, with `applying` set so the CHANGE event the
 *   model emits isn't echoed back into Y.
 *
 * Y is canonical: raw style strings, unknown attributes and children live
 * there and survive any maxGraph edit.
 */
export class YGraphBinding {
  readonly origin = { binding: 'local-graph' };
  /**
   * For local edits made directly to Y (paste, Edit Data/Style): applied to the
   * graph like a remote change, but tracked by this user's undo manager.
   */
  readonly importOrigin = { binding: 'local-import' };
  readonly cells: YCells;
  private applying = false;
  private appliedStyle = new WeakMap<Cell, string | undefined>();

  constructor(
    readonly model: GraphDataModel,
    readonly page: YPage,
  ) {
    this.cells = cellsOf(page);
    // Unique ids across collaborators (maxGraph defaults to a local counter).
    model.createId = () => newId();
    this.loadAll();
    model.addListener(InternalEvent.CHANGE, this.onModelChange);
    this.cells.observeDeep(this.onYChange);
  }

  destroy(): void {
    this.model.removeListener(this.onModelChange);
    this.cells.unobserveDeep(this.onYChange);
  }

  // ------------------------------------------------------------ Y -> model

  private loadAll(): void {
    const byId = new Map<string, Cell>();
    const datas: CellData[] = [];
    this.cells.forEach((m, id) => {
      const d = cellFromY(id, m);
      datas.push(d);
      const c = new Cell();
      c.id = id;
      this.applyFields(c, d, true);
      byId.set(id, c);
    });
    const root = datas.filter((d) => !d.parent).sort(byOrder)[0];
    const rootCell = root ? byId.get(root.id)! : new Cell();
    datas.sort(byOrder);
    for (const d of datas) {
      if (!d.parent) continue;
      const parent = byId.get(d.parent);
      if (parent && parent !== byId.get(d.id)) parent.insert(byId.get(d.id)!);
    }
    for (const d of datas) {
      const c = byId.get(d.id)!;
      for (const [tid, isSource] of [[d.source, true], [d.target, false]] as const) {
        const t = tid ? byId.get(tid) : undefined;
        if (t) t.insertEdge(c, isSource);
      }
    }
    if (!root) rootCell.insert(new Cell());
    this.applying = true;
    try {
      this.model.setRoot(rootCell);
    } finally {
      this.applying = false;
    }
  }

  private onYChange = (events: Y.YEvent<Y.AbstractType<unknown>>[], txn: Y.Transaction): void => {
    if (txn.origin === this.origin) return;
    const changed = new Set<string>();
    const deleted = new Set<string>();
    for (const e of events) {
      if (e.target === this.cells) {
        e.changes.keys.forEach((change, key) => (change.action === 'delete' ? deleted.add(key) : changed.add(key)));
      } else if (typeof e.path[0] === 'string') {
        changed.add(e.path[0]);
      }
    }
    if (changed.size || deleted.size) this.applyRemote(changed, deleted);
  };

  private applyRemote(changed: Set<string>, deleted: Set<string>): void {
    const model = this.model;
    this.applying = true;
    model.beginUpdate();
    try {
      for (const id of deleted) {
        if (changed.has(id)) continue;
        const c = model.getCell(id);
        if (c && c !== model.root && model.contains(c)) model.remove(c);
      }
      const datas = [...changed].flatMap((id) => {
        const m = this.cells.get(id);
        return m ? [cellFromY(id, m)] : [];
      });
      const created = new Map<string, Cell>();
      for (const d of datas) {
        if (!model.getCell(d.id)) {
          const c = new Cell();
          c.id = d.id;
          this.applyFields(c, d, true);
          created.set(d.id, c);
        }
      }
      const lookup = (id?: string) => (id ? (model.getCell(id) ?? created.get(id) ?? null) : null);
      const parents = new Set<Cell>();
      // Attach to parents; repeat so new children of new parents resolve.
      let pending = datas.filter((d) => d.parent);
      for (let pass = 0; pass < 8 && pending.length; pass++) {
        const next: CellData[] = [];
        for (const d of pending) {
          const c = lookup(d.id)!;
          const parent = lookup(d.parent);
          if (!parent || !(model.contains(parent) || parent === model.root)) {
            next.push(d);
            continue;
          }
          if (c.parent !== parent || !model.contains(c)) model.add(parent, c);
          parents.add(parent);
        }
        if (next.length === pending.length) break;
        pending = next;
      }
      for (const d of datas) {
        const c = lookup(d.id);
        if (!c || !model.contains(c)) continue;
        if (!created.has(d.id)) this.applyFields(c, d, false);
        const source = lookup(d.source);
        const target = lookup(d.target);
        if (c.source !== source) model.setTerminal(c, source, true);
        if (c.target !== target) model.setTerminal(c, target, false);
      }
      for (const parent of parents) this.reorderChildren(parent);
    } finally {
      model.endUpdate();
      this.applying = false;
    }
  }

  /** Copies Y data onto a cell; `fresh` cells are mutated directly, live ones via the model. */
  private applyFields(c: Cell, d: CellData, fresh: boolean): void {
    const model = this.model;
    c.vertex = !!d.vertex;
    c.edge = !!d.edge;
    c.connectable = d.attrs?.connectable !== '0';
    const value = d.value ?? null;
    const visible = d.attrs?.visible !== '0';
    const collapsed = d.attrs?.collapsed === '1';
    if (fresh) {
      c.value = value;
      c.style = toCellStyle(d.style);
      c.geometry = toGeometry(d.geometry);
      c.visible = visible;
      c.collapsed = collapsed;
      this.appliedStyle.set(c, d.style);
      return;
    }
    if ((c.value ?? null) !== value) model.setValue(c, value);
    if (this.appliedStyle.get(c) !== d.style) {
      model.setStyle(c, toCellStyle(d.style));
      this.appliedStyle.set(c, d.style);
    }
    const geo = toGeometry(d.geometry);
    if (JSON.stringify(fromGeometry(c.geometry)) !== JSON.stringify(fromGeometry(geo))) model.setGeometry(c, geo!);
    if (c.visible !== visible) model.setVisible(c, visible);
    if (c.collapsed !== collapsed) model.setCollapsed(c, collapsed);
  }

  private reorderChildren(parent: Cell): void {
    const sorted = [...parent.children].sort((a, b) =>
      byOrder(
        { id: a.id ?? '', order: (this.cells.get(a.id ?? '')?.get('order') as string) ?? '' },
        { id: b.id ?? '', order: (this.cells.get(b.id ?? '')?.get('order') as string) ?? '' },
      ),
    );
    sorted.forEach((child, i) => {
      if (parent.children[i] !== child) this.model.add(parent, child, i);
    });
  }

  // ------------------------------------------------------------ model -> Y

  private onModelChange = (_sender: EventSource, evt: EventObject): void => {
    if (this.applying) return;
    const changes: unknown[] = evt.getProperty('edit')?.changes ?? evt.getProperty('changes') ?? [];
    const dirty = new Set<Cell>();
    const removed: Cell[] = [];
    const parents = new Set<Cell>();
    for (const ch of changes as Record<string, unknown>[]) {
      if (ch.child instanceof Cell && 'previous' in ch) {
        const child = ch.child;
        if (this.model.contains(child)) {
          visit(child, (c) => dirty.add(c));
          if (child.parent) parents.add(child.parent);
        } else {
          removed.push(child);
        }
      } else if (ch.cell instanceof Cell) {
        dirty.add(ch.cell);
      }
    }
    if (!dirty.size && !removed.length) return;
    this.page.doc!.transact(() => {
      for (const r of removed) visit(r, (c) => c.id && this.cells.delete(c.id));
      for (const c of dirty) if (this.model.contains(c)) this.upsert(c);
      for (const p of parents) this.fixOrder(p);
    }, this.origin);
  };

  private upsert(c: Cell): void {
    if (!c.id) return;
    let m = this.cells.get(c.id);
    if (!m) {
      m = new Y.Map() as YCell;
      this.cells.set(c.id, m);
    }
    const prev = cellFromY(c.id, m);
    const style = mergeCellStyle(prev.style, c.style);
    this.appliedStyle.set(c, style || prev.style);
    const attrs: Attrs = { ...(prev.attrs ?? {}) };
    setFlag(attrs, 'collapsed', c.collapsed ? '1' : undefined);
    setFlag(attrs, 'visible', c.visible ? undefined : '0');
    setFlag(attrs, 'connectable', c.connectable ? undefined : '0');
    writeCellFields(m, {
      parent: c.parent?.id ?? undefined,
      value: c.value == null ? (prev.value === undefined ? undefined : '') : String(c.value),
      style: style || (prev.style === undefined ? undefined : style),
      vertex: c.vertex || undefined,
      edge: c.edge || undefined,
      source: c.source?.id ?? undefined,
      target: c.target?.id ?? undefined,
      geometry: c.geometry ? { ...fromGeometry(c.geometry), ...keepExtras(prev.geometry) } : undefined,
      attrs: Object.keys(attrs).length ? attrs : undefined,
    });
  }

  /** Ensures sibling order keys strictly increase in the model's child order. */
  private fixOrder(parent: Cell): void {
    const kids = parent.children;
    const keyOf = (c: Cell) => this.cells.get(c.id ?? '')?.get('order') as string | undefined;
    let last: string | null = null;
    for (let i = 0; i < kids.length; i++) {
      const m = this.cells.get(kids[i].id ?? '');
      if (!m) continue;
      const k = keyOf(kids[i]);
      if (k && (last === null || k > last)) {
        last = k;
        continue;
      }
      let next: string | null = null;
      for (let j = i + 1; j < kids.length; j++) {
        const kj = keyOf(kids[j]);
        if (kj && (last === null || kj > last)) {
          next = kj;
          break;
        }
      }
      const key = generateKeyBetween(last, next);
      m.set('order', key);
      last = key;
    }
  }
}

// ---------------------------------------------------------------- helpers

function byOrder(a: { order: string; id: string }, b: { order: string; id: string }): number {
  if (a.order !== b.order) return a.order < b.order ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function visit(c: Cell, fn: (c: Cell) => void): void {
  fn(c);
  for (const child of c.children) visit(child, fn);
}

function setFlag(attrs: Attrs, key: string, value: string | undefined): void {
  if (value === undefined) delete attrs[key];
  else attrs[key] = value;
}

function keepExtras(g: GeometryData | undefined): Partial<GeometryData> {
  const out: Partial<GeometryData> = {};
  if (g?.attrs) out.attrs = g.attrs;
  if (g?.extraChildren) out.extraChildren = g.extraChildren;
  return out;
}

const pt = (p: Point | null | undefined): P | undefined => (p ? { x: p.x, y: p.y } : undefined);

export function fromGeometry(g: Geometry | null | undefined): GeometryData | undefined {
  if (!g) return undefined;
  const out: GeometryData = {};
  if (g.x) out.x = g.x;
  if (g.y) out.y = g.y;
  if (g.width) out.width = g.width;
  if (g.height) out.height = g.height;
  if (g.relative) out.relative = true;
  if (g.points?.length) out.points = g.points.map((p) => ({ x: p.x, y: p.y }));
  if (g.sourcePoint) out.sourcePoint = pt(g.sourcePoint);
  if (g.targetPoint) out.targetPoint = pt(g.targetPoint);
  if (g.offset && (g.offset.x || g.offset.y)) out.offset = pt(g.offset);
  return out;
}

export function toGeometry(d: GeometryData | undefined): Geometry | null {
  if (!d) return null;
  const g = new Geometry(d.x ?? 0, d.y ?? 0, d.width ?? 0, d.height ?? 0);
  g.relative = !!d.relative;
  if (d.points?.length) g.points = d.points.map((p) => new Point(p.x, p.y));
  if (d.sourcePoint) g.sourcePoint = new Point(d.sourcePoint.x, d.sourcePoint.y);
  if (d.targetPoint) g.targetPoint = new Point(d.targetPoint.x, d.targetPoint.y);
  if (d.offset) g.offset = new Point(d.offset.x, d.offset.y);
  return g;
}
