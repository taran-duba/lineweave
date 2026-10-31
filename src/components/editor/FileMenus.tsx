'use client';

import { useState } from 'react';
import { ChevronDown, Download, Loader2 } from 'lucide-react';
import type { Graph } from '@maxgraph/core';
import { DropdownMenu, type MenuItem } from '@/components/ui';
import { serializeDrawio } from '@/lib/drawio/codec';
import { docToFile, pagesOf } from '@/lib/drawio/ydoc';
import { backgroundOf, documentToPdf, printDocument } from '@/lib/graph/documentExport';
import { downloadBlob, exportJpeg, exportPng, exportSvg } from '@/lib/graph/export';
import { modKey, useEditor, useStore } from './hooks';

function safeName(title: string) {
  return title.replace(/\.drawio$/i, '').replace(/[\\/:*?"<>|]+/g, '-') || 'diagram';
}

/** Runs an export and shows a spinner on the trigger meanwhile; errors are reported, not swallowed. */
function useBusy() {
  const [busy, setBusy] = useState(false);
  const run = (task: () => Promise<unknown> | void) => async () => {
    setBusy(true);
    try {
      await task();
    } catch (e) {
      alert(`That didn't work: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

export function ExportMenu() {
  const { canvas, session, pageId } = useEditor();
  const title = useStore(session.title);
  const { busy, run } = useBusy();
  const name = safeName(title);
  const graph = canvas?.graph as Graph | undefined;
  const page = pagesOf(session.doc).get(pageId);
  const background = backgroundOf(page);
  const xml = () => serializeDrawio(docToFile(session.doc));
  const needsGraph = !graph;

  const items: MenuItem[] = [
    { label: 'PNG image', hint: 'this page', disabled: needsGraph, onSelect: run(async () => downloadBlob(await exportPng(graph!, { background }), `${name}.png`)) },
    {
      label: 'PNG, editable',
      hint: 'opens in draw.io',
      disabled: needsGraph,
      onSelect: run(async () => downloadBlob(await exportPng(graph!, { background, embedXml: xml() }), `${name}.drawio.png`)),
    },
    { label: 'JPEG image', hint: 'this page', disabled: needsGraph, onSelect: run(async () => downloadBlob(await exportJpeg(graph!, { background }), `${name}.jpg`)) },
    {
      label: 'SVG image',
      hint: 'this page',
      disabled: needsGraph,
      onSelect: run(() => downloadBlob(new Blob([exportSvg(graph!, { background })], { type: 'image/svg+xml' }), `${name}.svg`)),
    },
    {
      label: 'SVG, editable',
      hint: 'opens in draw.io',
      disabled: needsGraph,
      onSelect: run(() =>
        downloadBlob(new Blob([exportSvg(graph!, { background, embedXml: xml() })], { type: 'image/svg+xml' }), `${name}.drawio.svg`),
      ),
    },
    {
      label: 'PDF',
      hint: 'all pages',
      onSelect: run(async () => downloadBlob(await documentToPdf(session.doc), `${name}.pdf`)),
    },
    { label: '.drawio file', hint: 'all pages', onSelect: run(() => downloadBlob(new Blob([xml()], { type: 'application/xml' }), `${name}.drawio`)) },
  ];

  return (
    <DropdownMenu
      label="Export"
      align="right"
      items={items}
      trigger={
        <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-panel px-3 text-sm font-medium">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Export <ChevronDown size={14} />
        </span>
      }
    />
  );
}

export function FileMenu() {
  const { session, openDialog } = useEditor();
  const title = useStore(session.title);
  const { busy, run } = useBusy();
  const items: MenuItem[] = [
    { label: 'Import…', hint: 'drawio, vsdx, png, svg', disabled: session.readOnly, onSelect: () => openDialog({ kind: 'import' }) },
    { label: 'Insert Mermaid or CSV…', disabled: session.readOnly, onSelect: () => openDialog({ kind: 'import' }) },
    {
      label: 'Print…',
      hint: `${modKey()}P`,
      onSelect: run(() => printDocument(session.doc, title)),
    },
    ...(session.versions ? [{ label: 'Version history…', onSelect: () => openDialog({ kind: 'versions' }) }] : []),
    { label: 'Keyboard shortcuts', hint: `${modKey()}/`, onSelect: () => openDialog({ kind: 'shortcuts' }) },
  ];
  return (
    <DropdownMenu
      label="File"
      items={items}
      trigger={<span className="inline-flex items-center gap-1">{busy && <Loader2 size={13} className="animate-spin" />}File</span>}
    />
  );
}
