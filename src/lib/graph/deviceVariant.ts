import type { Cell, Graph } from '@maxgraph/core';
import { toCellStyle } from '@/lib/drawio/style';
import { FRC_VARIANTS, frcDevice } from './palettes/frc';

/** The device block id recorded in a cell's style (`frc-` prefix dropped), if it has a variant to toggle to. */
export function variantOf(style: Record<string, unknown>) {
  const id = typeof style.device === 'string' ? style.device.replace(/^frc-/, '') : '';
  const variant = FRC_VARIANTS[id];
  return variant ? { id, ...variant } : null;
}

const same = (a: unknown, b: number) => Math.abs(Number(a) - b) < 0.001;

/**
 * Swaps a device block to its alternate terminal layout (new labels, connection points and size, kept centered)
 * and moves wires attached to it onto the matching terminals. One undoable change.
 */
export function swapDevice(graph: Graph, cell: Cell, style: Record<string, unknown>): void {
  const current = variantOf(style);
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
    g.width = to.width;
    g.height = to.height;
    g.x = Math.round((centerX - to.width / 2) / 10) * 10;
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
