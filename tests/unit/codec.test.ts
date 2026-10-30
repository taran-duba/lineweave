import { readFileSync } from 'node:fs';
import path from 'node:path';
import { deflateRaw } from 'pako';
import * as Y from 'yjs';
import { describe, expect, it } from 'vitest';
import { parseDrawio, serializeDrawio } from '@/lib/drawio/codec';
import { docToFile, loadFileIntoDoc } from '@/lib/drawio/ydoc';

const sample = readFileSync(path.join(__dirname, '../fixtures/sample.drawio'), 'utf8');

function compress(xml: string): string {
  const bytes = deflateRaw(new TextEncoder().encode(encodeURIComponent(xml)));
  return btoa(String.fromCharCode(...bytes));
}

describe('parseDrawio', () => {
  const file = parseDrawio(sample);
  const page = file.pages[0];
  const cell = (id: string) => page.cells.find((c) => c.id === id)!;

  it('reads pages, file and model attributes', () => {
    expect(file.pages.map((p) => p.name)).toEqual(['Overview', 'Details & notes']);
    expect(file.attrs.host).toBe('app.diagrams.net');
    expect(page.modelAttrs.pageWidth).toBe('850');
    expect(file.pages[1].modelAttrs.background).toBe('#FFFFFF');
  });

  it('reads vertices with raw style strings', () => {
    expect(cell('start')).toMatchObject({
      value: 'Start',
      vertex: true,
      parent: '1',
      style: 'ellipse;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;customThing=keep me;',
      geometry: { x: 120, y: 80, width: 120, height: 60 },
    });
  });

  it('reads <object> user data', () => {
    expect(cell('decide')).toMatchObject({
      objTag: 'object',
      value: 'Decide <b>now</b>',
      objAttrs: { owner: 'alice', priority: '2' },
      vertex: true,
    });
  });

  it('reads edges with waypoints, offsets and terminal points', () => {
    expect(cell('e1')).toMatchObject({
      edge: true,
      source: 'start',
      target: 'decide',
      geometry: { relative: true, points: [{ x: 180, y: 170 }, { x: 200, y: 170 }], offset: { x: -10, y: 5 } },
    });
    expect(cell('dangling').geometry).toMatchObject({ sourcePoint: { x: 300, y: 300 }, targetPoint: { x: 350, y: 250 } });
  });

  it('keeps unknown attributes and children', () => {
    expect(cell('grp').attrs).toEqual({ collapsed: '1' });
    expect(cell('grp').geometry?.extraChildren?.[0]).toContain('alternateBounds');
  });

  it('assigns increasing sibling order keys', () => {
    const siblings = page.cells.filter((c) => c.parent === '1').map((c) => c.order);
    expect([...siblings].sort()).toEqual(siblings);
  });

  it('decodes compressed diagrams', () => {
    const model = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="x" value="hi" vertex="1" parent="1"><mxGeometry width="10" height="10" as="geometry"/></mxCell></root></mxGraphModel>';
    const f = parseDrawio(`<mxfile compressed="true"><diagram id="d" name="P">${compress(model)}</diagram></mxfile>`);
    expect(f.pages[0].cells.find((c) => c.id === 'x')?.value).toBe('hi');
  });

  it('accepts a bare mxGraphModel and empty input', () => {
    expect(parseDrawio('<mxGraphModel><root><mxCell id="0"/></root></mxGraphModel>').pages).toHaveLength(1);
    expect(parseDrawio('').pages[0].cells).toHaveLength(2);
  });
});

describe('round trip', () => {
  it('parse → serialize → parse is lossless', () => {
    const once = parseDrawio(sample);
    const again = parseDrawio(serializeDrawio(once));
    expect(again).toEqual(once);
  });

  it('survives a trip through a Y.Doc', () => {
    const file = parseDrawio(sample);
    const doc = new Y.Doc();
    loadFileIntoDoc(doc, file);
    const back = docToFile(doc);
    const sortCells = (f: typeof file) => f.pages.map((p) => ({ ...p, cells: [...p.cells].sort((a, b) => a.id.localeCompare(b.id)) }));
    expect(sortCells(back)).toEqual(sortCells(file));
    expect(parseDrawio(serializeDrawio(back))).toEqual(file);
  });

  it('writes parents before children', () => {
    const xml = serializeDrawio(parseDrawio(sample));
    expect(xml.indexOf('id="grp"')).toBeLessThan(xml.indexOf('id="child"'));
    expect(xml.indexOf('<mxCell id="0"')).toBeLessThan(xml.indexOf('<mxCell id="1"'));
  });
});
