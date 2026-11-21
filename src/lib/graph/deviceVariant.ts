import type { Cell, Graph } from '@maxgraph/core';
import { toCellStyle } from '@/lib/drawio/style';
import { frcDevice, frcVariants } from './palettes/frc';

/** The alternate layouts a cell's device block can switch to (the `frc-` prefix dropped from its id), if any. */
export function variantsOf(style: Record<string, unknown>) {
  const id = typeof style.device === 'string' ? style.device.replace(/^frc-/, '') : '';
  return frcVariants(id).map((variant) => ({ id, ...variant }));
}

/** The first alternate layout, if the block has one. */
export function variantOf(style: Record<string, unknown>) {
  return variantsOf(style)[0] ?? null;
}

const same = (a: unknown, b: number) => Math.abs(Number(a) - b) < 0.001;

/**
 * Swaps a device block to its alternate terminal layout (new labels, connection points and size, kept centered)
 * and moves wires attached to it onto the matching terminals. One undoable change.
 */
export function swapDevice(graph: Graph, cell: Cell, style: Record<string, unknown>, which = 0): void {
  const current = variantsOf(style)[which];
  if (!current || !cell.geometry) return;
  const from = frcDevice(current.id);
  const to = frcDevice(current.alternate);
  const target = toCellStyle(to.style) as Record<string, unknown>;
  const model = graph.getDataModel();
  graph.batchUpdate(() => {
    model.setValue(cell, to.value);
    graph.setCellStyles('points' as never, target.points as never, [cell]);
    graph.setCellStyles('device' as never, target.device as never, [cell]);
    const g = cell.geometry!.clone();
    const centerX = g.x + g.width / 2;
    const centerY = g.y + g.height / 2;
    g.width = to.width;
    g.height = to.height;
    g.x = Math.round((centerX - to.width / 2) / 10) * 10;
    g.y = Math.round((centerY - to.height / 2) / 10) * 10;
    model.setGeometry(cell, g);
    for (const edge of cell.edges) {
      const ends = [
        [edge.source === cell, 'exit'],
        [edge.target === cell, 'entry'],
      ] as const;
      for (const [attached, key] of ends) {
        if (!attached) continue;
        const es = edge.style as Record<string, unknown>;
        const old = from.pins.find((p) => same(es[`${key}X`], p.x) && same(es[`${key}Y`], p.y));
        const next = old && to.pins.find((p) => p.name === current.pinMap[old.name]);
        if (!next) continue;
        graph.setCellStyles(`${key}X` as never, next.x as never, [edge]);
        graph.setCellStyles(`${key}Y` as never, next.y as never, [edge]);
      }
    }
  });
}
