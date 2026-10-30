'use client';

import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Underline } from 'lucide-react';
import { ColorInput, Field, IconButton, NumberInput, Section, Select, Stepper } from '@/components/ui';
import { pagesOf } from '@/lib/drawio/ydoc';
import { storedCellStyle } from '@/lib/graph/darkCanvas';
import { ConnectorSection } from './format/ConnectorSection';
import { DiagramSection } from './format/DiagramSection';
import { setStyle, setStyles } from './format/setStyle';
import { useEditor, useGraphVersion, useYVersion } from './hooks';

const FONT_BOLD = 1;
const FONT_ITALIC = 2;
const FONT_UNDERLINE = 4;

const PATTERNS = {
  solid: { dashed: null, dashPattern: null },
  dashed: { dashed: 1, dashPattern: null },
  dotted: { dashed: 1, dashPattern: '1 4' },
} as const;

export function FormatPanel() {
  const { canvas, session, pageId } = useEditor();
  useGraphVersion(canvas);
  const page = pagesOf(session.doc).get(pageId);
  useYVersion(page);
  const graph = canvas?.graph;
  const cells = graph?.getSelectionCells() ?? [];

  if (!graph || !cells.length) {
    return (
      <aside className="w-64 shrink-0 overflow-y-auto border-l border-border bg-panel" aria-label="Format">
        <DiagramSection page={page} readOnly={session.readOnly} />
      </aside>
    );
  }

  const readOnly = session.readOnly;
  const first = cells[0];
  // Show the real colors, not the dark-canvas display swap.
  const style = storedCellStyle(graph, first) as Record<string, unknown>;
  const vertices = cells.filter((c) => c.isVertex());
  const edges = cells.filter((c) => c.isEdge());
  const fontStyle = Number(style.fontStyle ?? 0);
  const set = (key: string, value: unknown, target = cells) => !readOnly && setStyle(graph, target, key, value);

  const toggleFont = (flag: number) => {
    if (readOnly) return;
    graph.batchUpdate(() => {
      for (const c of cells) {
        const s = Number(storedCellStyle(graph, c).fontStyle ?? 0);
        setStyle(graph, [c], 'fontStyle', s & flag ? s & ~flag : s | flag);
      }
    });
  };

  const geo = cells.length === 1 && first.isVertex() ? first.geometry : null;
  const setGeo = (key: 'x' | 'y' | 'width' | 'height', v: number) => {
    if (!geo || readOnly || !Number.isFinite(v)) return;
    const g = geo.clone();
    g[key] = key === 'width' || key === 'height' ? Math.max(1, v) : v;
    graph.getDataModel().setGeometry(first, g);
  };

  const pattern = !style.dashed ? 'solid' : style.dashPattern === '1 4' ? 'dotted' : 'dashed';

  return (
    <aside className="w-64 shrink-0 overflow-y-auto border-l border-border bg-panel" aria-label="Format">
      <fieldset disabled={readOnly} className="contents">
        {vertices.length > 0 && (
          <Section title="Fill">
            <Field label="Fill">
              <ColorInput value={style.fillColor as string} onChange={(v) => set('fillColor', v, vertices)} />
            </Field>
            <Field label="Rounded">
              <input
                type="checkbox"
                checked={!!style.rounded}
                onChange={(e) => set('rounded', e.target.checked ? 1 : 0, vertices)}
                className="accent-[var(--accent)]"
              />
            </Field>
            <Field label="Shadow">
              <input
                type="checkbox"
                checked={!!style.shadow}
                onChange={(e) => set('shadow', e.target.checked ? 1 : null, vertices)}
                className="accent-[var(--accent)]"
              />
            </Field>
          </Section>
        )}

        <Section title="Line">
          <Field label="Color">
            <ColorInput value={style.strokeColor as string} onChange={(v) => set('strokeColor', v)} />
          </Field>
          <Field label="Width">
            <Stepper label="Line width" min={0} max={50} value={Number(style.strokeWidth ?? 1)} onChange={(v) => set('strokeWidth', v)} />
          </Field>
          <Field label="Pattern">
            <Select value={pattern} onChange={(e) => !readOnly && setStyles(graph, cells, PATTERNS[e.target.value as keyof typeof PATTERNS])}>
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </Select>
          </Field>
          <Field label="Opacity">
            <Stepper label="Opacity" min={0} max={100} step={5} value={Number(style.opacity ?? 100)} onChange={(v) => set('opacity', v)} />
          </Field>
        </Section>

        {edges.length > 0 && canvas && <ConnectorSection graph={graph} edges={edges} style={style} actions={canvas.actions} />}

        <Section title="Text">
          <div className="flex items-center gap-0.5">
            <IconButton label="Bold" active={!!(fontStyle & FONT_BOLD)} onClick={() => toggleFont(FONT_BOLD)}>
              <Bold size={15} />
            </IconButton>
            <IconButton label="Italic" active={!!(fontStyle & FONT_ITALIC)} onClick={() => toggleFont(FONT_ITALIC)}>
              <Italic size={15} />
            </IconButton>
            <IconButton label="Underline" active={!!(fontStyle & FONT_UNDERLINE)} onClick={() => toggleFont(FONT_UNDERLINE)}>
              <Underline size={15} />
            </IconButton>
            <div className="flex-1" />
            {(['left', 'center', 'right'] as const).map((al) => {
              const Icon = al === 'left' ? AlignLeft : al === 'center' ? AlignCenter : AlignRight;
              return (
                <IconButton key={al} label={`Align ${al}`} active={(style.align ?? 'center') === al} onClick={() => set('align', al)}>
                  <Icon size={15} />
                </IconButton>
              );
            })}
          </div>
          <Field label="Size">
            <Stepper label="Font size" min={1} max={400} value={Number(style.fontSize ?? 12)} onChange={(v) => set('fontSize', v)} />
          </Field>
          <Field label="Color">
            <ColorInput value={style.fontColor as string} allowNone={false} onChange={(v) => set('fontColor', v)} />
          </Field>
        </Section>

        {geo && (
          <Section title="Arrange">
            <div className="grid grid-cols-2 gap-2">
              {(['x', 'y', 'width', 'height'] as const).map((k) => (
                <label key={k} className="flex items-center gap-1.5 text-[12px] text-muted">
                  <span className="w-3 uppercase">{k[0]}</span>
                  <NumberInput className="w-full" value={Math.round(geo[k])} onChange={(e) => setGeo(k, Number(e.target.value))} />
                </label>
              ))}
            </div>
          </Section>
        )}
      </fieldset>
    </aside>
  );
}
