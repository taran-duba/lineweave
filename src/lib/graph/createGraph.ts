import {
  Cell,
  Client,
  EdgeHandlerConfig,
  HandleConfig,
  VertexHandlerConfig,
  ConnectionConstraint,
  Geometry,
  Guide,
  ImageBox,
  Point,
  Graph,
  InternalEvent,
  RubberBandHandler,
  getDefaultPlugins,
  type ConnectionHandler,
  type PanningHandler,
  type SelectionHandler,
} from '@maxgraph/core';
import { toCellStyle } from '@/lib/drawio/style';
import { DEFAULT_EDGE_STYLE } from './palette';
import { installChildLayouts } from './childLayouts';
import { installDarkCanvas } from './darkCanvas';
import { installLineJumps } from './lineJumps';
import { applyDrawioStylesheet, registerDrawioShapes } from './shapes';

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 8;

/** Creates a maxGraph instance configured to behave like the draw.io editor. */
/**
 * Selection looks like Google Slides: a solid blue outline with white square
 * handles that have a blue border, so resize handles stay easy to spot on both
 * the light and the dark canvas.
 */
const SELECTION_BLUE = '#1a73e8';
function configureSelectionStyle(): void {
  Object.assign(VertexHandlerConfig, {
    selectionColor: SELECTION_BLUE,
    selectionStrokeWidth: 2,
    selectionDashed: false,
    rotationEnabled: true,
  });
  Object.assign(EdgeHandlerConfig, {
    selectionColor: SELECTION_BLUE,
    selectionStrokeWidth: 2,
    selectionDashed: false,
    connectFillColor: SELECTION_BLUE,
    // Drag the faint midpoint handles of a straight connector to add waypoints.
    virtualBendsEnabled: true,
    virtualBendOpacity: 40,
  });
  Object.assign(HandleConfig, { fillColor: '#ffffff', strokeColor: SELECTION_BLUE, size: 9, labelFillColor: '#ffffff' });
  // Alignment guides while dragging, in a color distinct from selection.
  Guide.prototype.getGuideColor = () => '#e8336a';
}

/**
 * draw.io stores embedded images as `image=data:image/png,<base64>` (no
 * `;base64`, because `;` separates style keys) and restores it for display.
 */
export function displayImageUrl(image: unknown): unknown {
  if (typeof image !== 'string' || !image.startsWith('data:image/')) return image;
  const comma = image.indexOf(',');
  if (comma < 0 || image.slice(comma - 7, comma + 1) === ';base64,') return image;
  // SVG may be stored URL-encoded rather than base64; leave that as-is.
  const payload = image.slice(comma + 1);
  if (/^[A-Za-z0-9+/=\s]+$/.test(payload)) return `${image.slice(0, comma)};base64,${payload}`;
  return image;
}

/** `locked=1` (draw.io's lock) blocks moving, resizing, rotating, editing and deleting. */
function isLockedStyle(style: Record<string, unknown>): boolean {
  return style.locked === 1 || style.locked === '1' || style.locked === true;
}

// Connection points shown on hover, as in draw.io: drag from one to draw a connector.
const CONNECTION_POINTS = [
  [0.25, 0], [0.5, 0], [0.75, 0],
  [0, 0.25], [0, 0.5], [0, 0.75],
  [1, 0.25], [1, 0.5], [1, 0.75],
  [0.25, 1], [0.5, 1], [0.75, 1],
];
const POINT_IMAGE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><path d="M2 2 8 8M8 2 2 8" stroke="#2f6fed" stroke-width="1.6"/></svg>',
)}`;

export function createGraph(container: HTMLElement): { graph: Graph; destroy: () => void } {
  // Default handle/folding images ship with maxGraph; we serve them from /public.
  Client.imageBasePath = '/maxgraph/images';
  registerDrawioShapes();
  configureSelectionStyle();
  InternalEvent.disableContextMenu(container);
  const graph = new Graph(container, undefined, [...getDefaultPlugins(), RubberBandHandler]);
  applyDrawioStylesheet(graph.getStylesheet());

  graph.setHtmlLabels(true);
  graph.setConnectable(true);
  graph.setAllowDanglingEdges(true);
  graph.setDropEnabled(true);
  graph.setPanning(true);
  graph.setTooltips(false);
  graph.setGridEnabled(true);
  graph.gridSize = 10;
  graph.setCellsDisconnectable(false);
  // Clicking outside the in-place text editor commits the edit (draw.io behavior).
  graph.setInvokesStopCellEditing(true);

  graph.getAllConnectionConstraints = (terminal) =>
    terminal?.cell?.isVertex() && !terminal.cell.isEdge()
      ? CONNECTION_POINTS.map(([x, y]) => new ConnectionConstraint(new Point(x, y), true))
      : null;

  const baseStyle = graph.getCellStyle.bind(graph);
  graph.getCellStyle = (cell) => {
    const style = baseStyle(cell);
    const image = displayImageUrl(style.image);
    return image === style.image ? style : { ...style, image: image as string };
  };
  const baseLocked = graph.isCellLocked.bind(graph);
  // A cell is locked if it, or any container/layer above it, is locked.
  const lockedUp = (cell: Cell | null): boolean =>
    !!cell && (isLockedStyle(cell.style as Record<string, unknown>) || lockedUp(cell.parent));
  graph.isCellLocked = (cell) => baseLocked(cell) || lockedUp(cell);
  const baseDeletable = graph.isCellDeletable.bind(graph);
  graph.isCellDeletable = (cell) => baseDeletable(cell) && !lockedUp(cell);

  const selectionHandler = graph.getPlugin<SelectionHandler>('SelectionHandler');
  if (selectionHandler) selectionHandler.guidesEnabled = true;

  const connection = graph.getPlugin<ConnectionHandler>('ConnectionHandler');
  if (connection) {
    connection.constraintHandler.pointImage = new ImageBox(POINT_IMAGE, 10, 10);
    // Hover/target highlights in the same blue as selection (maxGraph defaults to green).
    connection.constraintHandler.highlightColor = SELECTION_BLUE;
    connection.marker.validColor = SELECTION_BLUE;
    connection.factoryMethod = () => {
      const edge = new Cell('', new Geometry(), toCellStyle(DEFAULT_EDGE_STYLE));
      edge.edge = true;
      edge.geometry!.relative = true;
      return edge;
    };
  }

  const cleanups = [
    installDarkCanvas(graph),
    installLineJumps(graph),
    installChildLayouts(graph),
    installGridBackground(graph),
    installWheelNavigation(graph),
    installSpacePanning(graph),
  ];
  return {
    graph,
    destroy: () => {
      cleanups.forEach((fn) => fn());
      graph.destroy();
    },
  };
}

const gridUpdaters = new WeakMap<Graph, () => void>();

/** Shows or hides the grid (snapping follows visibility, as in draw.io). */
export function setGridVisible(graph: Graph, visible: boolean): void {
  graph.setGridEnabled(visible);
  gridUpdaters.get(graph)?.();
}

/** Draws the grid as a CSS background that follows pan and zoom. */
function installGridBackground(graph: Graph): () => void {
  const container = graph.container;
  const update = () => {
    const { scale, translate } = graph.view;
    const size = graph.gridSize * scale;
    const major = size * 4;
    const minorColor = 'var(--grid-minor)';
    const majorColor = 'var(--grid-major)';
    container.style.backgroundImage = graph.isGridEnabled()
      ? [
          `linear-gradient(to right, ${majorColor} 1px, transparent 1px)`,
          `linear-gradient(to bottom, ${majorColor} 1px, transparent 1px)`,
          `linear-gradient(to right, ${minorColor} 1px, transparent 1px)`,
          `linear-gradient(to bottom, ${minorColor} 1px, transparent 1px)`,
        ].join(',')
      : 'none';
    container.style.backgroundSize = `${major}px ${major}px, ${major}px ${major}px, ${size}px ${size}px, ${size}px ${size}px`;
    const ox = translate.x * scale;
    const oy = translate.y * scale;
    container.style.backgroundPosition = Array(4).fill(`${ox}px ${oy}px`).join(',');
  };
  const listener = () => update();
  graph.view.addListener(InternalEvent.SCALE, listener);
  graph.view.addListener(InternalEvent.TRANSLATE, listener);
  graph.view.addListener(InternalEvent.SCALE_AND_TRANSLATE, listener);
  gridUpdaters.set(graph, update);
  update();
  return () => graph.view.removeListener(listener);
}

/** Wheel / trackpad pans; Ctrl/Cmd + wheel (and pinch) zooms around the cursor. */
function installWheelNavigation(graph: Graph): () => void {
  const container = graph.container;
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const view = graph.view;
    const { scale, translate } = view;
    if (e.ctrlKey || e.metaKey) {
      const rect = container.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * Math.exp(-e.deltaY * 0.01)));
      const tx = px / next - (px / scale - translate.x);
      const ty = py / next - (py / scale - translate.y);
      view.scaleAndTranslate(next, tx, ty);
    } else {
      const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
      const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
      view.setTranslate(translate.x - dx / scale, translate.y - dy / scale);
    }
  };
  container.addEventListener('wheel', onWheel, { passive: false });
  return () => container.removeEventListener('wheel', onWheel);
}

/** Hold space and drag with the left button to pan, like most canvas apps. */
function installSpacePanning(graph: Graph): () => void {
  const panning = graph.getPlugin<PanningHandler>('PanningHandler');
  if (!panning) return () => {};
  const isTyping = (t: EventTarget | null) =>
    t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
  const set = (on: boolean) => {
    panning.useLeftButtonForPanning = on;
    panning.ignoreCell = on;
    graph.container.style.cursor = on ? 'grab' : '';
  };
  const down = (e: KeyboardEvent) => {
    if (e.code === 'Space' && !isTyping(e.target) && !graph.isEditing()) {
      e.preventDefault();
      set(true);
    }
  };
  const up = (e: KeyboardEvent) => e.code === 'Space' && set(false);
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
  };
}
