import { describe, expect, it } from 'vitest';
import { Cell, Graph, StencilShapeRegistry, type StencilShape } from '@maxgraph/core';
import { parseDrawio } from '@/lib/drawio/codec';
import { toCellStyle } from '@/lib/drawio/style';
import { frcWiringTemplate } from '@/lib/frcTemplate';
import { parsePointsStyle } from '@/lib/graph/createGraph';
import { swapDevice, variantOf } from '@/lib/graph/deviceVariant';
import { PALETTES } from '@/lib/graph/palette';
import { device } from '@/lib/graph/palettes/device';
import { FRC_PALETTES, frcDevice, frcVariants } from '@/lib/graph/palettes/frc';
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

describe('Kraken PowerPole adapter toggle', () => {
  it('is not a separate palette entry', () => {
    const ids = FRC_PALETTES.flatMap((p) => p.items).map((i) => i.id);
    expect(ids).toContain('frc-kraken-x60');
    expect(ids.filter((i) => i.includes('powerpole'))).toEqual([]);
  });

  it('swaps the layout and moves attached wires onto the matching terminals, and back', () => {
    const graph = new Graph(document.createElement('div'));
    const base = frcDevice('kraken-x60');
    const adapter = frcDevice('kraken-x60-powerpole');
    const pin = (d: typeof base, name: string) => d.pins.find((p) => p.name === name)!;
    const wireStyle = (p: { x: number; y: number }) => `exitX=${p.x};exitY=${p.y};exitDx=0;exitDy=0;exitPerimeter=0;`;
    const model = graph.getDataModel();
    const parent = graph.getDefaultParent();
    let kraken!: Cell;
    let wire!: Cell;
    model.beginUpdate();
    try {
      kraken = graph.insertVertex({ parent, value: base.value, position: [100, 100], size: [base.width, base.height], style: toCellStyle(base.style) });
      const other = graph.insertVertex({ parent, value: '', position: [0, 0], size: [20, 20] });
      wire = graph.insertEdge({ parent, source: kraken, target: other, style: toCellStyle(wireStyle(pin(base, 'CAN H'))) });
    } finally {
      model.endUpdate();
    }
    const style = () => kraken.style as Record<string, unknown>;
    expect(variantOf(style())?.alternate).toBe('kraken-x60-powerpole');

    swapDevice(graph, kraken, style());
    expect(kraken.value).toBe(adapter.value);
    expect(kraken.geometry!.width).toBe(adapter.width);
    // Stays centered, on the grid.
    expect(kraken.geometry!.x + adapter.width / 2).toBe(100 + base.width / 2);
    expect(parsePointsStyle(style().points)!.length).toBe(adapter.pins.length);
    const es = wire.style as Record<string, unknown>;
    expect([es.exitX, es.exitY]).toEqual([pin(adapter, 'CAN in H').x, pin(adapter, 'CAN in H').y]);

    swapDevice(graph, kraken, style());
    expect(kraken.value).toBe(base.value);
    expect(kraken.geometry!.width).toBe(base.width);
    const back = wire.style as Record<string, unknown>;
    expect([back.exitX, back.exitY]).toEqual([pin(base, 'CAN H').x, pin(base, 'CAN H').y]);
  });
});

describe('swerve module blocks', () => {
  const modelIds = ['swerve-x', 'swerve-xs', 'swerve-x2', 'swerve-x2i', 'swerve-x2t', 'swerve-x2s', 'swerve-x2st'];

  it('are in the palette, one per WCP module', () => {
    const ids = FRC_PALETTES.flatMap((p) => p.items).map((i) => i.id);
    for (const id of modelIds) expect(ids, id).toContain(`frc-${id}`);
    expect(ids.filter((i) => i.startsWith('frc-swerve'))).toHaveLength(modelIds.length);
  });

  it('toggle to the PowerPole layout and turn a quarter at a time, always onto terminals that exist', () => {
    for (const model of modelIds) {
      for (const powerpole of ['', '-powerpole']) {
        for (const turn of ['', '-r1', '-r2', '-r3']) {
          const id = `${model}${powerpole}${turn}`;
          const source = frcDevice(id);
          const variants = frcVariants(id);
          expect(variants.map((v) => v.kind), id).toEqual(['toggle', 'step']);
          for (const variant of variants) {
            const target = frcDevice(variant.alternate);
            // Every terminal maps to one that exists on the other layout.
            for (const pin of source.pins) expect(target.pins.map((p) => p.name), `${id} ${pin.name}`).toContain(variant.pinMap[pin.name]);
          }
          // Four turns come back to the start.
          let at = id;
          for (let i = 0; i < 4; i++) at = frcVariants(at)[1].alternate;
          expect(at, id).toBe(id);
        }
      }
    }
  });

  it('keep every terminal inside the block, on the grid, with the same wiring however it is turned', () => {
    for (const turn of ['', '-r1', '-r2', '-r3']) {
      const d = frcDevice(`swerve-x2i${turn}`);
      expect(d.pins.map((p) => p.name).sort()).toEqual(frcDevice('swerve-x2i').pins.map((p) => p.name).sort());
      for (const p of d.pins) {
        expect(p.x, `${turn} ${p.name}`).toBeGreaterThan(0);
        expect(p.x, `${turn} ${p.name}`).toBeLessThan(1);
        expect(p.y, `${turn} ${p.name}`).toBeGreaterThan(0);
        expect(p.y, `${turn} ${p.name}`).toBeLessThan(1);
        expect(offGrid(p.x * d.width), `${turn} ${p.name} x`).toBeLessThan(0.01);
        expect(offGrid(p.y * d.height), `${turn} ${p.name} y`).toBeLessThan(0.01);
      }
    }
    // A quarter turn swaps the block's width and height.
    expect([frcDevice('swerve-x2i-r1').width, frcDevice('swerve-x2i-r1').height]).toEqual([frcDevice('swerve-x2i').height, frcDevice('swerve-x2i').width]);
  });

  it('mirror left to right: azimuth terminals match the drive ones, and the encoder is centered', () => {
    for (const powerpole of ['', '-powerpole']) {
      const d = frcDevice(`swerve-x2i${powerpole}`);
      const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
      const drive = d.pins.filter((p) => p.name.startsWith('DRIVE '));
      expect(drive.length).toBeGreaterThanOrEqual(4);
      for (const p of drive) {
        const twin = d.pins.find((q) => q.name === p.name.replace('DRIVE ', 'AZIMUTH '))!;
        expect(near(twin.x, 1 - p.x) && near(twin.y, p.y), `${p.name} ${powerpole}`).toBe(true);
      }
      const enc = d.pins.filter((p) => p.name.startsWith('CANcoder '));
      expect(near(enc.reduce((sum, p) => sum + p.x, 0) / enc.length, 0.5)).toBe(true);
    }
  });

  it('draw terminal text in the canvas color (so dark mode shows it) and text on the cover in dark ink', () => {
    const d = frcDevice('swerve-x2i');
    expect(toCellStyle(d.style).fontColor).toBe('#000000');
  });
});
