import type { Cell, CellStateStyle, Graph } from '@maxgraph/core';

/**
 * On the dark (black) canvas, default black lines and text would vanish. Like
 * draw.io's dark mode, we swap them to a light color *for display only*: the
 * swap happens when maxGraph resolves a cell's style for rendering, so the
 * stored style (and the saved .drawio file) never changes. Filled shapes keep
 * their black text and outlines, which stay readable on their fill.
 */

const LIGHT = '#dedede';
const CANVAS = '#000000';
const STROKE_ONLY_SHAPES = new Set(['line', 'umlActor']);

const norm = (v: unknown) => (v == null ? '' : String(v).toLowerCase());
const isBlack = (v: unknown) => ['', '#000000', '#000', 'black', 'default'].includes(norm(v));
const isWhite = (v: unknown) => ['#ffffff', '#fff', 'white', 'default'].includes(norm(v));
const isNone = (v: unknown) => ['none', 'transparent'].includes(norm(v));

export function adaptStyleForDark(style: CellStateStyle, cell: Cell): CellStateStyle {
  const s = { ...style } as Record<string, unknown>;
  if (cell.isEdge()) {
    if (isBlack(s.strokeColor)) s.strokeColor = LIGHT;
    if (isBlack(s.fontColor)) s.fontColor = LIGHT;
    if (isWhite(s.labelBackgroundColor)) s.labelBackgroundColor = CANVAS;
  } else if (cell.isVertex()) {
    const unfilled = isNone(s.fillColor);
    // Labels drawn outside the shape sit directly on the canvas.
    const labelOutside =
      ['top', 'bottom'].includes(norm(s.verticalLabelPosition)) || ['left', 'right'].includes(norm(s.labelPosition));
    // Schematic symbols are line art: white paper fill becomes canvas, so the symbol reads as light lines.
    const lineArt = norm(s.shape).startsWith('mxgraph.electrical.') || norm(s.fillColor) === 'strokecolor';
    if (lineArt && isBlack(s.strokeColor) && (isWhite(s.fillColor) || s.fillColor == null)) s.fillColor = CANVAS;
    if ((unfilled || lineArt || STROKE_ONLY_SHAPES.has(norm(s.shape))) && isBlack(s.strokeColor)) s.strokeColor = LIGHT;
    if ((unfilled || labelOutside) && isBlack(s.fontColor)) s.fontColor = LIGHT;
  }
  return s as CellStateStyle;
}

const rawStyle = new WeakMap<Graph, (cell: Cell) => CellStateStyle>();
const suspended = new WeakSet<Graph>();

/** Installs the adaptation; it follows the OS/browser color scheme live. Returns an uninstall function. */
export function installDarkCanvas(graph: Graph): () => void {
  const raw = graph.getCellStyle.bind(graph);
  rawStyle.set(graph, raw);
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  let dark = mq.matches;
  graph.getCellStyle = (cell: Cell) => {
    const style = raw(cell);
    return dark && !suspended.has(graph) ? adaptStyleForDark(style, cell) : style;
  };
  const onChange = () => {
    dark = mq.matches;
    graph.refresh();
  };
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** The cell's real (stored) style, ignoring any display adaptation. */
export function storedCellStyle(graph: Graph, cell: Cell): CellStateStyle {
  return (rawStyle.get(graph) ?? graph.getCellStyle.bind(graph))(cell);
}

/** Runs `fn` with the graph rendered in its true colors (for exports). */
export function withTrueColors<T>(graph: Graph, fn: () => T): T {
  if (!rawStyle.has(graph) || !window.matchMedia('(prefers-color-scheme: dark)').matches) return fn();
  suspended.add(graph);
  graph.refresh();
  try {
    return fn();
  } finally {
    suspended.delete(graph);
    graph.refresh();
  }
}
