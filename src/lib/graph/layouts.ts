import {
  CircleLayout,
  CompactTreeLayout,
  FastOrganicLayout,
  HierarchicalLayout,
  RadialTreeLayout,
  type Cell,
  type Graph,
} from '@maxgraph/core';

/** The automatic layouts draw.io offers under Arrange → Layout. */
export const LAYOUTS = [
  { id: 'verticalFlow', label: 'Vertical flow' },
  { id: 'horizontalFlow', label: 'Horizontal flow' },
  { id: 'verticalTree', label: 'Vertical tree' },
  { id: 'horizontalTree', label: 'Horizontal tree' },
  { id: 'radialTree', label: 'Radial tree' },
  { id: 'circle', label: 'Circle' },
  { id: 'organic', label: 'Organic' },
] as const;

export type LayoutId = (typeof LAYOUTS)[number]['id'];

/** Tree layouts need a root: the selected shape, else the first shape with no incoming edges. */
function treeRoot(graph: Graph, parent: Cell): Cell | null {
  const selected = graph.getSelectionCells().find((c) => c.isVertex() && c.parent === parent);
  if (selected) return selected;
  const vertices = parent.children.filter((c) => c.isVertex());
  const incoming = (v: Cell) => v.edges.filter((e) => e.target === v && e.source && e.source !== v).length;
  const outgoing = (v: Cell) => v.edges.filter((e) => e.source === v && e.target && e.target !== v).length;
  const roots = vertices.filter((v) => incoming(v) === 0).sort((a, b) => outgoing(b) - outgoing(a));
  return roots[0] ?? vertices[0] ?? null;
}

/**
 * Lays out the shapes in the selection's container (or the whole page).
 * Runs as one model update, so it syncs to collaborators and undoes in one step.
 * Returns false when there was nothing to lay out.
 */
export function applyLayout(graph: Graph, id: LayoutId): boolean {
  const first = graph.getSelectionCell();
  const parent = first && first.parent && first.parent !== graph.getDataModel().root ? first.parent : graph.getDefaultParent();
  if (!parent.children.some((c) => c.isVertex())) return false;

  graph.batchUpdate(() => {
    switch (id) {
      case 'verticalFlow':
      case 'horizontalFlow': {
        const layout = new HierarchicalLayout(graph, id === 'verticalFlow' ? 'north' : 'west');
        // Keep each connector's own routing style instead of writing noEdgeStyle into the file.
        layout.disableEdgeStyle = false;
        layout.intraCellSpacing = 50;
        layout.interRankCellSpacing = 80;
        layout.execute(parent);
        break;
      }
      case 'verticalTree':
      case 'horizontalTree': {
        const root = treeRoot(graph, parent);
        if (!root) return;
        const layout = new CompactTreeLayout(graph, id === 'horizontalTree');
        layout.levelDistance = 40;
        layout.nodeDistance = 30;
        layout.edgeRouting = false;
        layout.execute(parent, root);
        break;
      }
      case 'radialTree': {
        const root = treeRoot(graph, parent);
        if (!root) return;
        const layout = new RadialTreeLayout(graph);
        layout.levelDistance = 100;
        layout.execute(parent, root);
        break;
      }
      case 'circle': {
        const layout = new CircleLayout(graph);
        layout.disableEdgeStyle = false;
        layout.execute(parent);
        break;
      }
      case 'organic': {
        const layout = new FastOrganicLayout(graph);
        layout.disableEdgeStyle = false;
        layout.forceConstant = 80;
        layout.execute(parent);
        break;
      }
    }
    // Flow layouts route connectors around shapes with waypoints; keep those. The
    // others don't route, so stale waypoints from earlier edits would look broken.
    if (id === 'verticalFlow' || id === 'horizontalFlow') return;
    const model = graph.getDataModel();
    for (const edge of parent.children) {
      if (!edge.isEdge() || !edge.geometry?.points?.length) continue;
      const style = graph.getCellStyle(edge) as Record<string, unknown>;
      if (!style.edgeStyle) continue;
      const geo = edge.geometry.clone();
      geo.points = [];
      model.setGeometry(edge, geo);
    }
  });
  return true;
}
