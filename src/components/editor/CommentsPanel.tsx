'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui';
import type { Comment, CommentsApi } from '@/lib/collab/session';

const POLL_MS = 20_000;

function when(iso: string): string {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function Composer({ placeholder, onSend, autoFocus }: { placeholder: string; onSend(text: string): Promise<void>; autoFocus?: boolean }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onSend(text.trim());
      setText('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        autoFocus={autoFocus}
        value={text}
        rows={2}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void send();
        }}
        className="w-full resize-none rounded-md border border-border bg-bg p-2 text-[13px] outline-none focus:border-accent"
      />
      {text.trim() && (
        <Button variant="primary" className="self-end" disabled={busy} onClick={send}>
          {busy && <Loader2 size={13} className="animate-spin" />} Comment
        </Button>
      )}
    </div>
  );
}

/** Google Drive comments on this file (the same ones shown in Drive), refreshed while open. */
export function CommentsPanel({ comments, onClose }: { comments: CommentsApi; onClose(): void }) {
  const [list, setList] = useState<Comment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setList(await comments.list());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [comments]);

  useEffect(() => {
    // Polling Drive, an external system; there's no push channel for comments.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const act = async (fn: () => Promise<void>) => {
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const open = list?.filter((c) => !c.resolved) ?? [];
  const resolved = list?.filter((c) => c.resolved) ?? [];
  const shown = showResolved ? [...open, ...resolved] : open;

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-panel" aria-label="Comments" data-testid="comments-panel">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border pl-4 pr-1">
        <span className="text-[13px] font-semibold">Comments</span>
        <IconButton label="Close comments" onClick={onClose}>
          <X size={15} />
        </IconButton>
      </div>
      <div className="border-b border-border p-3">
        <Composer autoFocus placeholder="Add a comment… (⌘/Ctrl+Enter)" onSend={(t) => act(() => comments.add(t))} />
      </div>
      {error && <p className="px-3 py-2 text-[12px] text-danger">{error}</p>}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!list ? (
          <div className="flex justify-center py-8 text-muted">
            <Loader2 className="animate-spin" />
          </div>
        ) : shown.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-muted">No open comments.</p>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((c) => (
              <li key={c.id} className={c.resolved ? 'p-3 opacity-60' : 'p-3'}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">{c.author}</p>
                    <p className="text-[11px] text-muted">{when(c.createdTime)}{c.resolved ? ' · Resolved' : ''}</p>
                  </div>
                  {!c.resolved && (
                    <IconButton label="Resolve" onClick={() => act(() => comments.resolve(c.id))}>
                      <Check size={14} />
                    </IconButton>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-[13px]">{c.content}</p>
                {c.replies.map((r) => (
                  <div key={r.id} className="mt-2 border-l-2 border-border pl-2">
                    <p className="text-[12px] font-medium">
                      {r.author} <span className="font-normal text-muted">· {when(r.createdTime)}</span>
                    </p>
                    <p className="whitespace-pre-wrap break-words text-[13px]">{r.content}</p>
                  </div>
                ))}
                {!c.resolved && (
                  <div className="mt-2">
                    <Composer placeholder="Reply…" onSend={(t) => act(() => comments.reply(c.id, t))} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {resolved.length > 0 && (
        <button
          type="button"
          onClick={() => setShowResolved((v) => !v)}
          className="shrink-0 border-t border-border px-4 py-2 text-left text-[12px] text-muted hover:bg-panel-2"
        >
          {showResolved ? 'Hide' : 'Show'} {resolved.length} resolved
        </button>
      )}
    </aside>
  );
}
