'use client';

import type { Collaborator } from '@/lib/collab/session';
import { useEditor, useStore } from './hooks';

function Avatar({ c, onClick }: { c: Collaborator; onClick?: () => void }) {
  const initials = c.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${c.name}${c.role === 'viewer' ? ' (viewing)' : ''}`}
      className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-2 ring-panel"
      style={{ boxShadow: `0 0 0 2px ${c.color}` }}
    >
      {c.photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- Google profile photos; next/image would need remotePatterns
        <img src={c.photo} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-white" style={{ background: c.color }}>
          {initials}
        </span>
      )}
    </button>
  );
}

export function PresenceAvatars() {
  const { session, setPageId } = useEditor();
  const others = useStore(session.presence?.others) ?? [];
  const self = session.presence?.self;
  if (!self) return null;
  const shown = others.slice(0, 5);
  return (
    <div className="flex items-center -space-x-1.5" data-testid="presence">
      {shown.map((c) => (
        <Avatar key={c.uid} c={c} onClick={() => c.pageId && setPageId(c.pageId)} />
      ))}
      {others.length > shown.length && (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-panel-2 text-[11px] font-medium ring-2 ring-panel">
          +{others.length - shown.length}
        </span>
      )}
      <div className="pl-3">
        <Avatar c={{ ...self, name: `${self.name} (you)` }} />
      </div>
    </div>
  );
}
