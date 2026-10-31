'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import type { MenuItem } from './ui';

/** A modal dialog. Escape or a backdrop click closes it; the first field gets focus. */
export function Dialog({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const first = ref.current?.querySelector<HTMLElement>('input, textarea, select, button[data-autofocus]');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx('flex max-h-[85dvh] w-full flex-col rounded-xl border border-border bg-panel shadow-2xl', wide ? 'max-w-2xl' : 'max-w-md')}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-muted hover:bg-panel-2 hover:text-text">
            <X size={16} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-border px-4 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export type ContextMenuEntry = MenuItem | 'separator';

/** A right-click menu at a screen position, kept inside the viewport. */
export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: ContextMenuEntry[]; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({ left: Math.min(x, window.innerWidth - width - 8), top: Math.min(y, window.innerHeight - height - 8) });
  }, [x, y]);
  useEffect(() => {
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onClose);
    window.addEventListener('wheel', onClose, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onClose);
      window.removeEventListener('wheel', onClose);
    };
  }, [onClose]);
  // Collapse leading, trailing and doubled separators left by hidden items.
  const visible = items.filter((it, i, arr) => it !== 'separator' || (i > 0 && arr[i - 1] !== 'separator' && i < arr.length - 1));
  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-[90] min-w-52 overflow-hidden rounded-lg border border-border bg-panel py-1 shadow-xl"
      style={pos}
      onContextMenu={(e) => e.preventDefault()}
    >
      {visible.map((item, i) =>
        item === 'separator' ? (
          <div key={`sep${i}`} className="my-1 h-px bg-border" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
            className="flex w-full items-center justify-between gap-6 px-3 py-1.5 text-left text-[13px] hover:bg-panel-2 disabled:pointer-events-none disabled:opacity-40"
          >
            {item.label}
            {item.hint && <span className="text-[12px] text-muted">{item.hint}</span>}
          </button>
        ),
      )}
    </div>
  );
}
