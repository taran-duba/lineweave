import { ConnectorShape, InternalEvent, Point, ShapeRegistry, type AbstractCanvas2D, type Cell, type Graph } from '@maxgraph/core';

/**
 * draw.io line jumps (`jumpStyle=arc|gap|sharp;jumpSize=6`): where a connector
 * crosses one drawn below it, it hops over (arc), breaks (gap) or kinks
 * (sharp). Implemented as a drop-in replacement for the built-in connector
 * shape, so styles without jumpStyle render exactly as before.
 */

type Seg = [Point, Point];

/** Edges in paint (z) order, cached per model change. */
const zOrder = new WeakMap<Graph, Map<Cell, number>>();

function edgeOrder(graph: Graph): Map<Cell, number> {
  let order = zOrder.get(graph);
  if (!order) {
    order = new Map();
    let i = 0;
    const visit = (c: Cell) => {
      if (c.isEdge()) order!.set(c, i++);
      for (const child of c.children) visit(child);
    };
    const root = graph.getDataModel().root;
    if (root) visit(root);
    zOrder.set(graph, order);
  }
  return order;
}

/** Intersection parameter t on segment a (0..1), or null. */
function intersect([a1, a2]: Seg, [b1, b2]: Seg): number | null {
  const d = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((b1.x - a1.x) * (b2.y - b1.y) - (b1.y - a1.y) * (b2.x - b1.x)) / d;
  const u = ((b1.x - a1.x) * (a2.y - a1.y) - (b1.y - a1.y) * (a2.x - a1.x)) / d;
  return t > 0 && t < 1 && u > 0 && u < 1 ? t : null;
}

export class JumpConnectorShape extends ConnectorShape {
  paintLine(c: AbstractCanvas2D, pts: Point[], rounded?: boolean): void {
    const style = this.style as Record<string, unknown> | null;
    const jump = String(style?.jumpStyle ?? 'none');
    const state = this.state;
    if (jump === 'none' || !state || pts.length < 2) return super.paintLine(c, pts, rounded);

    const graph = state.view.graph as Graph;
    const s = this.scale || 1;
    const size = Number(style?.jumpSize ?? 6);
    const order = edgeOrder(graph);
    const mine = order.get(state.cell) ?? Infinity;

    // Segments of every connector painted below this one.
    const below: Seg[] = [];
    for (const [cell, idx] of order) {
      if (idx >= mine) continue;
      const pts2 = graph.view.getState(cell)?.absolutePoints;
      if (!pts2) continue;
      for (let i = 1; i < pts2.length; i++) {
        const p = pts2[i - 1];
        const q = pts2[i];
        if (p && q) below.push([new Point(p.x / s, p.y / s), new Point(q.x / s, q.y / s)]);
      }
    }

    c.begin();
    c.moveTo(pts[0].x, pts[0].y);
    let crossed = false;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (!len) continue;
      const half = size / 2 / len;
      const ts = below
        .map((seg) => intersect([a, b], seg))
        .filter((t): t is number => t !== null && t > half && t < 1 - half)
        .sort((x, y) => x - y);
      const at = (t: number) => new Point(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      let last = -Infinity;
      for (const t of ts) {
        if (t - half <= last) continue; // overlapping crossings: one jump covers both
        crossed = true;
        const p0 = at(t - half);
        const p1 = at(t + half);
        c.lineTo(p0.x, p0.y);
        if (jump === 'gap') {
          c.moveTo(p1.x, p1.y);
        } else if (jump === 'sharp') {
          // Kink to the left of the travel direction.
          const nx = (a.y - b.y) / len;
          const ny = (b.x - a.x) / len;
          const m = at(t);
          c.lineTo(m.x + nx * size * 0.75, m.y + ny * size * 0.75);
          c.lineTo(p1.x, p1.y);
        } else {
          c.arcTo(size / 2, size / 2, 0, false, true, p1.x, p1.y);
        }
        last = t + half;
      }
      c.lineTo(b.x, b.y);
    }
    if (!crossed) return super.paintLine(c, pts, rounded);
    c.stroke();
  }
}

let registered = false;

/** Replaces the default connector and keeps jumps current as other edges move. */
export function installLineJumps(graph: Graph): () => void {
  if (!registered) {
    ShapeRegistry.add('connector', JumpConnectorShape);
    registered = true;
  }
  const model = graph.getDataModel();
  const onChange = () => {
    zOrder.delete(graph);
    // Moving one edge can add or remove a crossing on another: redraw jumpers.
    for (const state of graph.view.getStates().values()) {
      const jump = (state.style as Record<string, unknown> | undefined)?.jumpStyle;
      if (state.cell.isEdge() && jump && jump !== 'none') state.shape?.redraw();
    }
  };
  model.addListener(InternalEvent.CHANGE, onChange);
  return () => model.removeListener(onChange);
}
