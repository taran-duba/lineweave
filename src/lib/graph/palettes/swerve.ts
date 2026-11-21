import { SCHEMATIC_KEY } from '../wires';
import type { DeviceItem, DevicePin } from './device';

/**
 * A swerve module drawn as its top cover: an angled plate with the drive and azimuth Krakens as circles overhanging
 * it and a small encoder circle on it. Each circle keeps the terminals of the real part, led out to the nearest edge
 * of the block. With `powerpole` the Krakens use WCP's PowerPole adapter board layout (power plus two
 * interchangeable CAN ports). `turn` redraws the whole module quarter turns clockwise (one per robot corner) with
 * the text kept upright, which rotating the cell itself can't do.
 *
 * The shapes are an SVG inside the label, so the cell stays a plain box and its terminals (draw.io's `points`
 * style) land the same in both editors. Text outside the shapes takes the canvas text color, so it follows dark
 * mode; text on the shapes is always dark.
 */

/** Size of the block at turn 0; odd turns swap them. Every terminal sits 20px inside its edge, on the 10px grid. */
const W = 360;
const H = 340;
const PITCH = 20;
const INSET = 20;
const R = 50;
const ENC_R = 26;
const MOTOR: [string, string] = ['#ffffff', '#666666'];
const ENCODER: [string, string] = ['#e1d5e7', '#9673a6'];
const INK = '#1a1a1a';

type Side = DevicePin['side'];
/** Clockwise order, so a quarter turn moves a terminal's side one step along. */
const SIDES: Side[] = ['left', 'top', 'right', 'bottom'];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export type SwerveTurn = 0 | 1 | 2 | 3;

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
  /** Quarter turns clockwise from the default orientation. */
  turn?: SwerveTurn;
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

const encoderLeads = (encoder: SwerveSpec['encoder']): Lead[] => {
  const name = encoder === 'cancoder' ? 'CANcoder' : 'ThroughBore';
  return (encoder === 'cancoder' ? ['GND', 'V+', 'L', 'H'] : ['+', '-', 'L', 'H']).map((l) => [`${name} ${l}`, l]);
};

export function swerveModule(spec: SwerveSpec): DeviceItem {
  const turn = spec.turn ?? 0;
  const [OW, OH] = turn % 2 ? [H, W] : [W, H];
  /** A point of the default layout, turned into this orientation. */
  const at = (x: number, y: number): [number, number] => {
    if (turn === 1) return [H - y, x];
    if (turn === 2) return [W - x, H - y];
    if (turn === 3) return [y, W - x];
    return [x, y];
  };
  const px = (n: number) => `${+((n / OW) * 100).toFixed(3)}%`;
  const py = (n: number) => `${+((n / OH) * 100).toFixed(3)}%`;
  const enc = spec.encoder === 'cancoder' ? 'CANcoder' : 'ThroughBore';

  const pins: DevicePin[] = [];
  const labels: string[] = [];
  const lines: string[] = [];
  const label = (side: Side, x: number, y: number, shown: string) => {
    const text = esc(shown);
    if (side === 'left') labels.push(`<span style="position:absolute;left:${px(x + 3)};top:${py(y)};transform:translateY(-105%);white-space:nowrap;">${text}</span>`);
    else if (side === 'right') labels.push(`<span style="position:absolute;right:${px(OW - x + 3)};top:${py(y)};transform:translateY(-105%);text-align:right;white-space:nowrap;">${text}</span>`);
    else {
      // Vertical leads are a pitch apart, so a long label stacks on two lines.
      const place = side === 'top' ? `top:${py(y - 3)};transform:translate(-50%,-100%)` : `top:${py(y + 3)};transform:translateX(-50%)`;
      labels.push(`<span style="position:absolute;left:${px(x)};${place};text-align:center;line-height:1.1;white-space:nowrap;">${text.replace(' ', '<br>')}</span>`);
    }
  };
  /** A terminal at `pin` (default layout), joined to the circle center `from`. */
  const terminal = (name: string, shown: string, side: Side, pin: [number, number], from: [number, number]) => {
    const [x, y] = at(...pin);
    const [x2, y2] = at(...from);
    const turned = SIDES[(SIDES.indexOf(side) + turn) % 4];
    pins.push({ name, side: turned, x: x / OW, y: y / OH });
    lines.push(`<line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/>`);
    label(turned, x, y, shown);
  };
  // Leads sit a pitch apart, centered on their circle, so every terminal is on the 10px grid.
  const spread = (center: number, i: number, n: number) => center + (i - (n - 1) / 2) * PITCH;

  const drive = { cx: 110, cy: 90 };
  const steer = { cx: 190, cy: 230 };
  const sensor = { cx: 270, cy: 150 };

  // Drive out to the left, azimuth down, encoder out to the right (before turning).
  const driveLeads = motorLeads('DRIVE', !!spec.powerpole);
  driveLeads.forEach(([name, shown], i) => terminal(name, shown, 'left', [INSET, spread(drive.cy, i, driveLeads.length)], [drive.cx, spread(drive.cy, i, driveLeads.length)]));
  const steerLeads = motorLeads('AZIMUTH', !!spec.powerpole);
  steerLeads.forEach(([name, shown], i) => terminal(name, shown, 'bottom', [spread(steer.cx, i, steerLeads.length), H - INSET], [spread(steer.cx, i, steerLeads.length), steer.cy]));
  const sensorLeads = encoderLeads(spec.encoder);
  sensorLeads.forEach(([name, shown], i) => terminal(name, shown, 'right', [W - INSET, spread(sensor.cy, i, sensorLeads.length)], [sensor.cx, spread(sensor.cy, i, sensorLeads.length)]));

  const circle = (c: { cx: number; cy: number }, r: number, colors: [string, string]) => {
    const [x, y] = at(c.cx, c.cy);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${colors[0]}" stroke="${colors[1]}" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
  };
  const inCircle = (c: { cx: number; cy: number }, role: string, name: string, size: number) => {
    const [x, y] = at(c.cx, c.cy);
    return (
      `<div style="position:absolute;left:${px(x)};top:${py(y)};transform:translate(-50%,-50%);text-align:center;line-height:1.2;white-space:nowrap;color:${INK};">` +
      `<div style="font-size:7px;opacity:0.7;">${esc(role)}</div><b style="font-size:${size}px;">${esc(name)}</b></div>`
    );
  };

  const [fill, stroke] = spec.colors;
  const cover = [[90, 40], [230, 40], [310, 120], [310, 220], [260, 270], [140, 270], [140, 170]]
    .map(([x, y]) => at(x, y).join(','))
    .join(' ');
  const svg =
    `<svg viewBox="0 0 ${OW} ${OH}" preserveAspectRatio="none" style="position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;">` +
    `<polygon points="${cover}" fill="${fill}" stroke="${stroke}" stroke-width="1" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>` +
    `${lines.join('')}${circle(drive, R, MOTOR)}${circle(steer, R, MOTOR)}${circle(sensor, ENC_R, ENCODER)}</svg>`;
  const inner = [inCircle(drive, 'DRIVE', spec.driveMotor, 11), inCircle(steer, 'AZIMUTH', spec.steerMotor, 11), inCircle(sensor, 'ENCODER', enc, 7)].join('');
  // On the cover, beside the azimuth motor. A chip in the cover's color keeps it legible if it reaches past the edge.
  const [tx, ty] = at(274, 218);
  const title =
    `<div style="position:absolute;left:${px(tx - 40)};width:${px(80)};top:${py(ty - 30)};height:${py(60)};display:flex;align-items:center;justify-content:center;">` +
    `<div style="text-align:center;line-height:1.15;color:${INK};background:${fill};border-radius:4px;padding:2px 4px;">` +
    `<b style="font-size:12px;">${esc(spec.title)}</b><br><span style="font-size:9px;opacity:0.75;">${esc(spec.part)}</span></div></div>`;
  const value = `<div style="position:relative;width:100%;height:100%;font-size:9px;">${svg}${inner}${title}${labels.join('')}</div>`;
  // Black text: on an unfilled cell the dark canvas swaps it for a light color, for the terminal labels on the canvas.
  const style =
    `html=1;overflow=fill;whiteSpace=wrap;spacing=0;verticalAlign=top;fillColor=none;strokeColor=none;pointerEvents=1;fontColor=#000000;` +
    `points=${JSON.stringify(pins.map((p) => [p.x, p.y, 0]))};device=${spec.id};${SCHEMATIC_KEY}`;
  return { id: spec.id, title: spec.title, style, width: OW, height: OH, value, tags: spec.tags ?? '', pins };
}

const encoderNames = (encoder: SwerveSpec['encoder']) => encoderLeads(encoder).map(([name]) => name);

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
