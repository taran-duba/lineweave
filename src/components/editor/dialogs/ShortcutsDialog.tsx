'use client';

import { Dialog } from '@/components/overlays';
import { modKey } from '../hooks';

export function ShortcutsDialog({ onClose }: { onClose(): void }) {
  const m = modKey();
  const groups: [string, [string, string][]][] = [
    [
      'Edit',
      [
        ['Undo / Redo', `${m}Z / ${m}⇧Z`],
        ['Cut / Copy / Paste', `${m}X / ${m}C / ${m}V`],
        ['Duplicate', `${m}D`],
        ['Delete', 'Delete / Backspace'],
        ['Edit label', 'F2 or double-click'],
        ['Edit style / data', `${m}E / ${m}M`],
        ['Find & replace', `${m}F`],
      ],
    ],
    [
      'Select & arrange',
      [
        ['Select all', `${m}A`],
        ['Select shapes / connectors', `${m}⇧I / ${m}⇧E`],
        ['Group / Ungroup', `${m}G / ${m}⇧G`],
        ['Rotate 90°', `${m}R`],
        ['Lock / Unlock', `${m}L`],
        ['Nudge (1px / grid)', 'Arrows / ⇧ Arrows'],
      ],
    ],
    [
      'View',
      [
        ['Zoom in / out / 100%', `${m}+ / ${m}- / ${m}0`],
        ['Fit to content', `${m}⇧H`],
        ['Pan', 'Space + drag, scroll, or right-drag'],
        ['Zoom around cursor', `${m} + scroll`],
        ['Layers', `${m}⇧L`],
        ['This list', `${m}/`],
      ],
    ],
  ];
  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose} wide>
      <div className="grid gap-5 sm:grid-cols-2">
        {groups.map(([title, rows]) => (
          <section key={title}>
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</h3>
            <dl className="text-[13px]">
              {rows.map(([what, keys]) => (
                <div key={what} className="flex justify-between gap-4 py-1">
                  <dt>{what}</dt>
                  <dd className="whitespace-nowrap font-mono text-[12px] text-muted">{keys}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
