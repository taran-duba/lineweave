import { describe, expect, it } from 'vitest';
import { cellsFromText } from '@/lib/graph/clipboard';
import { PALETTES } from '@/lib/graph/palette';
import { iconUrl } from '@/lib/graph/palettes/icons';
import { LUCIDE_ICONS } from '@/lib/graph/palettes/lucideIcons';
import { parseDrawio } from '@/lib/drawio/codec';
import { displayImageUrl } from '@/lib/graph/createGraph';
import { TEMPLATES } from '@/lib/templates';

describe('shape libraries', () => {
  const items = PALETTES.flatMap((p) => p.items);

  it('have unique ids and sensible sizes', () => {
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    for (const i of items) {
      expect(i.style, i.id).toBeTruthy();
      expect(i.width, i.id).toBeGreaterThan(0);
      if (!i.edge) expect(i.height, i.id).toBeGreaterThan(0);
    }
  });

  it('multi-cell items are valid draw.io XML with nested rows and connections intact', () => {
    const multi = items.filter((i) => i.xml);
    expect(multi.map((i) => i.id)).toEqual(expect.arrayContaining(['uml-class', 'er-entity']));
    for (const i of multi) {
      const cells = cellsFromText(i.xml!)!;
      expect(cells.length, i.id).toBeGreaterThan(1);
      const top = cells.filter((c) => !c.parent);
      expect(top, i.id).toHaveLength(1);
      expect(cells.filter((c) => c.parent === top[0].id).length, i.id).toBeGreaterThan(0);
    }
  });

  it('network icons embed as draw.io-style image URLs that restore for display', () => {
    for (const name of Object.keys(LUCIDE_ICONS)) {
      const url = iconUrl(name);
      expect(url.startsWith('data:image/svg+xml,'), name).toBe(true);
      expect(url, name).not.toContain(';'); // ";" would split the style string
      const shown = displayImageUrl(url) as string;
      expect(shown.startsWith('data:image/svg+xml;base64,'), name).toBe(true);
      expect(atob(shown.split(',')[1])).toContain('<svg');
    }
  });
});

describe('templates', () => {
  it('are valid diagrams whose connectors point at existing shapes', () => {
    expect(TEMPLATES[0].id).toBe('blank');
    for (const t of TEMPLATES) {
      const file = parseDrawio(t.build());
      expect(file.pages.length, t.id).toBeGreaterThan(0);
      for (const page of file.pages) {
        const ids = new Set(page.cells.map((c) => c.id));
        for (const c of page.cells) {
          if (c.parent) expect(ids.has(c.parent), `${t.id}: ${c.id} parent`).toBe(true);
          if (c.source) expect(ids.has(c.source), `${t.id}: ${c.id} source`).toBe(true);
          if (c.target) expect(ids.has(c.target), `${t.id}: ${c.id} target`).toBe(true);
        }
      }
    }
  });
});
