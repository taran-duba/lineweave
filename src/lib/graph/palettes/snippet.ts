/**
 * Tiny builders for multi-cell palette items and templates, as the
 * <mxGraphModel> XML that diagrams.net uses on its clipboard.
 */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A vertex. `parent` defaults to the layer; use another cell id to nest it (coordinates then are relative). */
export function vertex(id: string, value: string, style: string, b: Box, parent = '1'): string {
  return `<mxCell id="${id}" value="${esc(value)}" style="${esc(style)}" vertex="1" parent="${parent}"><mxGeometry x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" as="geometry"/></mxCell>`;
}

export function edge(id: string, source: string, target: string, style = 'edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;', value = ''): string {
  return `<mxCell id="${id}" value="${esc(value)}" style="${esc(style)}" edge="1" parent="1" source="${source}" target="${target}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
}

export function model(...cells: string[]): string {
  return `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join('')}</root></mxGraphModel>`;
}

/** A diagrams.net file with a single page. */
export function file(name: string, ...cells: string[]): string {
  return `<mxfile><diagram id="p1" name="${esc(name)}">${model(...cells)}</diagram></mxfile>`;
}

const ROW = 'text;strokeColor=none;fillColor=none;align=left;verticalAlign=top;spacingLeft=4;spacingRight=4;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;whiteSpace=wrap;html=1;';
const DIVIDER = 'line;strokeWidth=1;fillColor=none;align=left;verticalAlign=middle;spacingTop=-1;spacingLeft=3;spacingRight=3;rotatable=0;labelPosition=right;points=[];portConstraint=eastwest;strokeColor=#000000;';
const STACK = 'childLayout=stackLayout;horizontal=1;horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=1;marginBottom=0;whiteSpace=wrap;html=1;';

export const ROW_H = 26;

/** A stacked container (UML class, table): a header and rows that stretch with it. */
export function stack(
  id: string,
  title: string,
  rows: ({ text: string } | 'divider')[],
  opts: { w?: number; header?: string; at?: { x: number; y: number } } = {},
): string {
  const w = opts.w ?? 160;
  const head = opts.header ?? 'swimlane;fontStyle=1;align=center;verticalAlign=top;startSize=26;';
  const hh = 26;
  let y = hh;
  const kids = rows.map((r, i) => {
    const isDivider = r === 'divider';
    const h = isDivider ? 8 : ROW_H;
    const cell = vertex(`${id}-r${i}`, isDivider ? '' : r.text, isDivider ? DIVIDER : ROW, { x: 0, y, w, h }, id);
    y += h;
    return cell;
  });
  return vertex(id, title, head + STACK, { x: opts.at?.x ?? 0, y: opts.at?.y ?? 0, w, h: y }) + kids.join('');
}
