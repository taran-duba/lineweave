'use client';

import clsx from 'clsx';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

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
