import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as Y from 'yjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { Cell, Geometry, GraphDataModel } from '@maxgraph/core';
import { parseDrawio, serializeDrawio } from '@/lib/drawio/codec';
import { getStyleValue } from '@/lib/drawio/style';
import { docToFile, loadFileIntoDoc, mergeFileIntoDoc, pagesOf, sortedPageIds } from '@/lib/drawio/ydoc';
import { YGraphBinding } from '@/lib/collab/yGraphBinding';
import { toCellStyle } from '@/lib/drawio/style';

const sample = readFileSync(path.join(__dirname, '../fixtures/sample.drawio'), 'utf8');

/** Two clients whose docs sync only when `online` is true (or on flush()). */
function setup() {
  const a = new Y.Doc();
  const b = new Y.Doc();
  let online = true;
  const queue: [Y.Doc, Uint8Array][] = [];
  const relay = (to: Y.Doc) => (u: Uint8Array, origin: unknown) => {
    if (origin === 'net') return;
    if (online) Y.applyUpdate(to, u, 'net');
    else queue.push([to, u]);
  };
  a.on('update', relay(b));
  b.on('update', relay(a));
  loadFileIntoDoc(a, parseDrawio(sample));
  const pageId = sortedPageIds(a)[0];
  const ma = new GraphDataModel();
  const mb = new GraphDataModel();
  const ba = new YGraphBinding(ma, pagesOf(a).get(pageId)!);
  const bb = new YGraphBinding(mb, pagesOf(b).get(pageId)!);
  return {
    a, b, ma, mb, ba, bb,
    offline: () => (online = false),
    reconnect: () => {
      online = true;
      for (const [to, u] of queue.splice(0)) Y.applyUpdate(to, u, 'net');
    },
  };
}

const ids = (m: GraphDataModel, parentId: string) => m.getCell(parentId)!.children.map((c) => c.id);

function addVertex(m: GraphDataModel, label: string, x: number) {
  const c = new Cell(label, new Geometry(x, 10, 80, 40), toCellStyle('rounded=1;whiteSpace=wrap;'));
  c.vertex = true;
  m.add(m.getCell('1'), c);
  return c;
}

describe('YGraphBinding', () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => {
    t = setup();
  });

  it('loads the page tree into both models', () => {
    for (const m of [t.ma, t.mb]) {
      expect(m.getCell('start')?.value).toBe('Start');
      expect(m.getCell('child')?.parent?.id).toBe('grp');
      expect(m.getCell('e1')?.source?.id).toBe('start');
      expect(m.getCell('e1')?.target?.id).toBe('decide');
      expect(m.getCell('grp')?.collapsed).toBe(true);
    }
    expect(ids(t.mb, '1')).toEqual(ids(t.ma, '1'));
  });

  it('propagates added vertices with unique ids', () => {
    const c = addVertex(t.ma, 'New', 500);
    expect(c.id).toMatch(/^[\w-]{20}$/);
    const remote = t.mb.getCell(c.id!);
    expect(remote?.value).toBe('New');
    expect(remote?.geometry?.x).toBe(500);
    expect(ids(t.mb, '1')).toEqual(ids(t.ma, '1'));
  });

  it('propagates moves while preserving unknown style keys', () => {
    const start = t.ma.getCell('start')!;
    const g = start.geometry!.clone();
    g.x = 333;
    t.ma.setGeometry(start, g);
    expect(t.mb.getCell('start')?.geometry?.x).toBe(333);
    const xml = serializeDrawio(docToFile(t.b));
    expect(xml).toContain('customThing=keep me');
    expect(xml).toContain('x="333"');
  });

  it('merges concurrent edits to different properties of one cell', () => {
    t.offline();
    const sa = t.ma.getCell('start')!;
    t.ma.setStyle(sa, { ...sa.style, fillColor: '#ff0000' });
    const sb = t.mb.getCell('start')!;
    const g = sb.geometry!.clone();
    g.y = 999;
    t.mb.setGeometry(sb, g);
    t.reconnect();
    for (const m of [t.ma, t.mb]) {
      expect(m.getCell('start')?.geometry?.y).toBe(999);
      expect((m.getCell('start')?.style as Record<string, unknown>).fillColor).toBe('#ff0000');
    }
    const style = docToFile(t.a).pages[0].cells.find((c) => c.id === 'start')!.style;
    expect(getStyleValue(style, 'fillColor')).toBe('#ff0000');
    expect(getStyleValue(style, 'customThing')).toBe('keep me');
  });

  it('propagates deletes, including children of removed containers', () => {
    t.ma.remove(t.ma.getCell('grp')!);
    expect(t.mb.getCell('grp')).toBeFalsy();
    expect(t.mb.getCell('child')).toBeFalsy();
    expect(pagesOf(t.b).get(sortedPageIds(t.b)[0])!.get('cells')).toBeDefined();
    const cells = docToFile(t.b).pages[0].cells.map((c) => c.id);
    expect(cells).not.toContain('grp');
    expect(cells).not.toContain('child');
  });

  it('propagates z-order changes', () => {
    const layer = t.ma.getCell('1')!;
    t.ma.add(layer, t.ma.getCell('start'), layer.children.length - 1);
    expect(ids(t.ma, '1').at(-1)).toBe('start');
    expect(ids(t.mb, '1')).toEqual(ids(t.ma, '1'));
  });

  it('converges after concurrent inserts', () => {
    t.offline();
    addVertex(t.ma, 'A', 0);
    addVertex(t.mb, 'B', 0);
    t.reconnect();
    expect(ids(t.mb, '1')).toEqual(ids(t.ma, '1'));
    expect(t.ma.getCell('1')!.children).toHaveLength(7);
  });

  it('undo only reverts local changes', () => {
    const undoA = new Y.UndoManager(t.ba.cells, { trackedOrigins: new Set([t.ba.origin]), captureTimeout: 0 });
    const mine = addVertex(t.ma, 'mine', 0);
    const theirs = addVertex(t.mb, 'theirs', 100);
    undoA.undo();
    for (const m of [t.ma, t.mb]) {
      expect(m.getCell(mine.id!)).toBeFalsy();
      expect(m.getCell(theirs.id!)?.value).toBe('theirs');
    }
    undoA.redo();
    expect(t.mb.getCell(mine.id!)?.value).toBe('mine');
  });
});

describe('mergeFileIntoDoc', () => {
  it('updates an open page in place, so bound canvases follow', () => {
    const t = setup();
    const file = docToFile(t.a);
    const page = file.pages[0];
    // An "older version": start renamed and moved, child removed, a new shape added.
    page.cells = page.cells
      .filter((c) => c.id !== 'child')
      .map((c) => (c.id === 'start' ? { ...c, value: 'Begin', geometry: { ...c.geometry, x: 5 } } : c));
    page.cells.push({ id: 'new', parent: '1', value: 'New', vertex: true, order: 'a9', geometry: { x: 1, y: 2, width: 3, height: 4 } });
    const pageMap = pagesOf(t.a).get(page.id);
    mergeFileIntoDoc(t.a, file);
    expect(pagesOf(t.a).get(page.id)).toBe(pageMap); // same Y object: bindings stay attached
    for (const m of [t.ma, t.mb]) {
      expect(m.getCell('start')?.value).toBe('Begin');
      expect(m.getCell('start')?.geometry?.x).toBe(5);
      expect(m.getCell('child')).toBeFalsy();
      expect(m.getCell('new')?.value).toBe('New');
    }
    expect(docToFile(t.b)).toEqual(docToFile(t.a));
  });
});
