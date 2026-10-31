import * as Y from 'yjs';
import { describe, expect, it } from 'vitest';
import { GraphDataModel } from '@maxgraph/core';
import { insertCopies } from '@/lib/collab/cellEdits';
import { YGraphBinding } from '@/lib/collab/yGraphBinding';
import { parseDrawio } from '@/lib/drawio/codec';
import { cellFromY, loadFileIntoDoc, pagesOf, sortedPageIds } from '@/lib/drawio/ydoc';
import { cellsFromText } from '@/lib/graph/clipboard';

const MODEL = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
<object label="A" owner="alice" id="a"><mxCell style="rounded=1;custom=x;" vertex="1" parent="1"><mxGeometry x="10" y="20" width="80" height="40" as="geometry"/></mxCell></object>
<mxCell id="b" value="B" vertex="1" parent="1"><mxGeometry x="200" y="20" width="80" height="40" as="geometry"/></mxCell>
<mxCell id="c" value="child" vertex="1" parent="b"><mxGeometry x="5" y="5" width="20" height="10" as="geometry"/></mxCell>
<mxCell id="e" edge="1" parent="1" source="a" target="b"><mxGeometry relative="1" as="geometry"><Array as="points"><mxPoint x="150" y="0"/></Array></mxGeometry></mxCell>
</root></mxGraphModel>`;

describe('cellsFromText', () => {
  it('reads diagrams.net clipboard XML, dropping root and layers', () => {
    const cells = cellsFromText(MODEL)!;
    expect(cells.map((c) => c.id).sort()).toEqual(['a', 'b', 'c', 'e']);
    expect(cells.find((c) => c.id === 'a')).toMatchObject({ parent: undefined, objAttrs: { owner: 'alice' } });
    expect(cells.find((c) => c.id === 'c')?.parent).toBe('b');
  });

  it('accepts URL-encoded XML and rejects other text', () => {
    expect(cellsFromText(encodeURIComponent(MODEL))).toHaveLength(4);
    expect(cellsFromText('just some text')).toBeNull();
    expect(cellsFromText('<mxGraphModel><broken')).toBeNull();
  });
});

describe('insertCopies', () => {
  function setup() {
    const doc = new Y.Doc();
    loadFileIntoDoc(doc, parseDrawio(MODEL));
    const page = pagesOf(doc).get(sortedPageIds(doc)[0])!;
    const model = new GraphDataModel();
    return { model, binding: new YGraphBinding(model, page) };
  }

  it('gives copies new ids, re-maps connections and children, and offsets top-level geometry', () => {
    const { model, binding } = setup();
    const top = insertCopies(binding, cellsFromText(MODEL)!, '1', 10, 10);
    expect(top).toHaveLength(3); // a, b and the edge; the child stays inside b's copy
    const copies = top.map((id) => cellFromY(id, binding.cells.get(id)!));
    const [a, b, e] = ['a', 'b', 'e'].map((orig) => copies.find((c) => c.id !== orig && (c.value === orig.toUpperCase() || (orig === 'e' && c.edge)))!);
    expect(a.objAttrs).toEqual({ owner: 'alice' });
    expect(a.style).toBe('rounded=1;custom=x;');
    expect(a.geometry).toMatchObject({ x: 20, y: 30 });
    expect(e).toMatchObject({ source: a.id, target: b.id });
    expect(e.geometry?.points).toEqual([{ x: 160, y: 10 }]);
    // The child copy is parented to b's copy, with its relative position unchanged.
    const child = [...binding.cells.keys()].map((id) => cellFromY(id, binding.cells.get(id)!)).find((c) => c.parent === b.id)!;
    expect(child).toMatchObject({ value: 'child', geometry: { x: 5, y: 5 } });
    // And the copies appear in the maxGraph model.
    expect(model.getCell(a.id)?.value).toBe('A');
    expect(model.getCell(e.id)?.source?.id).toBe(a.id);
  });
});
