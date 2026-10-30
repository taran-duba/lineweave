'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import clsx from 'clsx';
import { addPage, deletePage, renamePage } from '@/lib/drawio/pages';
import { pagesOf, sortedPageIds } from '@/lib/drawio/ydoc';
import { IconButton } from '@/components/ui';
import { useEditor, useStore, useYVersion } from './hooks';

export function PageTabs() {
  const { session, pageId, setPageId } = useEditor();
  const pages = pagesOf(session.doc);
  useYVersion(pages);
  const [editing, setEditing] = useState<string | null>(null);
  const ids = sortedPageIds(session.doc);
  const readOnly = session.readOnly;
  const others = useStore(session.presence?.others) ?? [];

  return (
    <div className="flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-t border-border bg-panel px-2" role="tablist">
      {ids.map((id) => {
        const name = (pages.get(id)?.get('name') as string) ?? 'Page';
        const active = id === pageId;
        const viewers = others.filter((c) => c.pageId === id);
        return (
          <div
            key={id}
            role="tab"
            aria-selected={active}
            className={clsx(
              'group flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px]',
              active ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-panel-2 hover:text-text',
            )}
            onClick={() => setPageId(id)}
            onDoubleClick={() => !readOnly && setEditing(id)}
          >
            {editing === id ? (
              <input
                autoFocus
                defaultValue={name}
                className="w-28 bg-transparent outline-none"
                onBlur={(e) => {
                  renamePage(session.doc, id, e.target.value);
                  setEditing(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') setEditing(null);
                }}
              />
            ) : (
              <span>{name}</span>
            )}
            {viewers.length > 0 && (
              <span className="flex -space-x-1">
                {viewers.slice(0, 3).map((v) => (
                  <span key={v.uid} className="h-2 w-2 rounded-full ring-1 ring-panel" style={{ background: v.color }} title={v.name} />
                ))}
              </span>
            )}
            {!readOnly && ids.length > 1 && (
              <button
                type="button"
                aria-label={`Delete ${name}`}
                className="hidden rounded p-0.5 hover:bg-panel group-hover:block"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!confirm(`Delete page "${name}" for everyone?`)) return;
                  const next = deletePage(session.doc, id);
                  if (active && next) setPageId(next);
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        );
      })}
      {!readOnly && (
        <IconButton label="Add page" onClick={() => setPageId(addPage(session.doc))}>
          <Plus size={15} />
        </IconButton>
      )}
    </div>
  );
}
