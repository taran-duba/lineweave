import type { Cell, Graph } from '@maxgraph/core';

export type Align = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

const movable = (graph: Graph) => graph.getSelectionCells().filter((c) => c.isVertex() && graph.isCellMovable(c));

export function alignSelection(graph: Graph, align: Align): void {
  const cells = movable(graph);
  if (cells.length > 1) graph.alignCells(align, cells);
}

/** Spreads shapes so the gaps between their centers are equal (the outermost two stay put). */
export function distributeSelection(graph: Graph, axis: 'horizontal' | 'vertical'): void {
  const cells = movable(graph).filter((c) => c.geometry);
  if (cells.length < 3) return;
  const center = (c: Cell) => (axis === 'horizontal' ? c.geometry!.x + c.geometry!.width / 2 : c.geometry!.y + c.geometry!.height / 2);
  const sorted = [...cells].sort((a, b) => center(a) - center(b));
  const first = center(sorted[0]);
  const step = (center(sorted.at(-1)!) - first) / (sorted.length - 1);
  const model = graph.getDataModel();
  graph.batchUpdate(() => {
    sorted.forEach((c, i) => {
      const geo = c.geometry!.clone();
      const target = first + step * i;
      if (axis === 'horizontal') geo.x = Math.round(target - geo.width / 2);
      else geo.y = Math.round(target - geo.height / 2);
      model.setGeometry(c, geo);
    });
  });
}

const styleOf = (c: Cell) => (c.style ?? {}) as Record<string, unknown>;
const flag = (v: unknown) => v === 1 || v === '1' || v === true;

export function rotateSelection(graph: Graph, degrees: number): void {
  const cells = graph.getSelectionCells().filter((c) => c.isVertex() && !graph.isCellLocked(c));
  graph.batchUpdate(() => {
    for (const c of cells) {
      const next = (((Number(styleOf(c).rotation ?? 0) + degrees) % 360) + 360) % 360;
      graph.setCellStyles('rotation', next || undefined, [c]);
    }
  });
}

export function flipSelection(graph: Graph, key: 'flipH' | 'flipV'): void {
  const cells = graph.getSelectionCells().filter((c) => c.isVertex() && !graph.isCellLocked(c));
  graph.batchUpdate(() => {
    for (const c of cells) graph.setCellStyles(key, flag(styleOf(c)[key]) ? undefined : 1, [c]);
  });
}

export function isLocked(cell: Cell): boolean {
  return flag(styleOf(cell).locked);
}

/** Locks all selected cells, or unlocks them if they're all locked already. */
export function toggleLockSelection(graph: Graph): void {
  const cells = graph.getSelectionCells();
  if (!cells.length) return;
  const unlock = cells.every(isLocked);
  graph.setCellStyles('locked' as never, (unlock ? undefined : 1) as never, cells);
}
