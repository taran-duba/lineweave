import { SCHEMATIC_KEY } from '../wires';
import type { DeviceItem, DevicePin } from './device';

/**
 * A swerve module drawn like the triangular plate on the robot's bellypan, with a circle at each corner: the
 * encoder at the apex, the drive motor at the bottom left and the azimuth (steer) motor at the bottom right. Each
 * circle's four leads run out to terminals on the nearest edge of the block. The shapes are an SVG inside the label,
 * so the cell stays a plain box and its terminals (draw.io's `points` style) land the same in both editors.
 */

const W = 280;
const H = 240;
const PITCH = 20;
const R = 30;
const MOTOR: [string, string] = ['#f5f5f5', '#666666'];
const ENCODER: [string, string] = ['#e1d5e7', '#9673a6'];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const px = (n: number) => `${+((n / W) * 100).toFixed(3)}%`;
const py = (n: number) => `${+((n / H) * 100).toFixed(3)}%`;

export interface SwerveSpec {
  id: string;
  title: string;
  /** Line under the title. */
  part: string;
  encoder: 'cancoder' | 'throughbore';
  /** Plate fill and outline. */
  colors: [fill: string, stroke: string];
  tags?: string;
}

interface Corner {
  name: string;
  caption: string;
  cx: number;
  cy: number;
  edge: 'top' | 'bottom';
  colors: [string, string];
  leads: string[];
}

export function swerveModule(spec: SwerveSpec): DeviceItem {
  const enc = spec.encoder === 'cancoder' ? 'CANcoder' : 'ThroughBore';
  const corners: Corner[] = [
    { name: enc, caption: 'ENCODER', cx: 140, cy: 60, edge: 'top', colors: ENCODER, leads: spec.encoder === 'cancoder' ? ['GND', 'V+', 'L', 'H'] : ['+', '-', 'L', 'H'] },
    { name: 'DRIVE', caption: 'DRIVE', cx: 50, cy: 170, edge: 'bottom', colors: MOTOR, leads: ['V-', 'H', 'L', 'V+'] },
    { name: 'AZIMUTH', caption: 'AZIMUTH', cx: 230, cy: 170, edge: 'bottom', colors: MOTOR, leads: ['V-', 'H', 'L', 'V+'] },
  ];

  const pins: DevicePin[] = [];
  const labels: string[] = [];
  const lines: string[] = [];
  const circles: string[] = [];
  const [fill, stroke] = spec.colors;

  for (const c of corners) {
    const y = c.edge === 'top' ? 0 : H;
    c.leads.forEach((lead, i) => {
      // Leads sit a pitch apart, centered under (or over) the circle, so every terminal is on the 10px grid.
      const x = c.cx + (i - (c.leads.length - 1) / 2) * PITCH;
      pins.push({ name: `${c.name} ${lead}`, side: c.edge, x: x / W, y: y / H });
      lines.push(`<line x1="${x}" y1="${y}" x2="${x}" y2="${c.cy}" stroke="${MOTOR[1]}" stroke-width="1" vector-effect="non-scaling-stroke"/>`);
      const anchor = c.edge === 'top' ? 'top:2px' : 'bottom:2px';
      labels.push(`<span style="position:absolute;left:${px(x)};${anchor};transform:translateX(-50%);white-space:nowrap;">${esc(lead)}</span>`);
    });
    circles.push(
      `<circle cx="${c.cx}" cy="${c.cy}" r="${R}" fill="${c.colors[0]}" stroke="${c.colors[1]}" stroke-width="1" vector-effect="non-scaling-stroke"/>`,
    );
    labels.push(
      `<span style="position:absolute;left:${px(c.cx)};top:${py(c.cy)};transform:translate(-50%,-50%);font-size:8px;font-weight:bold;white-space:nowrap;">${esc(c.caption)}</span>`,
    );
  }

  const [top, left, right] = corners;
  const plate = `<polygon points="${top.cx},${top.cy} ${right.cx},${right.cy} ${left.cx},${left.cy}" fill="${fill}" stroke="${stroke}" stroke-width="1" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
  const svg =
    `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;">` +
    `${plate}${lines.join('')}${circles.join('')}</svg>`;
  // Under the plate's base, between the two bottom circles.
  const title =
    `<div style="position:absolute;left:${px(left.cx + R)};right:${px(W - right.cx + R)};top:${py(176)};height:${py(40)};display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.15;">` +
    `<b style="font-size:12px;">${esc(spec.title)}</b><span style="font-size:9px;opacity:0.75;">${esc(spec.part)}</span></div>`;
  const value = `<div style="position:relative;width:100%;height:100%;font-size:9px;">${svg}${title}${labels.join('')}</div>`;
  const style =
    `html=1;overflow=fill;whiteSpace=wrap;spacing=0;verticalAlign=top;fillColor=none;strokeColor=none;pointerEvents=1;fontColor=#1a1a1a;` +
    `points=${JSON.stringify(pins.map((p) => [p.x, p.y, 0]))};device=${spec.id};${SCHEMATIC_KEY}`;
  return { id: spec.id, title: spec.title, style, width: W, height: H, value, tags: spec.tags ?? '', pins };
}
