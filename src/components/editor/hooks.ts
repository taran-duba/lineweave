'use client';

import { createContext, useContext, useEffect, useReducer, useSyncExternalStore } from 'react';
import { InternalEvent, type Graph } from '@maxgraph/core';
import type * as Y from 'yjs';
import type { EditorActions } from '@/lib/graph/actions';
import type { EditorSession } from '@/lib/collab/session';
import type { Store } from '@/lib/store';

export interface CanvasHandle {
  graph: Graph;
  actions: EditorActions;
  undo: Y.UndoManager;
  pageId: string;
}

export interface EditorContextValue {
  session: EditorSession;
  canvas: CanvasHandle | null;
  pageId: string;
  setPageId(id: string): void;
}

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used inside <EditorShell>');
  return ctx;
}

const noopSubscribe = () => () => {};

export function useStore<T>(store: Store<T>): T;
export function useStore<T>(store: Store<T> | undefined): T | undefined;
export function useStore<T>(store: Store<T> | undefined): T | undefined {
  return useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    () => store?.get(),
    () => store?.get(),
  );
}

/** Re-renders whenever the graph's selection, model, view or undo stack changes. */
export function useGraphVersion(canvas: CanvasHandle | null): number {
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!canvas) return;
    const { graph, undo } = canvas;
    const listener = () => bump();
    const selection = graph.getSelectionModel();
    const model = graph.getDataModel();
    selection.addListener(InternalEvent.CHANGE, listener);
    model.addListener(InternalEvent.CHANGE, listener);
    graph.view.addListener(InternalEvent.SCALE, listener);
    graph.view.addListener(InternalEvent.SCALE_AND_TRANSLATE, listener);
    undo.on('stack-item-added', listener);
    undo.on('stack-item-popped', listener);
    undo.on('stack-cleared', listener);
    bump();
    return () => {
      selection.removeListener(listener);
      model.removeListener(listener);
      graph.view.removeListener(listener);
      undo.off('stack-item-added', listener);
      undo.off('stack-item-popped', listener);
      undo.off('stack-cleared', listener);
    };
  }, [canvas]);
  return version;
}

/** Re-renders when any observed Y type changes. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any Y type works here
export function useYVersion(type: Y.AbstractType<any> | undefined): number {
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!type) return;
    const fn = () => bump();
    type.observeDeep(fn);
    return () => type.unobserveDeep(fn);
  }, [type]);
  return version;
}
