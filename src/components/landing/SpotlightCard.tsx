'use client';

import type { PointerEvent, ReactNode } from 'react';

/** Card with a soft highlight that follows the pointer. */
export function SpotlightCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <div onPointerMove={onMove} className={`lw-spot ${className}`}>
      {children}
    </div>
  );
}
