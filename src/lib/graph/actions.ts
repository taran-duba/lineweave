import { Cell, Geometry, Point, type Graph } from '@maxgraph/core';
import type * as Y from 'yjs';
import { insertCopies } from '@/lib/collab/cellEdits';
import type { YGraphBinding } from '@/lib/collab/yGraphBinding';
import { toCellStyle } from '@/lib/drawio/style';
import {
  alignSelection,
  distributeSelection,
  flipSelection,
  rotateSelection,
  toggleLockSelection,
  type Align,
} from './arrange';
import { cellsFromText, lastCopied, pasteCells, rememberCopy, selectionCells, selectionToXml } from './clipboard';
import { imageFromFile, imageStyle, insertSize, type ImageData } from './images';
import { applyLayout, type LayoutId } from './layouts';
import { DEFAULT_EDGE_STYLE, type PaletteItem } from './palette';

export interface EditorActions {
  undo(): void;
  redo(): void;
  deleteSelection(): void;
  duplicate(): void;
  copy(): void;
  cut(): void;
  paste(): void;
  selectAll(): void;
  toFront(): void;
  toBack(): void;
  group(): void;
  ungroup(): void;
  zoomIn(): void;
  zoomOut(): void;
  zoomReset(): void;
  fit(): void;
  insert(item: PaletteItem, at?: { x: number; y: number }): Cell | null;
  /** draw.io's hover arrows: adds a copy of `cell` beside it and connects the two. */
  cloneAndConnect(cell: Cell, dir: Direction): Cell | null;
  applyLayout(id: LayoutId): void;
  clearWaypoints(): void;
  /** Serializes the selection as draw.io XML (and remembers it for menu paste). */
  copyXml(): string | null;
  /** Pastes draw.io XML; returns false if the text isn't a diagram. */
  pasteText(text: string): boolean;
  insertImage(image: ImageData): void;
  insertImageFile(file: File): Promise<void>;
  align(align: Align): void;
  distribute(axis: 'horizontal' | 'vertical'): void;
  rotate90(): void;
  flip(key: 'flipH' | 'flipV'): void;
  toggleLock(): void;
  selectVertices(): void;
  selectEdges(): void;
}

export type Direction = 'north' | 'south' | 'east' | 'west';
const CLONE_GAP = 60;

export function createActions(graph: Graph, undoManager: Y.UndoManager, binding: YGraphBinding): EditorActions {
  const selection = () => graph.getSelectionCells();
  const editable = () => graph.isEnabled();

  const viewCenter = () => {
    const { scale, translate } = graph.view;
    const c = graph.container;
    return { x: c.clientWidth / 2 / scale - translate.x, y: c.clientHeight / 2 / scale - translate.y };
  };

  const actions: EditorActions = {
    undo: () => editable() && undoManager.undo(),
    redo: () => editable() && undoManager.redo(),
    deleteSelection: () => editable() && graph.removeCells(graph.getDeletableCells(selection()), true),
    duplicate: () => {
      if (!editable() || !selection().length) return;
      const ids = insertCopies(binding, selectionCells(graph, binding), graph.getDefaultParent().id!, 10, 10);
      graph.setSelectionCells(ids.flatMap((id) => graph.getDataModel().getCell(id) ?? []));
    },
    copyXml: () => {
      const xml = selectionToXml(graph, binding);
      if (xml) rememberCopy(xml);
      return xml;
    },
    // Menu-driven copy/paste: the system clipboard is written when allowed, and
    // paste uses what we last copied (reading the clipboard needs a permission prompt).
    copy: () => {
      const xml = selectionToXml(graph, binding);
      if (!xml) return;
      rememberCopy(xml);
      navigator.clipboard?.writeText(xml).catch(() => undefined);
    },
    cut: () => {
      if (!editable()) return;
      const xml = selectionToXml(graph, binding);
      if (!xml) return;
      rememberCopy(xml);
      navigator.clipboard?.writeText(xml).catch(() => undefined);
      graph.removeCells(graph.getDeletableCells(selection()), true);
    },
    paste: () => {
      const xml = lastCopied();
      if (editable() && xml) pasteCells(graph, binding, cellsFromText(xml) ?? [], true);
    },
    pasteText: (text) => {
      if (!editable()) return false;
      const cells = cellsFromText(text);
      if (!cells?.length) return false;
      pasteCells(graph, binding, cells, text === lastCopied());
      return true;
    },
    insertImage: (image) => {
      if (!editable()) return;
      const size = insertSize(image.width, image.height);
      actions.insert({ id: 'image', title: 'Image', style: imageStyle(image.url), ...size });
    },
    insertImageFile: async (file) => actions.insertImage(await imageFromFile(file)),
    align: (a) => editable() && alignSelection(graph, a),
    distribute: (axis) => editable() && distributeSelection(graph, axis),
    rotate90: () => editable() && rotateSelection(graph, 90),
    flip: (key) => editable() && flipSelection(graph, key),
    toggleLock: () => editable() && toggleLockSelection(graph),
    selectVertices: () => graph.setSelectionCells(graph.getDefaultParent().children.filter((c) => c.isVertex())),
    selectEdges: () => graph.setSelectionCells(graph.getDefaultParent().children.filter((c) => c.isEdge())),
    selectAll: () => graph.selectAll(),
    toFront: () => editable() && graph.orderCells(false),
    toBack: () => editable() && graph.orderCells(true),
    group: () => {
      if (!editable() || selection().length < 2) return;
      const group = new Cell('', new Geometry(), toCellStyle('group'));
      group.vertex = true;
      group.connectable = false;
      graph.setSelectionCell(graph.groupCells(group, 0, selection()));
    },
    ungroup: () => editable() && graph.setSelectionCells(graph.ungroupCells()),
    zoomIn: () => graph.zoomIn(),
    zoomOut: () => graph.zoomOut(),
    zoomReset: () => graph.zoomActual(),
    fit: () => fitToContent(graph),
    insert: (item, at) => {
      if (!editable()) return null;
      const p = at ?? viewCenter();
      const x = Math.round((p.x - item.width / 2) / graph.gridSize) * graph.gridSize;
      const y = Math.round((p.y - item.height / 2) / graph.gridSize) * graph.gridSize;
      const parent = graph.getDefaultParent();
      if (item.xml) {
        // A multi-cell item (class, table, ...): paste its cells, positioned at the drop point.
        const cells = cellsFromText(item.xml);
        if (!cells?.length) return null;
        const ids = insertCopies(binding, cells, parent.id!, x, y);
        const pasted = ids.flatMap((id) => graph.getDataModel().getCell(id) ?? []);
        graph.setSelectionCells(pasted);
        return pasted[0] ?? null;
      }
      const style = toCellStyle(item.style);
      let cell: Cell;
      graph.batchUpdate(() => {
        if (item.edge) {
          const geo = new Geometry(0, 0, item.width, item.height);
          geo.relative = true;
          geo.sourcePoint = new Point(x, y + 20);
          geo.targetPoint = new Point(x + item.width, y + 20);
          cell = new Cell(item.value ?? '', geo, style);
          cell.edge = true;
          graph.addCell(cell, parent);
        } else {
          cell = graph.insertVertex({ parent, value: item.value ?? '', position: [x, y], size: [item.width, item.height], style });
        }
      });
      graph.setSelectionCell(cell!);
      return cell!;
    },
    cloneAndConnect: (cell, dir) => {
      const geo = cell.geometry;
      if (!editable() || !geo || !cell.parent) return null;
      let clone: Cell | null = null;
      graph.batchUpdate(() => {
        [clone] = graph.cloneCells([cell], false);
        const g = clone!.geometry!;
        if (dir === 'east') g.x += geo.width + CLONE_GAP;
        if (dir === 'west') g.x -= geo.width + CLONE_GAP;
        if (dir === 'south') g.y += geo.height + CLONE_GAP;
        if (dir === 'north') g.y -= geo.height + CLONE_GAP;
        // A fresh step to type into, like adding the next box in a flowchart.
        clone!.value = '';
        graph.addCell(clone!, cell.parent);
        const edge = new Cell('', new Geometry(), toCellStyle(DEFAULT_EDGE_STYLE));
        edge.edge = true;
        edge.geometry!.relative = true;
        graph.addEdge(edge, cell.parent, cell, clone!);
      });
      if (clone) graph.setSelectionCell(clone);
      return clone;
    },
    applyLayout: (id) => editable() && applyLayout(graph, id),
    clearWaypoints: () => {
      if (!editable()) return;
      const model = graph.getDataModel();
      graph.batchUpdate(() => {
        for (const edge of selection()) {
          if (!edge.isEdge() || !edge.geometry?.points?.length) continue;
          const geo = edge.geometry.clone();
          geo.points = [];
          model.setGeometry(edge, geo);
        }
      });
    },
  };
  return actions;
}

/** Centers the content in the viewport, zooming out (never in past 100%) so it fits. */
export function fitToContent(graph: Graph, margin = 40): void {
  const container = graph.container;
  const view = graph.view;
  const b = graph.getGraphBounds();
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  if (!b.width || !b.height || !cw || !ch) return;
  const s = view.scale;
  // Bounds in unscaled graph coordinates.
  const gx = b.x / s - view.translate.x;
  const gy = b.y / s - view.translate.y;
  const gw = b.width / s;
  const gh = b.height / s;
  const scale = Math.max(0.1, Math.min(1, (cw - 2 * margin) / gw, (ch - 2 * margin) / gh));
  view.scaleAndTranslate(scale, (cw / scale - gw) / 2 - gx, (ch / scale - gh) / 2 - gy);
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/** Global keyboard shortcuts; Cmd on macOS, Ctrl elsewhere. Returns an unbind function. */
export function bindShortcuts(graph: Graph, actions: EditorActions): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (isTyping(e.target) || graph.isEditing()) return;
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    const run = (fn: () => void) => {
      e.preventDefault();
      fn();
    };
    if (mod && key === 'z') return run(e.shiftKey ? actions.redo : actions.undo);
    if (mod && key === 'y') return run(actions.redo);
    // Copy, cut and paste go through the clipboard events below.
    if (mod && key === 'd') return run(actions.duplicate);
    if (mod && key === 'r') return run(actions.rotate90);
    if (mod && !e.shiftKey && key === 'l') return run(actions.toggleLock);
    if (mod && e.shiftKey && key === 'i') return run(actions.selectVertices);
    if (mod && e.shiftKey && key === 'e') return run(actions.selectEdges);
    if (mod && key === 'a') return run(actions.selectAll);
    if (mod && key === 'g') return run(e.shiftKey ? actions.ungroup : actions.group);
    if (mod && (key === '=' || key === '+')) return run(actions.zoomIn);
    if (mod && key === '-') return run(actions.zoomOut);
    if (mod && key === '0') return run(actions.zoomReset);
    if (mod && e.shiftKey && key === 'h') return run(actions.fit);
    if (!mod && (key === 'delete' || key === 'backspace')) return run(actions.deleteSelection);
    if (!mod && key === 'escape') return run(() => graph.clearSelection());
    if (!mod && key === 'f2') {
      const cell = graph.getSelectionCell();
      if (cell) run(() => graph.startEditingAtCell(cell));
      return;
    }
    if (!mod && key.startsWith('arrow') && graph.getSelectionCount() && graph.isEnabled()) {
      const step = e.shiftKey ? graph.gridSize : 1;
      const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0;
      const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0;
      run(() => graph.moveCells(graph.getMovableCells(graph.getSelectionCells()), dx, dy));
    }
  };
  const ignore = (e: Event) => isTyping(e.target) || isTyping(document.activeElement) || graph.isEditing();
  const onCopy = (e: ClipboardEvent, cut = false) => {
    if (ignore(e) || !graph.getSelectionCount()) return;
    const xml = actions.copyXml();
    if (!xml || !e.clipboardData) return;
    e.clipboardData.setData('text/plain', xml);
    e.preventDefault();
    if (cut) actions.deleteSelection();
  };
  const onCut = (e: ClipboardEvent) => onCopy(e, true);
  const onPaste = (e: ClipboardEvent) => {
    if (ignore(e) || !e.clipboardData) return;
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'));
    if (file) {
      e.preventDefault();
      actions.insertImageFile(file).catch((err) => alert(err instanceof Error ? err.message : String(err)));
      return;
    }
    if (actions.pasteText(e.clipboardData.getData('text/plain'))) e.preventDefault();
  };
  window.addEventListener('keydown', onKey);
  document.addEventListener('copy', onCopy);
  document.addEventListener('cut', onCut);
  document.addEventListener('paste', onPaste);
  return () => {
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('copy', onCopy);
    document.removeEventListener('cut', onCut);
    document.removeEventListener('paste', onPaste);
  };
}
