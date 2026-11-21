import { SCHEMATIC_KEY } from '../wires';
import type { DeviceItem, DevicePin } from './device';

/**
 * A swerve module drawn as its top cover: an angled plate with the drive and azimuth Krakens as circles overhanging
 * it and a small encoder circle on it. Each circle keeps the terminals of the real part, led out to the nearest edge
 * of the block: the drive motor to the left, the azimuth motor to the bottom and the encoder to the right. With
 * `powerpole` the Krakens use WCP's PowerPole adapter board layout (power plus two interchangeable CAN ports).
 * The shapes are an SVG inside the label, so the cell stays a plain box and its terminals (draw.io's `points` style)
 * land the same in both editors.
 */

const W = 320;
const H = 310;
const PITCH = 20;
const R = 50;
const ENC_R = 26;
/** Bottom terminals sit this far above the block's bottom edge, leaving room for their labels. */
const BOTTOM = 20;
const MOTOR: [string, string] = ['#ffffff', '#666666'];
const ENCODER: [string, string] = ['#e1d5e7', '#9673a6'];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const px = (n: number) => `${+((n / W) * 100).toFixed(3)}%`;
const py = (n: number) => `${+((n / H) * 100).toFixed(3)}%`;

export interface SwerveSpec {
  id: string;
  title: string;
  /** Line under the title. */
  part: string;
  /** Kraken models, shown in the circles. */
  driveMotor: string;
  steerMotor: string;
  encoder: 'cancoder' | 'throughbore';
  /** Use the PowerPole adapter board layout on both Krakens. */
  powerpole?: boolean;
  /** Cover fill and outline. */
  colors: [fill: string, stroke: string];
  tags?: string;
}

/** A terminal's full name and what is printed beside it. */
type Lead = [name: string, shown: string];

const motorLeads = (group: string, powerpole: boolean): Lead[] =>
  powerpole
    ? [
        [`${group} POWER V+`, 'V+'],
        [`${group} POWER V-`, 'V-'],
        [`${group} CAN in H`, 'H in'],
        [`${group} CAN in L`, 'L in'],
        [`${group} CAN out H`, 'H out'],
        [`${group} CAN out L`, 'L out'],
      ]
    : [
        [`${group} V-`, 'V-'],
        [`${group} CAN H`, 'H'],
        [`${group} CAN L`, 'L'],
        [`${group} V+`, 'V+'],
      ];

export function swerveModule(spec: SwerveSpec): DeviceItem {
  const enc = spec.encoder === 'cancoder' ? 'CANcoder' : 'ThroughBore';
  const encLeads: Lead[] = (spec.encoder === 'cancoder' ? ['GND', 'V+', 'L', 'H'] : ['+', '-', 'L', 'H']).map((l) => [`${enc} ${l}`, l]);
  const pins: DevicePin[] = [];
  const labels: string[] = [];
  const lines: string[] = [];
  const add = (name: string, side: DevicePin['side'], x: number, y: number) => pins.push({ name, side, x: x / W, y: y / H });
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    lines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${MOTOR[1]}" stroke-width="1" vector-effect="non-scaling-stroke"/>`);
  // Leads sit a pitch apart, centered on their circle, so every terminal is on the 10px grid.
  const spread = (center: number, i: number, n: number) => center + (i - (n - 1) / 2) * PITCH;

  const drive = { cx: 90, cy: 70 };
  const steer = { cx: 170, cy: 210 };
  const sensor = { cx: 250, cy: 130 };

  // Drive: out to the left edge, label above each lead.
  const driveLeads = motorLeads('DRIVE', !!spec.powerpole);
  driveLeads.forEach(([name, shown], i) => {
    const y = spread(drive.cy, i, driveLeads.length);
    add(name, 'left', 0, y);
    line(0, y, drive.cx, y);
    labels.push(`<span style="position:absolute;left:3px;top:${py(y)};transform:translateY(-105%);white-space:nowrap;">${esc(shown)}</span>`);
  });
  // Azimuth: down to the bottom, label under each lead.
  const steerLeads = motorLeads('AZIMUTH', !!spec.powerpole);
  steerLeads.forEach(([name, shown], i) => {
    const x = spread(steer.cx, i, steerLeads.length);
    add(name, 'bottom', x, H - BOTTOM);
    line(x, steer.cy, x, H - BOTTOM);
    labels.push(`<span style="position:absolute;left:${px(x)};top:calc(${py(H - BOTTOM)} + 3px);transform:translateX(-50%);text-align:center;line-height:1.1;white-space:nowrap;">${esc(shown).replace(' ', '<br>')}</span>`);
  });
  // Encoder: out to the right edge, label above each lead.
  encLeads.forEach(([name, shown], i) => {
    const y = spread(sensor.cy, i, encLeads.length);
    add(name, 'right', W, y);
    line(sensor.cx, y, W, y);
    labels.push(`<span style="position:absolute;right:3px;top:${py(y)};transform:translateY(-105%);text-align:right;white-space:nowrap;">${esc(shown)}</span>`);
  });

  const circle = (c: { cx: number; cy: number }, r: number, colors: [string, string]) =>
    `<circle cx="${c.cx}" cy="${c.cy}" r="${r}" fill="${colors[0]}" stroke="${colors[1]}" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
  const inCircle = (c: { cx: number; cy: number }, role: string, name: string, size: number) =>
    `<div style="position:absolute;left:${px(c.cx)};top:${py(c.cy)};transform:translate(-50%,-50%);text-align:center;line-height:1.2;white-space:nowrap;">` +
    `<div style="font-size:7px;opacity:0.7;">${esc(role)}</div><b style="font-size:${size}px;">${esc(name)}</b></div>`;

  const [fill, stroke] = spec.colors;
  const cover = [[70, 20], [210, 20], [290, 100], [290, 200], [240, 250], [120, 250], [120, 150]].map((p) => p.join(',')).join(' ');
  const svg =
    `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;">` +
    `<polygon points="${cover}" fill="${fill}" stroke="${stroke}" stroke-width="1" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>` +
    `${lines.join('')}${circle(drive, R, MOTOR)}${circle(steer, R, MOTOR)}${circle(sensor, ENC_R, ENCODER)}</svg>`;
  const inner = [
    inCircle(drive, 'DRIVE', spec.driveMotor, 11),
    inCircle(steer, 'AZIMUTH', spec.steerMotor, 11),
    inCircle(sensor, 'ENCODER', enc, 7),
  ].join('');
  // On the cover, right of the azimuth motor.
  const title =
    `<div style="position:absolute;left:${px(214)};width:${px(72)};top:${py(168)};height:${py(60)};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;line-height:1.15;">` +
    `<b style="font-size:12px;">${esc(spec.title)}</b><span style="font-size:9px;opacity:0.75;">${esc(spec.part)}</span></div>`;
  const value = `<div style="position:relative;width:100%;height:100%;font-size:9px;">${svg}${inner}${title}${labels.join('')}</div>`;
  const style =
    `html=1;overflow=fill;whiteSpace=wrap;spacing=0;verticalAlign=top;fillColor=none;strokeColor=none;pointerEvents=1;fontColor=#1a1a1a;` +
    `points=${JSON.stringify(pins.map((p) => [p.x, p.y, 0]))};device=${spec.id};${SCHEMATIC_KEY}`;
  return { id: spec.id, title: spec.title, style, width: W, height: H, value, tags: spec.tags ?? '', pins };
}

/** Terminal names of a module -> the same module's PowerPole layout (its encoder terminals are unchanged). */
export function swerveToPowerpole(encoder: SwerveSpec['encoder']): Record<string, string> {
  const map: Record<string, string> = {};
  for (const g of ['DRIVE', 'AZIMUTH']) {
    Object.assign(map, {
      [`${g} V+`]: `${g} POWER V+`,
      [`${g} V-`]: `${g} POWER V-`,
      [`${g} CAN H`]: `${g} CAN in H`,
      [`${g} CAN L`]: `${g} CAN in L`,
    });
  }
  for (const name of encoderNames(encoder)) map[name] = name;
  return map;
}

/** The PowerPole layout's terminal names -> the stock layout's (either CAN port lands on the stock CAN terminals). */
export function swerveFromPowerpole(encoder: SwerveSpec['encoder']): Record<string, string> {
  const map: Record<string, string> = {};
  for (const g of ['DRIVE', 'AZIMUTH']) {
    Object.assign(map, {
      [`${g} POWER V+`]: `${g} V+`,
      [`${g} POWER V-`]: `${g} V-`,
      [`${g} CAN in H`]: `${g} CAN H`,
      [`${g} CAN in L`]: `${g} CAN L`,
      [`${g} CAN out H`]: `${g} CAN H`,
      [`${g} CAN out L`]: `${g} CAN L`,
    });
  }
  for (const name of encoderNames(encoder)) map[name] = name;
  return map;
}

const encoderNames = (encoder: SwerveSpec['encoder']) =>
  encoder === 'cancoder' ? ['GND', 'V+', 'L', 'H'].map((l) => `CANcoder ${l}`) : ['+', '-', 'L', 'H'].map((l) => `ThroughBore ${l}`);
