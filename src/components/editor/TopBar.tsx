'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Workflow } from 'lucide-react';
import { Button } from '@/components/ui';
import { ExportMenu, FileMenu } from './FileMenus';
import { PresenceAvatars } from './PresenceAvatars';
import { SaveIndicator } from './SaveIndicator';
import { useEditor, useStore } from './hooks';

function TitleInput() {
  const { session } = useEditor();
  const title = useStore(session.title);
  const [draft, setDraft] = useState<string | null>(null);
  const editable = !!session.rename && !session.readOnly;
  const commit = async () => {
    const next = draft?.trim();
    setDraft(null);
    if (next && next !== title) await session.rename?.(next);
  };
  return (
    <input
      aria-label="Diagram name"
      value={draft ?? title}
      readOnly={!editable}
      onFocus={() => editable && setDraft(title)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(null);
          requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
        }
      }}
      className="h-8 min-w-0 max-w-80 flex-1 truncate rounded-md bg-transparent px-2 text-[15px] font-medium outline-none hover:bg-panel-2 focus:bg-panel-2"
    />
  );
}

export function TopBar() {
  const { session } = useEditor();
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-panel px-3">
      <Link href="/files" className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-white" title="All diagrams">
        <Workflow size={17} />
      </Link>
      <TitleInput />
      <FileMenu />
      {session.readOnly && (
        <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[12px] font-medium text-muted">View only</span>
      )}
      <SaveIndicator />
      <div className="flex-1" />
      <PresenceAvatars />
      {session.driveUrl && (
        <a href={session.driveUrl} target="_blank" rel="noreferrer">
          <Button>
            <ExternalLink size={14} /> Share in Drive
          </Button>
        </a>
      )}
      <ExportMenu />
    </header>
  );
}
