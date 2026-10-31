import { LayoutManager, StackLayout, type Cell, type Graph } from '@maxgraph/core';

/**
 * draw.io's `childLayout=stackLayout`: containers (UML classes, ER entities,
 * lists) whose children stack and stretch automatically as rows are added,
 * removed or resized. Supports draw.io's stack keys (horizontalStack,
 * resizeParent, resizeParentMax, resizeLast, margins, stackSpacing, ...).
 */
export function installChildLayouts(graph: Graph): () => void {
  const flag = (v: unknown, fallback: boolean) => (v === undefined || v === null || v === '' ? fallback : v === 1 || v === '1' || v === true);
  const n = (v: unknown, fallback = 0) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : fallback);
  const manager = new LayoutManager(graph);
  manager.getLayout = (cell: Cell | null) => {
    if (!cell || !cell.children.length) return null;
    const style = graph.getCellStyle(cell) as Record<string, unknown>;
    if (style.childLayout !== 'stackLayout') return null;
    const layout = new StackLayout(graph, true);
    layout.horizontal = flag(style.horizontalStack, true);
    layout.resizeParent = flag(style.resizeParent, true);
    layout.resizeParentMax = flag(style.resizeParentMax, false);
    layout.resizeLast = flag(style.resizeLast, false);
    layout.fill = true;
    layout.allowGaps = flag(style.allowGaps, false);
    layout.spacing = n(style.stackSpacing);
    layout.border = n(style.stackBorder);
    layout.marginTop = n(style.marginTop);
    layout.marginLeft = n(style.marginLeft);
    layout.marginRight = n(style.marginRight);
    layout.marginBottom = n(style.marginBottom);
    layout.gridSize = n(style.stackUnitSize);
    return layout;
  };
  return () => manager.destroy();
}
