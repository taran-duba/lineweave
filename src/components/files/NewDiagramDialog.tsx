'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { Dialog } from '@/components/overlays';
import { Button } from '@/components/ui';
import { TEMPLATES } from '@/lib/templates';

/** Name a new diagram and pick a template to start from. */
export function NewDiagramDialog({
  busy,
  onCreate,
  onClose,
}: {
  busy: boolean;
  onCreate(name: string, templateId: string): void;
  onClose(): void;
}) {
  const [name, setName] = useState('Untitled diagram');
  const [template, setTemplate] = useState('blank');
  const submit = () => name.trim() && !busy && onCreate(name.trim(), template);
  return (
    <Dialog
      title="New diagram"
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!name.trim() || busy} onClick={submit}>
            {busy && <Loader2 size={14} className="animate-spin" />} Create
          </Button>
        </>
      }
    >
      <label className="block text-[13px]">
        <span className="text-muted">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-1 h-9 w-full rounded-md border border-border bg-bg px-2 outline-none focus:border-accent"
        />
      </label>
      <p className="mb-2 mt-4 text-[13px] text-muted">Start from</p>
      <div role="radiogroup" aria-label="Template" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={template === t.id}
            onClick={() => setTemplate(t.id)}
            onDoubleClick={submit}
            className={clsx(
              'rounded-lg border p-3 text-left hover:bg-panel-2',
              template === t.id ? 'border-accent bg-accent-soft' : 'border-border',
            )}
          >
            <span className="block text-[13px] font-medium">{t.name}</span>
            <span className="mt-0.5 block text-[12px] text-muted">{t.description}</span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}
