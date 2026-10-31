import { generateNKeysBetween } from 'fractional-indexing';
import { newId } from '@/lib/drawio/codec';
import type { CellData } from '@/lib/drawio/types';
import { cellFromY, cellToY, writeCellFields } from '@/lib/drawio/ydoc';
import type { YGraphBinding } from './yGraphBinding';

/**
 * Edits made straight to the Y.Doc (rather than through maxGraph): used for
 * things maxGraph doesn't model, like custom data and raw style strings. They
 * use the binding's import origin, so the canvas updates and undo works.
 */

export function readCell(binding: YGraphBinding, id: string): CellData | null {
  const m = binding.cells.get(id);
  return m ? cellFromY(id, m) : null;
}

export function updateCell(binding: YGraphBinding, id: string, patch: Partial<CellData>): void {
  const m = binding.cells.get(id);
  if (!m) return;
  binding.page.doc!.transact(() => writeCellFields(m, patch), binding.importOrigin);
}

/**
 * Inserts copies of `cells` (e.g. from the clipboard) under `targetParent`,
 * with fresh ids and connections re-mapped. Cells whose parent isn't part of
 * the set become top-level children of `targetParent` and are offset by
 * (dx, dy). Returns the new ids of those top-level cells.
 */
export function insertCopies(
  binding: YGraphBinding,
  cells: CellData[],
  targetParent: string,
  dx: number,
  dy: number,
): string[] {
  const ids = new Map(cells.map((c) => [c.id, newId()]));
  const topLevel: string[] = [];
  const copies = cells.map((c): CellData => {
    const isTop = !c.parent || !ids.has(c.parent);
    const copy: CellData = {
      ...c,
      id: ids.get(c.id)!,
      parent: isTop ? targetParent : ids.get(c.parent!)!,
      source: c.source ? ids.get(c.source) : undefined,
      target: c.target ? ids.get(c.target) : undefined,
    };
    if (isTop) {
      topLevel.push(copy.id);
      const g = c.geometry;
      if (g) {
        const shift = (p: { x: number; y: number }) => ({ x: p.x + dx, y: p.y + dy });
        copy.geometry = {
          ...g,
          ...(c.vertex || !g.relative ? { x: (g.x ?? 0) + dx, y: (g.y ?? 0) + dy } : {}),
          points: g.points?.map(shift),
          sourcePoint: g.sourcePoint && shift(g.sourcePoint),
          targetPoint: g.targetPoint && shift(g.targetPoint),
        };
      }
    }
    return copy;
  });

  // Append each group of siblings after the parent's existing children.
  const byParent = new Map<string, CellData[]>();
  for (const c of copies) {
    if (!byParent.has(c.parent!)) byParent.set(c.parent!, []);
    byParent.get(c.parent!)!.push(c);
  }
  binding.page.doc!.transact(() => {
    for (const [parent, group] of byParent) {
      let last: string | null = null;
      binding.cells.forEach((m) => {
        if (m.get('parent') !== parent) return;
        const o = m.get('order') as string | undefined;
        if (o && (last === null || o > last)) last = o;
      });
      const keys = generateNKeysBetween(last, null, group.length);
      group.forEach((c, i) => {
        c.order = keys[i];
        binding.cells.set(c.id, cellToY(c));
      });
    }
  }, binding.importOrigin);
  return topLevel;
}

