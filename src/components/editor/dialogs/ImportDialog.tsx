'use client';

import { useRef, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { Dialog } from '@/components/overlays';
import { Button } from '@/components/ui';
import { IMPORT_ACCEPT, importFile, importText } from '@/lib/drawio/importers';
import type { FileData } from '@/lib/drawio/types';
import { importIntoDiagram } from '@/lib/graph/importInto';
import type { CanvasHandle } from '../hooks';

const EXAMPLES = {
  mermaid: `flowchart TD
  A([Start]) --> B{Is it working?}
  B -->|Yes| C[Ship it]
  B -->|No| D[Debug] --> B`,
  csv: `# label: %name%<br><i style="color:gray">%role%</i>
# style: rounded=1;whiteSpace=wrap;html=1;fillColor=%fill%;
# connect: {"from": "manager", "to": "name", "invert": true, "style": "endArrow=blockThin;endFill=1;edgeStyle=orthogonalEdgeStyle;"}
# layout: verticaltree
# ignore: fill
name,role,manager,fill
Ada,CEO,,#dae8fc
Grace,CTO,Ada,#d5e8d4
Linus,Engineer,Grace,#fff2cc
Margaret,Engineer,Grace,#fff2cc`,
};

/**
 * Brings other diagrams in: .drawio/.xml, editable PNG/SVG, Visio .vsdx (also
 * how Lucidchart exports), or pasted Mermaid / CSV / draw.io XML.
 */
export function ImportDialog({ canvas, doc, onClose }: { canvas: CanvasHandle; doc: import('yjs').Doc; onClose(): void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const run = async (load: () => Promise<FileData>) => {
    setBusy(true);
    setError(null);
    try {
      const file = await load();
      const added = importIntoDiagram(doc, canvas.graph, canvas.binding, file);
      if (added) alert(`Also added ${added} more page${added === 1 ? '' : 's'} from that file.`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Import"
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!text.trim() || busy} onClick={() => run(() => importText(text))}>
            {busy && <Loader2 size={14} className="animate-spin" />} Insert diagram
          </Button>
        </>
      }
    >
      <button
        type="button"
        data-autofocus
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) void run(() => importFile(f));
        }}
        className={clsx(
          'flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-[13px] text-muted',
          dragOver ? 'border-accent bg-accent-soft' : 'border-border hover:bg-panel-2',
        )}
      >
        {busy ? <Loader2 className="animate-spin" /> : <FileUp />}
        <span>
          <span className="font-medium text-text">Choose a file</span> or drop it here
        </span>
        <span className="text-[12px]">.drawio · .xml · editable .png/.svg · Visio .vsdx (also Lucidchart exports) · .csv · .mmd</span>
      </button>
      <input
        ref={input}
        type="file"
        accept={IMPORT_ACCEPT}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void run(() => importFile(f));
        }}
      />
      <div className="mt-4 flex items-center justify-between text-[13px]">
        <span className="text-muted">Or paste a Mermaid flowchart, CSV or draw.io XML</span>
        <span className="flex gap-2 text-[12px]">
          <button type="button" className="text-accent hover:underline" onClick={() => setText(EXAMPLES.mermaid)}>
            Mermaid example
          </button>
          <button type="button" className="text-accent hover:underline" onClick={() => setText(EXAMPLES.csv)}>
            CSV example
          </button>
        </span>
      </div>
      <textarea
        aria-label="Diagram text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        rows={9}
        placeholder={'flowchart LR\n  A --> B'}
        className="mt-1 w-full resize-y rounded-md border border-border bg-bg p-2 font-mono text-[12px] leading-relaxed outline-none focus:border-accent"
      />
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
    </Dialog>
  );
}
