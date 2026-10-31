'use client';

import { useRef, useState } from 'react';
import { ImageUp, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { Dialog } from '@/components/overlays';
import { Button } from '@/components/ui';
import { imageFromUrl } from '@/lib/graph/images';
import type { CanvasHandle } from '../hooks';

/** Insert an image from your computer (embedded in the file) or from a web address. */
export function InsertImageDialog({ canvas, onClose }: { canvas: CanvasHandle; onClose(): void }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  const fromFile = (file: File | undefined) => file && run(() => canvas.actions.insertImageFile(file));
  const fromUrl = () => url.trim() && run(async () => canvas.actions.insertImage(await imageFromUrl(url)));

  return (
    <Dialog
      title="Insert image"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!url.trim() || busy} onClick={fromUrl}>
            Insert from link
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
          fromFile(e.dataTransfer.files[0]);
        }}
        className={clsx(
          'flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-[13px] text-muted',
          dragOver ? 'border-accent bg-accent-soft' : 'border-border hover:bg-panel-2',
        )}
      >
        {busy ? <Loader2 className="animate-spin" /> : <ImageUp />}
        <span>
          <span className="font-medium text-text">Choose an image</span> or drop it here
        </span>
        <span className="text-[12px]">Large images are resized to 1600px. You can also paste an image onto the canvas.</span>
      </button>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => fromFile(e.target.files?.[0])} />
      <label className="mt-4 block text-[13px]">
        <span className="text-muted">Or link to an image on the web</span>
        <input
          value={url}
          placeholder="https://example.com/picture.png"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fromUrl()}
          className="mt-1 h-9 w-full rounded-md border border-border bg-bg px-2 outline-none focus:border-accent"
        />
      </label>
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
    </Dialog>
  );
}
