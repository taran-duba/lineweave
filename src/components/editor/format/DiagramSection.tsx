'use client';

import { ColorInput, Field, Section, Select } from '@/components/ui';
import type { Attrs } from '@/lib/drawio/types';
import type { YPage } from '@/lib/drawio/ydoc';
import { PAPER_SIZES, paperSizeId, readPageSettings } from '@/lib/graph/pageView';

/** Page-level settings (stored as <mxGraphModel> attributes, so they're saved and shared). */
export function DiagramSection({ page, readOnly }: { page: YPage | undefined; readOnly: boolean }) {
  const attrs = (page?.get('modelAttrs') as Attrs | undefined) ?? {};
  const settings = readPageSettings(attrs);
  const landscape = settings.width > settings.height;
  const update = (patch: Record<string, string | null>) => {
    if (!page || readOnly) return;
    const next: Attrs = { ...attrs };
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete next[k];
      else next[k] = v;
    }
    page.set('modelAttrs', next);
  };
  const setPaper = (id: string, asLandscape: boolean) => {
    const paper = PAPER_SIZES.find((p) => p.id === id);
    const w = paper?.width ?? Math.min(settings.width, settings.height);
    const h = paper?.height ?? Math.max(settings.width, settings.height);
    update({ pageWidth: String(asLandscape ? h : w), pageHeight: String(asLandscape ? w : h), pageScale: '1' });
  };
  const checkbox = (checked: boolean, onChange: (v: boolean) => void) => (
    <input
      type="checkbox"
      disabled={readOnly}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="accent-[var(--accent)]"
    />
  );

  return (
    <fieldset disabled={readOnly} className="contents">
      <Section title="Diagram">
        <Field label="Grid">{checkbox(attrs.grid !== '0', (v) => update({ grid: v ? '1' : '0' }))}</Field>
        <Field label="Page view">{checkbox(settings.visible, (v) => update({ page: v ? '1' : '0' }))}</Field>
        <Field label="Background">
          <ColorInput
            value={attrs.background && attrs.background !== 'none' ? attrs.background : 'none'}
            onChange={(v) => update({ background: v === 'none' ? null : v })}
          />
        </Field>
      </Section>
      {settings.visible && (
        <Section title="Paper">
          <Field label="Size">
            <Select value={paperSizeId(settings)} onChange={(e) => setPaper(e.target.value, landscape)}>
              {PAPER_SIZES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
              {paperSizeId(settings) === 'custom' && (
                <option value="custom">
                  Custom ({Math.round(settings.width)}×{Math.round(settings.height)})
                </option>
              )}
            </Select>
          </Field>
          <Field label="Orientation">
            <Select value={landscape ? 'landscape' : 'portrait'} onChange={(e) => setPaper(paperSizeId(settings), e.target.value === 'landscape')}>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </Select>
          </Field>
        </Section>
      )}
      <Section title="Tips">
        <p className="text-[12px] leading-relaxed text-muted">
          Drag shapes from the left, or click one to add it. Hover a shape and click a blue arrow to add a connected
          copy, or drag from an × to connect. Hold Space to pan, ⌘/Ctrl + scroll to zoom.
        </p>
      </Section>
    </fieldset>
  );
}
