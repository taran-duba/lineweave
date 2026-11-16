import { SCHEMATIC_KEY } from '../wires';
import type { DeviceItem, DevicePin } from './device';

/**
 * A swerve module drawn as a triangle with a motor or encoder at each corner: the encoder at the apex, the drive
 * motor at the bottom left and the azimuth (steer) motor at the bottom right. The triangle is an SVG inside the
 * label, so the cell stays a plain box and its terminals (draw.io's `points` style) land the same in both editors.
 */

const SIZE = 240;
const PITCH = 20;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pct = (n: number) => `${+((n / SIZE) * 100).toFixed(3)}%`;

export interface SwerveSpec {
  id: string;
  title: string;
  /** Line under the title. */
  part: string;
  encoder: 'cancoder' | 'throughbore';
  colors: [fill: string, stroke: string];
  tags?: string;
}

export function swerveModule(spec: SwerveSpec): DeviceItem {
  const pins: DevicePin[] = [];
  const labels: string[] = [];
  const add = (name: string, shown: string, x: number, y: number, side: DevicePin['side'], css: string) => {
    pins.push({ name, side, x: x / SIZE, y: y / SIZE });
    labels.push(`<span style="position:absolute;${css};white-space:nowrap;">${esc(shown)}</span>`);
  };

  // Motor leads in the Kraken's rear-cap order, along the base: drive on the left, azimuth on the right.
  const lead = (group: string, first: number) => {
    ['V-', 'H', 'L', 'V+'].forEach((pin, i) => {
      const x = first + i * PITCH;
      add(`${group} ${pin}`, pin, x, SIZE, 'bottom', `left:${pct(x)};bottom:2px;transform:translateX(-50%)`);
    });
    labels.push(
      `<span style="position:absolute;left:${pct(first - 10)};width:${pct(4 * PITCH)};bottom:13px;border-top:1px solid currentColor;` +
        `text-align:center;font-size:8px;line-height:11px;opacity:0.7;white-space:nowrap;">${group}</span>`,
    );
  };
  lead('DRIVE', 20);
  lead('AZIMUTH', 140);

  // Encoder leads on the two sloping sides near the apex. A side is half as far from the center as it is deep, so these stay on the 10px grid.
  const enc = spec.encoder === 'cancoder' ? 'CANcoder' : 'ThroughBore';
  const encLeads: [string, number, 'left' | 'right'][] =
    spec.encoder === 'cancoder'
      ? [['GND', 60, 'left'], ['V+', 100, 'left'], ['L', 60, 'right'], ['H', 100, 'right']]
      : [['+', 60, 'left'], ['-', 100, 'left'], ['L', 60, 'right'], ['H', 100, 'right']];
  for (const [pin, y, side] of encLeads) {
    const x = side === 'left' ? SIZE / 2 - y / 2 : SIZE / 2 + y / 2;
    const css = side === 'left' ? `left:calc(${pct(x)} + 5px);top:${pct(y)};transform:translateY(-50%)` : `right:calc(${pct(SIZE - x)} + 5px);top:${pct(y)};transform:translateY(-50%)`;
    add(`${enc} ${pin}`, pin, x, y, side, css);
  }
  labels.push(`<span style="position:absolute;left:0;right:0;top:${pct(20)};text-align:center;font-size:8px;opacity:0.7;">${enc.toUpperCase()}</span>`);

  const [fill, stroke] = spec.colors;
  const triangle =
    `<svg viewBox="0 0 ${SIZE} ${SIZE}" preserveAspectRatio="none" style="position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;">` +
    `<polygon points="${SIZE / 2},0 ${SIZE},${SIZE} 0,${SIZE}" fill="${fill}" stroke="${stroke}" stroke-width="1" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
  const title =
    `<div style="position:absolute;left:0;right:0;top:${pct(130)};height:${pct(70)};display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.15;">` +
    `<b style="font-size:12px;">${esc(spec.title)}</b><span style="font-size:9px;opacity:0.75;">${esc(spec.part)}</span></div>`;
  const value = `<div style="position:relative;width:100%;height:100%;font-size:9px;">${triangle}${title}${labels.join('')}</div>`;
  const style =
    `html=1;overflow=fill;whiteSpace=wrap;spacing=0;verticalAlign=top;fillColor=none;strokeColor=none;pointerEvents=1;fontColor=#1a1a1a;` +
    `points=${JSON.stringify(pins.map((p) => [p.x, p.y, 0]))};device=${spec.id};${SCHEMATIC_KEY}`;
  return { id: spec.id, title: spec.title, style, width: SIZE, height: SIZE, value, tags: spec.tags ?? '', pins };
}
