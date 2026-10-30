import type { Cell, CellStateStyle, Graph } from '@maxgraph/core';

export type StyleKey = keyof CellStateStyle;
export type StyleRecord = Record<string, unknown>;

/** Sets one style key on cells; null removes it (so the saved style string stays tidy). */
export function setStyle(graph: Graph, cells: Cell[], key: string, value: unknown): void {
  graph.setCellStyles(key as StyleKey, (value === null ? undefined : value) as never, cells);
}

/** Sets several keys as one undoable change. */
export function setStyles(graph: Graph, cells: Cell[], values: Record<string, unknown>): void {
  graph.batchUpdate(() => {
    for (const [k, v] of Object.entries(values)) setStyle(graph, cells, k, v);
  });
}
