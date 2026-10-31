import { describe, expect, it } from 'vitest';
import { Cell, StencilShapeRegistry, type StencilShape } from '@maxgraph/core';
import { parseDrawio } from '@/lib/drawio/codec';
import { toCellStyle } from '@/lib/drawio/style';
import { frcWiringTemplate } from '@/lib/frcTemplate';
import { parsePointsStyle } from '@/lib/graph/createGraph';
import { PALETTES } from '@/lib/graph/palette';
import { device } from '@/lib/graph/palettes/device';
import { FRC_PALETTES, frcDevice } from '@/lib/graph/palettes/frc';
import { registerElectricalStencils } from '@/lib/graph/stencils';
import { isSchematicCell, schematicConnectorStyle } from '@/lib/graph/wires';

const count = registerElectricalStencils();
const pointsOf = (style: string | undefined) => (toCellStyle(style) as Record<string, unknown>).points;
const offGrid = (v: number) => Math.abs(v - Math.round(v / 10) * 10);
const vertexWith = (style: string) => Object.assign(new Cell('', undefined, toCellStyle(style)), { vertex: true });

describe('electrical stencils', () => {
  it('register every draw.io electrical shape under its diagrams.net name', () => {
    expect(count).toBeGreaterThan(400);
    const resistor = StencilShapeRegistry.get('mxgraph.electrical.resistors.resistor_2') as StencilShape;
    expect(resistor).toBeTruthy();
    // Terminals at both leads, so wires snap to them.
    expect(resistor.constraints.map((c) => [c.point!.x, c.point!.y])).toEqual([[0, 0.5], [1, 0.5]]);
  });

  it('cover every electrical shape the palettes use', () => {
    const shapes = PALETTES.flatMap((p) => p.items)
      .map((i) => toCellStyle(i.style).shape as string | undefined)
      .filter((s): s is string => !!s?.startsWith('mxgraph.electrical.'));
    expect(shapes.length).toBeGreaterThan(50);
    for (const s of shapes) expect(StencilShapeRegistry.get(s), s).toBeTruthy();
  });
});

describe('points style', () => {
  it('reads draw.io fixed connection points, including none', () => {
    const pts = parsePointsStyle('[[0,0.5,0],[1,0.25],[0.5,1,1,4,-2]]')!;
    expect(pts.map((c) => [c.point!.x, c.point!.y, c.perimeter, c.dx, c.dy])).toEqual([
      [0, 0.5, false, 0, 0],
      [1, 0.25, true, 0, 0],
      [0.5, 1, true, 4, -2],
    ]);
    expect(parsePointsStyle('[]')).toEqual([]);
    expect(parsePointsStyle(undefined)).toBeNull();
    expect(parsePointsStyle('not json')).toBeNull();
  });
});

describe('FRC device blocks', () => {
  it('put a labeled connection point at every terminal, on the grid', () => {
    for (const item of FRC_PALETTES.flatMap((p) => p.items).filter((i) => 'pins' in i)) {
      const d = frcDevice(item.id.replace(/^frc-/, ''));
      const points = parsePointsStyle(pointsOf(d.style))!;
      expect(points.length, d.id).toBe(d.pins.length);
      for (const p of d.pins) {
        // Grouped top/bottom terminals print their short name under the group caption ("CAN 0" over "H").
        const shown = (label: string) => d.value!.includes(`>${label.replace(/&/g, '&amp;')}</span>`);
        expect(shown(p.name) || shown(p.name.split(' ').pop()!), `${d.id} ${p.name}`).toBe(true);
        // Blocks are inserted on the 10px grid, so terminals on it give straight wires.
        expect(offGrid(p.x * d.width), `${d.id} ${p.name} x`).toBeLessThan(0.01);
        expect(offGrid(p.y * d.height), `${d.id} ${p.name} y`).toBeLessThan(0.01);
      }
      expect(d.width % 20, d.id).toBe(0);
    }
  });

  it('grow to fit their labels and escape markup', () => {
    const d = device({ id: 'x', title: 'A <b>very</b> long device title', colors: ['#fff', '#000'], pins: { left: ['<in>'], top: ['1', '2', '3', '4', '5', '6', '7', '8'] } });
    expect(d.width).toBeGreaterThanOrEqual(160);
    expect(d.value).toContain('&lt;in&gt;');
    expect(d.value).not.toContain('<in>');
  });
});

describe('wires', () => {
  it('are plain wires between electrical parts and arrows elsewhere', () => {
    const resistor = vertexWith('shape=mxgraph.electrical.resistors.resistor_2;');
    const block = vertexWith(frcDevice('spark-max').style);
    const box = vertexWith('rounded=1;');
    expect(isSchematicCell(resistor)).toBe(true);
    expect(isSchematicCell(block)).toBe(true);
    expect(isSchematicCell(box)).toBe(false);
    expect(schematicConnectorStyle(box, resistor)).toContain('endArrow=none');
    expect(schematicConnectorStyle(box, null)).toBeNull();
  });
});

describe('FRC wiring template', () => {
  it('connects every wire to a real terminal of an existing block', () => {
    const page = parseDrawio(frcWiringTemplate()).pages[0];
    const byId = new Map(page.cells.map((c) => [c.id, c]));
    const wires = page.cells.filter((c) => c.source && c.target);
    expect(wires.length).toBeGreaterThan(20);
    for (const w of wires) {
      const style = toCellStyle(w.style);
      for (const [end, x, y] of [[w.source!, style.exitX, style.exitY], [w.target!, style.entryX, style.entryY]] as const) {
        const cell = byId.get(end)!;
        const points = parsePointsStyle(pointsOf(cell.style)) ?? [{ point: { x: 0, y: 0.5 } }, { point: { x: 1, y: 0.5 } }];
        expect(points.some((p) => p.point!.x === x && p.point!.y === y), `${w.id} -> ${end} at ${x},${y}`).toBe(true);
      }
    }
  });
});
