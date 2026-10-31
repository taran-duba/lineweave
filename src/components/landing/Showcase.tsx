'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeftRight, Check, Cloud, Users } from 'lucide-react';
import { Cursor } from './Cursor';

function MiniFlow({ tint = 'var(--accent)' }: { tint?: string }) {
  return (
    <svg viewBox="0 0 300 160" className="h-full w-full">
      <path d="M92 50 H130 M190 50 H228 M160 70 V96 M120 118 H98 M200 118 H222" stroke="var(--muted)" strokeWidth="1.5" fill="none" />
      <rect x="30" y="34" width="62" height="32" rx="7" fill="var(--accent-soft)" stroke={tint} strokeWidth="1.5" />
      <rect x="130" y="34" width="60" height="32" rx="7" fill="var(--panel)" stroke="var(--border)" strokeWidth="1.5" />
      <rect x="228" y="34" width="52" height="32" rx="7" fill="var(--panel)" stroke="var(--border)" strokeWidth="1.5" />
      <path d="M160 96 L190 118 L160 140 L130 118 Z" fill="var(--panel)" stroke="var(--border)" strokeWidth="1.5" />
      <rect x="34" y="104" width="64" height="28" rx="7" fill="var(--panel)" stroke="var(--border)" strokeWidth="1.5" />
      <rect x="222" y="104" width="56" height="28" rx="7" fill="var(--panel)" stroke="var(--border)" strokeWidth="1.5" />
    </svg>
  );
}

function LiveVisual() {
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0 p-6"><MiniFlow /></div>
      <svg viewBox="0 0 300 160" className="absolute inset-0 h-full w-full p-6">
        <rect className="lw-select-a" x="126" y="30" width="68" height="40" rx="9" fill="none" stroke="#f97316" strokeWidth="2" />
        <rect className="lw-select-b" x="26" y="100" width="72" height="36" rx="9" fill="none" stroke="#3b82f6" strokeWidth="2" />
        <g className="lw-cursor lw-mini-a"><Cursor color="#f97316" name="Maya" /></g>
        <g className="lw-cursor lw-mini-b"><Cursor color="#3b82f6" name="Jonas" /></g>
        <g className="lw-cursor lw-mini-c"><Cursor color="#e11d48" name="Priya" /></g>
      </svg>
      <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-border bg-panel px-3 py-1.5 text-xs shadow-sm">
        <span className="flex -space-x-1.5">
          {['#f97316', '#3b82f6', '#e11d48'].map((c) => (
            <span key={c} className="h-4 w-4 rounded-full border-2 border-panel" style={{ background: c }} />
          ))}
        </span>
        3 editing now
      </div>
    </div>
  );
}

function DriveVisual() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5 p-6">
      <div className="w-full max-w-xs rounded-xl border border-border bg-panel p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent"><Cloud size={20} /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">team-architecture.drawio</p>
            <p className="text-xs text-muted">My Drive / Diagrams</p>
          </div>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-panel-2">
          <div className="lw-save-bar h-full rounded-full bg-accent" />
        </div>
        <div className="relative mt-3 h-5 text-xs">
          <span className="lw-save-a absolute inset-0 flex items-center gap-1.5 text-muted">Saving changes…</span>
          <span className="lw-save-b absolute inset-0 flex items-center gap-1.5 font-medium text-accent"><Check size={13} /> Saved to Drive</span>
        </div>
      </div>
      <div className="flex w-full max-w-xs items-center justify-between text-xs text-muted">
        <span className="rounded-md border border-border bg-panel px-2 py-1">Share like any file</span>
        <span className="rounded-md border border-border bg-panel px-2 py-1">Version history</span>
      </div>
    </div>
  );
}

function CompatVisual() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-5">
      {(['Lineweave', 'diagrams.net'] as const).map((name, i) => (
        <div key={name} className="relative w-full max-w-sm overflow-hidden rounded-xl border border-border bg-panel shadow-sm">
          <div className="flex items-center gap-1.5 border-b border-border bg-panel-2 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-border" /><span className="h-2 w-2 rounded-full bg-border" /><span className="h-2 w-2 rounded-full bg-border" />
            <span className="ml-2 text-[11px] text-muted">{name}</span>
          </div>
          <div className="h-24"><MiniFlow tint={i ? 'var(--muted)' : 'var(--accent)'} /></div>
        </div>
      ))}
      <div className="lw-swap absolute flex h-10 w-10 items-center justify-center rounded-full border border-border bg-bg text-accent shadow-md">
        <ArrowLeftRight size={18} className="rotate-90" />
      </div>
    </div>
  );
}

const steps: { icon: typeof Users; eyebrow: string; title: string; text: string; visual: ReactNode }[] = [
  { icon: Users, eyebrow: 'Real-time', title: 'Everyone on the same canvas', text: 'See teammates’ cursors and selections move live. Undo is per person, so you never undo someone else’s work.', visual: <LiveVisual /> },
  { icon: Cloud, eyebrow: 'Google Drive', title: 'Your files stay yours', text: 'Diagrams are plain .drawio files in your Drive. Sharing, permissions and version history work the way you already expect.', visual: <DriveVisual /> },
  { icon: ArrowLeftRight, eyebrow: 'draw.io compatible', title: 'Round-trips without loss', text: 'Open the same file in diagrams.net and back again. Styles, data and pages survive intact in both directions.', visual: <CompatVisual /> },
];

/** Sticky visual that swaps as each text step scrolls past. Small screens inline the visual per step. */
export function Showcase() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-2">
      <div>
        {steps.map(({ icon: Icon, eyebrow, title, text, visual }, i) => (
          <div
            key={title}
            data-step={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="flex flex-col justify-center py-12 lg:min-h-[85vh]"
          >
            <div className="transition-all duration-500 lg:data-[off=true]:opacity-30" data-off={active !== i}>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-panel px-3 py-1 text-xs font-medium text-accent">
                <Icon size={13} /> {eyebrow}
              </span>
              <h3 className="font-display mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h3>
              <p className="mt-3 max-w-md text-lg text-pretty text-muted">{text}</p>
            </div>
            <div className="lw-panel relative mt-8 aspect-[5/4] overflow-hidden rounded-2xl border border-border bg-panel lg:hidden">{visual}</div>
          </div>
        ))}
      </div>
      <div className="hidden lg:block">
        <div className="sticky top-0 flex h-dvh items-center">
          <div className="lw-panel relative aspect-[5/4] w-full overflow-hidden rounded-3xl border border-border bg-panel">
            {steps.map(({ title, visual }, i) => (
              <div key={title} className="absolute inset-0 transition-all duration-700 ease-out" style={{ opacity: active === i ? 1 : 0, transform: active === i ? 'none' : 'translateY(16px) scale(.98)' }} aria-hidden={active !== i}>
                {visual}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
