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
import { schematicConnectorStyle } from './wires';
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
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><path d="M2 2 8 8M8 2 2 8" stroke="#0f766e" stroke-width="1.6"/></svg>',
)}`;

/**
 * draw.io's `points=[[x,y,perimeter,dx,dy],...]` style: fixed connection points
 * (`points=[]` means none). Returns null when absent or unreadable.
 */
export function parsePointsStyle(raw: unknown): ConnectionConstraint[] | null {
  if (typeof raw !== 'string') return null;
  try {
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return null;
    return list
      .filter((p): p is number[] => Array.isArray(p) && p.length >= 2 && p.every((n) => typeof n === 'number'))
      .map(([x, y, perimeter = 1, dx = 0, dy = 0]) => new ConnectionConstraint(new Point(x, y), perimeter !== 0, null, dx, dy));
  } catch {
    return null;
  }
}

export function createGraph(container: HTMLElement): { graph: Graph; destroy: () => void } {
  // Default handle/folding images ship with maxGraph; we serve them from /public.
  Client.imageBasePath = '/maxgraph/images';
  registerDrawioShapes();
  configureSelectionStyle();
  InternalEvent.disableContextMenu(container);
  const listenersBefore = new Set(listenersOf(container));
  const nodesBefore = new Set(container.childNodes);
  const graph = new Graph(container, undefined, [...getDefaultPlugins(), RubberBandHandler]);
  owners.set(container, graph);
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

  // Same precedence as draw.io: the `points` style, then the stencil's own terminals, then the defaults.
  graph.getAllConnectionConstraints = (terminal) => {
    if (!terminal?.cell?.isVertex()) return null;
    const stencil = terminal.shape?.stencil?.constraints;
    return (
      parsePointsStyle((terminal.style as Record<string, unknown>).points) ??
      (stencil?.length ? stencil : CONNECTION_POINTS.map(([x, y]) => new ConnectionConstraint(new Point(x, y), true)))
    );
  };

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
    connection.factoryMethod = (source, target) => {
      const edge = new Cell('', new Geometry(), toCellStyle(schematicConnectorStyle(source, target) ?? DEFAULT_EDGE_STYLE));
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
    installPanning(graph),
  ];
  const ownListeners = listenersOf(container).filter((l) => !listenersBefore.has(l));
  const ownNodes = [...container.childNodes].filter((n) => !nodesBefore.has(n));
  return {
    graph,
    destroy: () => {
      cleanups.forEach((fn) => fn());
      if (owners.get(container) === graph) {
        owners.delete(container);
        graph.destroy();
      } else {
        destroySharingContainer(graph, ownListeners, ownNodes);
      }
    },
  };
}

type ListenerEntry = { name: string; f: EventListener };
const listenersOf = (el: HTMLElement): ListenerEntry[] =>
  [...((el as HTMLElement & { mxListenerList?: ListenerEntry[] }).mxListenerList ?? [])];

/** The graph most recently created on each container. */
const owners = new WeakMap<HTMLElement, Graph>();

/**
 * React remounts the canvas on the same element (Strict Mode, page or
 * read-only changes) and destroys the old graph afterwards. maxGraph's teardown
 * releases every listener on the container and its children, which would cut
 * the new graph off from all mouse input, so only release what this graph added.
 */
function destroySharingContainer(graph: Graph, listeners: ListenerEntry[], nodes: ChildNode[]): void {
  const container = graph.container;
  const release = InternalEvent.release;
  InternalEvent.release = (el) => {
    if (el !== container) return release(el);
    listeners.forEach((l) => InternalEvent.removeListener(container, l.name, l.f));
    nodes.forEach((n) => release(n as Element));
  };
  try {
    graph.destroy();
  } finally {
    InternalEvent.release = release;
  }
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
    // Firefox reports mouse wheels in lines (or pages) rather than pixels.
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? container.clientHeight : 1;
    const deltaX = e.deltaX * unit;
    const deltaY = e.deltaY * unit;
    if (e.ctrlKey || e.metaKey) {
      const rect = container.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * Math.exp(-deltaY * 0.01)));
      const tx = px / next - (px / scale - translate.x);
      const ty = py / next - (py / scale - translate.y);
      view.scaleAndTranslate(next, tx, ty);
    } else {
      const dx = e.shiftKey && !deltaX ? deltaY : deltaX;
      const dy = e.shiftKey && !deltaX ? 0 : deltaY;
      view.setTranslate(translate.x - dx / scale, translate.y - dy / scale);
    }
  };
  container.addEventListener('wheel', onWheel, { passive: false });
  return () => container.removeEventListener('wheel', onWheel);
}

/**
 * Right-drag (or Space + drag) pans. The view is translated live on every
 * move instead of using maxGraph's CSS-transform preview, which left the grid,
 * page and collaborator cursors behind until release, never committed a purely
 * horizontal or vertical drag, and stayed shifted if released off the canvas.
 */
function installPanning(graph: Graph): () => void {
  const panning = graph.getPlugin<PanningHandler>('PanningHandler');
  if (!panning) return () => {};
  const container = graph.container;
  panning.minScale = MIN_SCALE;
  panning.maxScale = MAX_SCALE;
  panning.previewEnabled = false;
  // Already applied live below; the handler's own commit on mouse up would double it.
  panning.panGraph = () => {};

  let applied = { x: 0, y: 0 };
  const onStart = () => {
    applied = { x: 0, y: 0 };
    container.classList.add('is-panning');
  };
  const onPan = () => {
    const { view } = graph;
    const ddx = panning.dx - applied.x;
    const ddy = panning.dy - applied.y;
    applied = { x: panning.dx, y: panning.dy };
    if (ddx || ddy) view.setTranslate(view.translate.x + ddx / view.scale, view.translate.y + ddy / view.scale);
  };
  const onEnd = () => container.classList.remove('is-panning');
  panning.addListener(InternalEvent.PAN_START, onStart);
  panning.addListener(InternalEvent.PAN, onPan);
  panning.addListener(InternalEvent.PAN_END, onEnd);
  // Releasing outside the canvas resets the handler without a PAN_END.
  window.addEventListener('mouseup', onEnd);

  // Space held: left-drag pans, even over shapes.
  const ignoresSpace = (t: EventTarget | null) =>
    t instanceof HTMLElement &&
    (t.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) ||
      !!t.closest('[role="dialog"], [role="menu"], [role="listbox"]'));
  const setSpace = (on: boolean) => {
    panning.useLeftButtonForPanning = on;
    panning.ignoreCell = on;
    container.classList.toggle('space-panning', on);
  };
  const down = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || ignoresSpace(e.target) || graph.isEditing()) return;
    e.preventDefault();
    if (!e.repeat) setSpace(true);
  };
  const up = (e: KeyboardEvent) => e.code === 'Space' && setSpace(false);
  // Switching windows while holding Space never delivers the keyup.
  const blur = () => setSpace(false);
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  return () => {
    panning.removeListener(onStart);
    panning.removeListener(onPan);
    panning.removeListener(onEnd);
    window.removeEventListener('mouseup', onEnd);
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', blur);
  };
}
