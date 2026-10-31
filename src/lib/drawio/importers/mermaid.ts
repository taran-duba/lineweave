import type { CellData, FileData } from '@/lib/drawio/types';
import { layoutCells, textSize } from './layout';

/**
 * Mermaid flowcharts → native, editable draw.io shapes (like draw.io's
 * Arrange → Insert → Mermaid). Supports `graph`/`flowchart` with the common
 * node shapes, edge kinds, edge labels, chains and `&`. Other Mermaid diagram
 * types, subgraphs and class/style lines aren't converted.
 */

const SHAPES: [open: string, close: string, style: string, size?: { width: number; height: number }][] = [
  ['(((', ')))', 'ellipse;shape=doubleEllipse;', { width: 70, height: 70 }],
  ['((', '))', 'ellipse;', { width: 70, height: 70 }],
  ['([', '])', 'rounded=1;arcSize=50;'],
  ['[[', ']]', 'shape=process;backgroundOutline=1;'],
  ['[(', ')]', 'shape=cylinder3;boundedLbl=1;backgroundOutline=1;size=15;', { width: 80, height: 80 }],
  ['{{', '}}', 'shape=hexagon;perimeter=hexagonPerimeter2;fixedSize=1;'],
  ['[/', '/]', 'shape=parallelogram;perimeter=parallelogramPerimeter;fixedSize=1;'],
  ['[\\', '\\]', 'shape=parallelogram;perimeter=parallelogramPerimeter;fixedSize=1;flipH=1;'],
  ['[/', '\\]', 'shape=trapezoid;perimeter=trapezoidPerimeter;fixedSize=1;'],
  ['[\\', '/]', 'shape=trapezoid;perimeter=trapezoidPerimeter;fixedSize=1;flipV=1;'],
  ['(', ')', 'rounded=1;'],
  ['[', ']', 'rounded=0;'],
  ['{', '}', 'rhombus;', { width: 110, height: 80 }],
  ['>', ']', 'shape=step;perimeter=stepPerimeter;fixedSize=1;size=12;'],
];
const BASE = 'whiteSpace=wrap;html=1;';

const ID = /^[A-Za-z0-9_][\w.-]*/;
const LINK_WITH_TEXT = /^\s*(-\.|--|==)\s+(.+?)\s+(-\.+->|-\.+-|-{2,}>|-{3,}|={2,}>|={3,})\s*/;
const LINK = /^\s*(<?)(-\.+->|-\.+-|-{2,}>|-{3,}|={2,}>|={3,}|--o|--x|~~~)\s*(?:\|([^|]*)\|\s*)?/;

interface Node {
  id: string;
  text?: string;
  style?: string;
  size?: { width: number; height: number };
}

function edgeStyle(link: string): string {
  const parts = ['edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;'];
  if (/^-\./.test(link)) parts.push('dashed=1;');
  if (link.startsWith('=')) parts.push('strokeWidth=2;');
  if (link.endsWith('>')) parts.push('endArrow=classic;');
  else if (link.endsWith('o')) parts.push('endArrow=oval;endFill=1;');
  else if (link.endsWith('x')) parts.push('endArrow=cross;');
  else parts.push('endArrow=none;');
  if (link === '~~~') parts.push('strokeColor=none;');
  return parts.join('');
}

const unquote = (s: string) => {
  const t = s.trim();
  return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
};

/** Parses one node reference, e.g. `A`, `A[Text]`, `B{"Yes?"}`. Returns it and the rest of the line. */
function parseNode(src: string): [Node, string] | null {
  const s = src.trimStart();
  const id = s.match(ID)?.[0];
  if (!id) return null;
  let rest = s.slice(id.length);
  for (const [open, close, style, size] of SHAPES) {
    if (!rest.startsWith(open)) continue;
    // Quoted text may contain the closing delimiter.
    const body = rest.slice(open.length);
    const quoted = body.trimStart().startsWith('"') ? body.match(/^\s*"[^"]*"\s*/)?.[0] : null;
    const end = quoted ? (body.slice(quoted.length).startsWith(close) ? quoted.length : -1) : body.indexOf(close);
    if (end < 0) continue;
    rest = body.slice(end + close.length);
    return [{ id, text: unquote(body.slice(0, end)), style, size }, rest];
  }
  return [{ id }, rest];
}

/** A group of nodes joined with `&`. */
function parseGroup(src: string): [Node[], string] | null {
  const nodes: Node[] = [];
  let rest = src;
  for (;;) {
    const parsed = parseNode(rest);
    if (!parsed) return nodes.length ? [nodes, rest] : null;
    nodes.push(parsed[0]);
    rest = parsed[1];
    const amp = rest.match(/^\s*&\s*/);
    if (!amp) return [nodes, rest];
    rest = rest.slice(amp[0].length);
  }
}

export function isMermaid(text: string): boolean {
  return /^\s*(?:%%[^\n]*\n\s*)*(graph|flowchart)\b/i.test(text);
}

export async function mermaidToDrawio(text: string): Promise<FileData> {
  const lines = text.replace(/%%.*$/gm, '').split(/\n|;/).map((l) => l.trim()).filter(Boolean);
  const header = lines.shift() ?? '';
  const dir = header.match(/^(?:graph|flowchart)\s+(TB|TD|BT|LR|RL)/i)?.[1]?.toUpperCase() ?? 'TD';
  if (!/^(graph|flowchart)\b/i.test(header)) throw new Error('Only Mermaid flowcharts ("graph TD" / "flowchart LR") can be converted.');

  const nodes = new Map<string, Node>();
  const edges: { from: string; to: string; label?: string; style: string }[] = [];
  const remember = (n: Node) => {
    const prev = nodes.get(n.id);
    nodes.set(n.id, { ...prev, ...Object.fromEntries(Object.entries(n).filter(([, v]) => v !== undefined)) } as Node);
  };

  for (const line of lines) {
    if (/^(subgraph|end|classDef|class|style|linkStyle|click|direction)\b/.test(line)) continue;
    const first = parseGroup(line);
    if (!first) continue;
    let [left, rest] = first;
    left.forEach(remember);
    for (;;) {
      let label: string | undefined;
      let link: string;
      const withText = rest.match(LINK_WITH_TEXT);
      const plain = withText ? null : rest.match(LINK);
      if (withText) {
        link = withText[3];
        label = unquote(withText[2]);
        rest = rest.slice(withText[0].length);
      } else if (plain) {
        link = plain[2];
        label = plain[3] !== undefined ? unquote(plain[3]) : undefined;
        rest = rest.slice(plain[0].length);
      } else break;
      const next = parseGroup(rest);
      if (!next) break;
      const [right, after] = next;
      right.forEach(remember);
      for (const a of left) for (const b of right) edges.push({ from: a.id, to: b.id, label, style: edgeStyle(link) });
      left = right;
      rest = after;
    }
  }
  if (!nodes.size) throw new Error('No nodes found in that Mermaid flowchart.');

  const prefix = `m${Math.random().toString(36).slice(2, 7)}-`;
  const cells: CellData[] = [];
  for (const n of nodes.values()) {
    const label = n.text ?? n.id;
    cells.push({
      id: prefix + n.id,
      parent: '1',
      value: label,
      style: (n.style ?? 'rounded=0;') + BASE,
      vertex: true,
      geometry: { ...(n.size ?? textSize(label)) },
      order: '', // assigned by layoutCells
    });
  }
  edges.forEach((e, i) =>
    cells.push({
      id: `${prefix}e${i}`,
      parent: '1',
      value: e.label,
      style: e.style,
      edge: true,
      source: prefix + e.from,
      target: prefix + e.to,
      geometry: { relative: true },
      order: '', // assigned by layoutCells
    }),
  );
  return layoutCells(cells, dir === 'LR' || dir === 'RL' ? 'horizontalFlow' : 'verticalFlow');
}
