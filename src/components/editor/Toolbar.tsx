'use client';

import {
  BringToFront,
  ChevronDown,
  ImagePlus,
  Keyboard,
  Layers,
  Network,
  Search,
  CopyPlus,
  Group,
  Maximize,
  Redo2,
  SendToBack,
  Trash2,
  Undo2,
  Ungroup,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Divider, DropdownMenu, IconButton } from '@/components/ui';
import { LAYOUTS } from '@/lib/graph/layouts';
import { modKey, useEditor, useGraphVersion } from './hooks';

export function Toolbar() {
  const { canvas, session, openDialog, layersOpen, setLayersOpen } = useEditor();
  useGraphVersion(canvas);
  const editable = !!canvas && !session.readOnly;
  const a = canvas?.actions;
  const selected = canvas?.graph.getSelectionCount() ?? 0;
  const scale = canvas?.graph.view.scale ?? 1;
  const mod = modKey();

  return (
    <div className="flex h-10 shrink-0 items-center gap-0.5 border-b border-border bg-panel px-2">
      <IconButton label={`Undo (${mod}Z)`} disabled={!editable || !canvas.undo.canUndo()} onClick={a?.undo}>
        <Undo2 size={16} />
      </IconButton>
      <IconButton label={`Redo (${mod}⇧Z)`} disabled={!editable || !canvas.undo.canRedo()} onClick={a?.redo}>
        <Redo2 size={16} />
      </IconButton>
      <Divider />
      <IconButton label="Delete (Del)" disabled={!editable || !selected} onClick={a?.deleteSelection}>
        <Trash2 size={16} />
      </IconButton>
      <IconButton label={`Duplicate (${mod}D)`} disabled={!editable || !selected} onClick={a?.duplicate}>
        <CopyPlus size={16} />
      </IconButton>
      <IconButton label="Bring to front" disabled={!editable || !selected} onClick={a?.toFront}>
        <BringToFront size={16} />
      </IconButton>
      <IconButton label="Send to back" disabled={!editable || !selected} onClick={a?.toBack}>
        <SendToBack size={16} />
      </IconButton>
      <IconButton label={`Group (${mod}G)`} disabled={!editable || selected < 2} onClick={a?.group}>
        <Group size={16} />
      </IconButton>
      <IconButton label={`Ungroup (${mod}⇧G)`} disabled={!editable || !selected} onClick={a?.ungroup}>
        <Ungroup size={16} />
      </IconButton>
      <Divider />
      <DropdownMenu
        label="Auto layout"
        disabled={!editable}
        trigger={
          <>
            <Network size={16} /> Layout <ChevronDown size={13} className="text-muted" />
          </>
        }
        items={LAYOUTS.map((l) => ({ label: l.label, onSelect: () => a?.applyLayout(l.id) }))}
      />
      <IconButton label="Insert image" disabled={!editable} onClick={() => openDialog({ kind: 'image' })}>
        <ImagePlus size={16} />
      </IconButton>
      <div className="flex-1" />
      <IconButton label={`Find (${mod}F)`} disabled={!canvas} onClick={() => openDialog({ kind: 'find' })}>
        <Search size={16} />
      </IconButton>
      <IconButton label={`Layers (${mod}⇧L)`} active={layersOpen} disabled={!canvas} onClick={() => setLayersOpen(!layersOpen)}>
        <Layers size={16} />
      </IconButton>
      <IconButton label={`Keyboard shortcuts (${mod}/)`} onClick={() => openDialog({ kind: 'shortcuts' })}>
        <Keyboard size={16} />
      </IconButton>
      <Divider />
      <IconButton label={`Zoom out (${mod}-)`} disabled={!canvas} onClick={a?.zoomOut}>
        <ZoomOut size={16} />
      </IconButton>
      <button
        type="button"
        title="Reset zoom"
        onClick={a?.zoomReset}
        className="h-8 w-14 rounded-md text-center text-[13px] tabular-nums hover:bg-panel-2"
      >
        {Math.round(scale * 100)}%
      </button>
      <IconButton label={`Zoom in (${mod}+)`} disabled={!canvas} onClick={a?.zoomIn}>
        <ZoomIn size={16} />
      </IconButton>
      <IconButton label="Fit to content" disabled={!canvas} onClick={a?.fit}>
        <Maximize size={16} />
      </IconButton>
    </div>
  );
}
