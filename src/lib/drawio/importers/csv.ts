import type { Attrs, CellData, FileData } from '@/lib/drawio/types';
import type { LayoutId } from '@/lib/graph/layouts';
import { layoutCells, textSize } from './layout';

/**
 * draw.io's CSV import (Arrange → Insert → Advanced → CSV): `#` lines are
 * directives, then a header row and one shape per row. Supported directives:
 * label, style, width, height, identity, connect (repeatable), ignore, layout.
 * Without directives, the first column is the label.
 */

/** RFC 4180-ish CSV parsing (quoted fields, escaped quotes, newlines in quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}

interface Connect {
  from: string;
  to: string;
  invert?: boolean;
  label?: string;
  style?: string;
}

const LAYOUTS: Record<string, LayoutId | 'grid'> = {
  auto: 'verticalFlow',
  verticalflow: 'verticalFlow',
  horizontalflow: 'horizontalFlow',
  verticaltree: 'verticalTree',
  horizontaltree: 'horizontalTree',
  organic: 'organic',
  circle: 'circle',
  none: 'grid',
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function isDrawioCsv(text: string): boolean {
  return /^\s*#\s*(label|style|connect|layout|identity)\s*:/m.test(text);
}

export async function csvToDrawio(text: string): Promise<FileData> {
  const directives: Record<string, string> = {};
  const connects: Connect[] = [];
  const dataLines: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const d = line.match(/^\s*#\s*([a-z]+)\s*:\s*(.*)$/i);
    if (d) {
      const key = d[1].toLowerCase();
      if (key === 'connect') {
        try {
          connects.push(JSON.parse(d[2]) as Connect);
        } catch {
          throw new Error(`Couldn't read the "# connect:" line: ${d[2]}`);
        }
      } else directives[key] = d[2].trim();
    } else if (!/^\s*#/.test(line)) dataLines.push(line);
  }
  const [header, ...rows] = parseCsv(dataLines.join('\n'));
  if (!header || !rows.length) throw new Error('The CSV needs a header row and at least one data row.');
  const cols = header.map((h) => h.trim());
  const identity = directives.identity && cols.includes(directives.identity) ? directives.identity : null;
  const ignore = new Set((directives.ignore ?? '').split(',').map((s) => s.trim()));
  const fill = (template: string, values: Record<string, string>, html: boolean) =>
    template.replace(/%([\w.-]+)%/g, (_, k: string) => (html ? esc(values[k] ?? '') : (values[k] ?? '')));
  const labelTemplate = directives.label ?? `%${cols[0]}%`;
  const styleTemplate = directives.style ?? 'rounded=1;whiteSpace=wrap;html=1;';
  const num = (v: string | undefined) => (v && v !== 'auto' && Number.isFinite(Number(v)) ? Number(v) : null);

  const prefix = `c${Math.random().toString(36).slice(2, 7)}-`;
  const records = rows.map((r) => Object.fromEntries(cols.map((c, i) => [c, (r[i] ?? '').trim()])));
  const idOf = (rec: Record<string, string>, i: number) => prefix + (identity ? rec[identity] : String(i));

  const cells: CellData[] = records.map((rec, i) => {
    const value = fill(labelTemplate, rec, true);
    const size = textSize(value, { width: 120, height: 60 });
    const objAttrs: Attrs = {};
    for (const c of cols) if (!ignore.has(c) && c !== identity && rec[c]) objAttrs[c] = rec[c];
    return {
      id: idOf(rec, i),
      parent: '1',
      value,
      style: fill(styleTemplate, rec, false),
      vertex: true,
      geometry: { width: num(directives.width) ?? size.width, height: num(directives.height) ?? size.height },
      order: '', // assigned by layoutCells
      ...(Object.keys(objAttrs).length ? { objTag: 'object', objAttrs } : {}),
    };
  });

  let e = 0;
  for (const conn of connects) {
    records.forEach((rec, i) => {
      for (const ref of (rec[conn.from] ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
        const j = records.findIndex((r) => r[conn.to] === ref);
        if (j < 0) continue;
        const [src, dst] = conn.invert ? [idOf(records[j], j), idOf(rec, i)] : [idOf(rec, i), idOf(records[j], j)];
        cells.push({
          id: `${prefix}e${e++}`,
          parent: '1',
          value: conn.label,
          style: conn.style ?? 'edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=classic;',
          edge: true,
          source: src,
          target: dst,
          geometry: { relative: true },
          order: '', // assigned by layoutCells
        });
      }
    });
  }
  const layout = LAYOUTS[(directives.layout ?? (connects.length ? 'auto' : 'none')).toLowerCase()] ?? 'verticalFlow';
  return layoutCells(cells, layout);
}
