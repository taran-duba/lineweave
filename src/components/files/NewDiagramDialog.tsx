'use client';

import { useState } from 'react';
import { Folder, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { Dialog } from '@/components/overlays';
import { Button } from '@/components/ui';
import { TEMPLATES } from '@/lib/templates';
import { driveStub } from '@/lib/google/auth';

export interface Folder {
  id: string;
  name: string;
}

/** Name a new diagram and pick a template to start from. */
export function NewDiagramDialog({
  busy,
  onCreate,
  onClose,
}: {
  busy: boolean;
  onCreate(name: string, templateId: string, folder?: Folder): void;
  onClose(): void;
}) {
  const [name, setName] = useState('Untitled diagram');
  const [template, setTemplate] = useState('blank');
  const [folder, setFolder] = useState<Folder | undefined>();
  const [pickError, setPickError] = useState<string | null>(null);
  const submit = () => name.trim() && !busy && onCreate(name.trim(), template, folder);
  const chooseFolder = async () => {
    setPickError(null);
    try {
      const { pickFolder } = await import('@/lib/google/picker');
      const picked = await pickFolder();
      if (picked) setFolder({ id: picked.id, name: picked.name });
    } catch (e) {
      setPickError(e instanceof Error ? e.message : String(e));
    }
  };
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
      {!driveStub && (
        <div className="mt-4 flex items-center gap-2 text-[13px]">
          <span className="text-muted">Location</span>
          <span className="flex min-w-0 items-center gap-1.5 font-medium">
            <Folder size={14} className="shrink-0" />
            <span className="truncate">{folder?.name ?? 'My Drive'}</span>
          </span>
          <Button variant="ghost" onClick={chooseFolder} disabled={busy}>
            Choose…
          </Button>
          {folder && (
            <Button variant="ghost" onClick={() => setFolder(undefined)} disabled={busy}>
              Reset
            </Button>
          )}
        </div>
      )}
      {pickError && <p className="mt-1 text-[12px] text-danger">{pickError}</p>}
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
              'rounded-lg border p-3 text-left transition-all hover:-translate-y-0.5 hover:bg-panel-2',
              template === t.id ? 'border-accent bg-accent-soft shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_20%,transparent)]' : 'border-border',
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
