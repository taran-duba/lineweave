'use client';

import clsx from 'clsx';
import { Minus, Plus } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

export function IconButton({
  label,
  active,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-text transition-colors',
        'hover:bg-panel-2 disabled:pointer-events-none disabled:opacity-35',
        active && 'bg-accent-soft text-accent',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Button({
  variant = 'secondary',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  return (
    <button
      type="button"
      className={clsx(
        'inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors disabled:opacity-50',
        variant === 'primary' && 'bg-accent text-white hover:brightness-110',
        variant === 'secondary' && 'border border-border bg-panel hover:bg-panel-2',
        variant === 'ghost' && 'hover:bg-panel-2',
        className,
      )}
      {...rest}
    />
  );
}

export const Divider = () => <div className="mx-1 h-5 w-px shrink-0 bg-border" />;

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 text-[13px]">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

export function NumberInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      {...props}
      className={clsx(
        'h-7 w-20 rounded-md border border-border bg-panel px-2 text-right text-[13px] tabular-nums outline-none focus:border-accent',
        props.className,
      )}
    />
  );
}

const REPEAT_DELAY_MS = 350;
const REPEAT_MS = 60;

/**
 * Number field with − / + buttons. Holding a button keeps stepping: the button
 * captures the pointer, so the repeat continues even if the pointer drifts off
 * it (unlike the browser's tiny native spinner arrows).
 */
export function Stepper({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  label,
  className,
}: {
  value: number;
  onChange(next: number): void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  className?: string;
}) {
  // While stepping, the parent's value lags a render behind; step from our own latest.
  const latest = useRef(value);
  const timers = useRef<{ delay?: ReturnType<typeof setTimeout>; repeat?: ReturnType<typeof setInterval> }>({});
  const [draft, setDraft] = useState<string | null>(null);
  const holding = useRef(false);
  useLayoutEffect(() => {
    if (!holding.current) latest.current = value;
  });

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const apply = (n: number) => {
    const next = clamp(Math.round(n * 100) / 100);
    if (next === latest.current) return;
    latest.current = next;
    onChange(next);
  };
  const stop = () => {
    holding.current = false;
    clearTimeout(timers.current.delay);
    clearInterval(timers.current.repeat);
  };
  useEffect(() => stop, []);

  const press = (e: React.PointerEvent<HTMLButtonElement>, dir: 1 | -1) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    stop();
    holding.current = true;
    setDraft(null);
    apply(latest.current + dir * step);
    timers.current.delay = setTimeout(() => {
      timers.current.repeat = setInterval(() => apply(latest.current + dir * step), REPEAT_MS);
    }, REPEAT_DELAY_MS);
  };

  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    setDraft(null);
    if (draft.trim() !== '' && Number.isFinite(n)) apply(n);
  };

  const btn =
    'flex h-7 w-6 shrink-0 touch-none select-none items-center justify-center text-muted hover:bg-panel-2 hover:text-text active:bg-accent-soft disabled:opacity-35';
  return (
    <span className={clsx('inline-flex h-7 items-center overflow-hidden rounded-md border border-border bg-panel focus-within:border-accent', className)}>
      <button type="button" tabIndex={-1} aria-label={`Decrease ${label}`} className={btn} disabled={value <= min} onPointerDown={(e) => press(e, -1)} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}>
        <Minus size={12} />
      </button>
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        value={draft ?? String(value)}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') setDraft(null);
          else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            apply((draft !== null && Number.isFinite(Number(draft)) ? Number(draft) : latest.current) + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1));
            setDraft(null);
          }
        }}
        className="h-full w-10 min-w-0 bg-transparent text-center text-[13px] tabular-nums outline-none"
      />
      <button type="button" tabIndex={-1} aria-label={`Increase ${label}`} className={btn} disabled={value >= max} onPointerDown={(e) => press(e, 1)} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}>
        <Plus size={12} />
      </button>
    </span>
  );
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="h-7 w-32 rounded-md border border-border bg-panel px-1.5 text-[13px] outline-none focus:border-accent"
    >
      {children}
    </select>
  );
}

/** Color swatch that also supports "none" (draw.io's transparent value). */
export function ColorInput({
  value,
  onChange,
  allowNone = true,
}: {
  value: string | undefined;
  onChange(v: string): void;
  allowNone?: boolean;
}) {
  const none = !value || value === 'none';
  return (
    <span className="flex items-center gap-1.5">
      {allowNone && (
        <input
          type="checkbox"
          aria-label="Enabled"
          checked={!none}
          onChange={(e) => onChange(e.target.checked ? '#ffffff' : 'none')}
          className="accent-[var(--accent)]"
        />
      )}
      <input
        type="color"
        aria-label="Color"
        disabled={none}
        value={none ? '#ffffff' : normalizeHex(value!)}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-10 cursor-pointer rounded-md border border-border bg-panel p-0.5 disabled:opacity-40"
      />
    </span>
  );
}

function normalizeHex(v: string): string {
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  if (/^#[0-9a-f]{3}$/i.test(v)) return `#${[...v.slice(1)].map((c) => c + c).join('')}`;
  const named: Record<string, string> = { white: '#ffffff', black: '#000000', default: '#000000' };
  return named[v.toLowerCase()] ?? '#000000';
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-border px-4 py-3">
      <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}
