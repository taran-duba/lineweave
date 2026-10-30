'use client';

import { useEffect, useReducer } from 'react';
import { AlertCircle, CloudCheck, CloudOff, Loader2 } from 'lucide-react';
import { useEditor, useStore } from './hooks';

function ago(t: number): string {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m ago` : new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function SaveIndicator() {
  const { session } = useEditor();
  const state = useStore(session.save);
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);
  if (!state) return null;

  const base = 'flex items-center gap-1.5 text-[12px] text-muted';
  switch (state.status) {
    case 'pending':
    case 'saving':
      return (
        <span className={base} data-testid="save-status">
          <Loader2 size={13} className="animate-spin" /> Saving…
        </span>
      );
    case 'error':
      return (
        <button type="button" className={`${base} text-danger`} title={state.message} onClick={() => session.saveNow?.()}>
          <AlertCircle size={13} /> Save failed · retry
        </button>
      );
    case 'offline':
      return (
        <span className={base}>
          <CloudOff size={13} /> Offline; changes will sync
        </span>
      );
    case 'saved':
      return (
        <span className={base} data-testid="save-status" title={state.savedBy ? `Saved by ${state.savedBy}` : undefined}>
          <CloudCheck size={13} /> Saved to Drive {state.savedAt ? ago(state.savedAt) : ''}
        </span>
      );
    default:
      return null;
  }
}
