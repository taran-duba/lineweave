import type { PaletteItem } from '../palette';
import { SCHEMATIC_KEY } from '../wires';

/**
 * Wiring-diagram blocks: a labeled box whose terminals are fixed connection
 * points (draw.io's `points` style), with each terminal's name printed beside
 * it. Everything is one ordinary cell, so it copies, rotates and round-trips
 * through diagrams.net like any other shape.
 */

/**
 * A connector with several terminals (CAN H/L, a channel's +/-), or a row of
 * numbered ports, captioned with its name. Terminal names become
 * `<group> <pin>`, e.g. "CAN 0 H".
 */
export interface PinGroup {
  group: string;
  pins: string[];
}

export type PinEntry = string | PinGroup;

/** Terminals per edge: top/bottom listed left to right, left/right top to bottom, as on the real part. */
export interface DevicePins {
  left?: PinEntry[];
  right?: PinEntry[];
  top?: PinEntry[];
  bottom?: PinEntry[];
}

export interface DeviceSpec {
  id: string;
  title: string;
  /** Part name or number, shown under the title. */
  part?: string;
  colors: [fill: string, stroke: string];
  pins: DevicePins;
  /** Minimum width; the block grows to fit its labels. */
  width?: number;
  /** Extra search words. */
  tags?: string;
  /** Start side terminals at the top (as on the part) rather than centering the shorter side. */
  sidesFromTop?: boolean;
}

// Terminals sit on a 20px pitch (10px from the corners), so with the block on the grid every terminal is too.
const PITCH = 20;
const BAND = 20;
/** An edge with captioned groups needs room for the caption under the terminal names. */
const GROUP_BAND = 30;
const CHAR = 5.6;
const TITLE_CHAR = 7.4;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pct = (n: number) => `${+(n * 100).toFixed(3)}%`;
const round = (n: number) => +n.toFixed(6);
const up = (n: number, step: number) => Math.ceil(n / step) * step;
const isGroup = (e: PinEntry): e is PinGroup => typeof e !== 'string';
const fullName = (e: PinEntry, pin: string) => (isGroup(e) ? `${e.group} ${pin}` : pin);
/** Side terminals print their full name; there's no room for a caption beside them. */
const sideLabels = (list: PinEntry[] = []) => list.flatMap((e) => (isGroup(e) ? e.pins.map((p) => fullName(e, p)) : [e]));
const longest = (labels: string[]) => labels.reduce((m, l) => Math.max(m, l.length), 0);

/** Room a top/bottom terminal's label needs; a multiple of the pitch so terminals stay on the grid. */
const slot = (label: string) => up(label.length * CHAR + 2, PITCH);
const span = (labels: string[]) => labels.reduce((sum, l) => sum + slot(l), 0);
/** Width of one entry on a top/bottom edge: its terminals, or its caption if that is wider. */
const entryWidth = (e: PinEntry) => (isGroup(e) ? Math.max(span(e.pins), up(e.group.length * CHAR + 8, PITCH)) : slot(e));
const edgeWidth = (list: PinEntry[] = []) => list.reduce((sum, e) => sum + entryWidth(e), 0);
const bandFor = (list: PinEntry[] = []) => (!list.length ? 0 : list.some(isGroup) ? GROUP_BAND : BAND);

function deviceGeometry(spec: DeviceSpec) {
  const { left, right, top, bottom } = spec.pins;
  const titleW = Math.max(spec.title.length * TITLE_CHAR, (spec.part?.length ?? 0) * CHAR) + 16;
  const sideW = (longest(sideLabels(left)) + longest(sideLabels(right))) * CHAR + 16;
  // Some slack between top/bottom connectors so they spread out along the edge like the real part.
  const across = Math.max(edgeWidth(top), edgeWidth(bottom));
  const width = up(Math.max(spec.width ?? 0, across, sideW + titleW, 80), PITCH);
  const topBand = bandFor(top);
  const bottomBand = bandFor(bottom);
  const rows = Math.max(sideLabels(left).length, sideLabels(right).length, 2);
  const height = topBand + rows * PITCH + bottomBand;
  return { width, height, topBand, bottomBand, rows };
}

export interface DevicePin {
  name: string;
  side: keyof DevicePins;
  /** Position as a fraction of the block's size, as in the `points` style. */
  x: number;
  y: number;
}

export type DeviceItem = PaletteItem & { pins: DevicePin[] };

/** Builds the palette item for a device block. */
export function device(spec: DeviceSpec): DeviceItem {
  const { left = [], right = [], top = [], bottom = [] } = spec.pins;
  const { width: w, height: h, topBand, bottomBand, rows } = deviceGeometry(spec);
  const pins: DevicePin[] = [];
  const labels: string[] = [];
  const side = (list: PinEntry[], x: 0 | 1, where: 'left' | 'right') => {
    const names = sideLabels(list);
    const offset = topBand + (spec.sidesFromTop ? 0 : ((rows - names.length) * PITCH) / 2);
    names.forEach((name, i) => {
      const y = (offset + (i + 0.5) * PITCH) / h;
      pins.push({ name, side: where, x, y: round(y) });
      const anchor = x === 0 ? 'left:3px' : 'right:3px;text-align:right';
      labels.push(`<span style="position:absolute;${anchor};top:${pct(y)};transform:translateY(-50%);white-space:nowrap;">${esc(name)}</span>`);
    });
  };
  const edge = (list: PinEntry[], y: 0 | 1, where: 'top' | 'bottom') => {
    // Spread connectors along the edge like the real part: leftover room is dealt out in whole
    // pitches, to the gaps between connectors first and then the two ends.
    const units = (w - edgeWidth(list)) / PITCH;
    const gaps = Array.from({ length: list.length + 1 }, () => Math.floor(units / (list.length + 1)));
    const order = [...gaps.keys()].slice(1, -1).concat(0, list.length);
    for (let i = 0; i < units % (list.length + 1); i++) gaps[order[i % order.length]]++;
    let at = gaps[0] * PITCH;
    const anchor = y === 0 ? 'top:2px' : 'bottom:2px';
    const captionAnchor = y === 0 ? 'top:13px' : 'bottom:13px';
    const border = y === 0 ? 'border-top' : 'border-bottom';
    list.forEach((entry, index) => {
      const width = entryWidth(entry);
      const terminals = isGroup(entry) ? entry.pins : [entry];
      let px = at + (width - span(terminals)) / 2;
      for (const pin of terminals) {
        const x = (px + slot(pin) / 2) / w;
        px += slot(pin);
        pins.push({ name: fullName(entry, pin), side: where, x: round(x), y });
        labels.push(`<span style="position:absolute;left:${pct(x)};${anchor};transform:translateX(-50%);white-space:nowrap;">${esc(pin)}</span>`);
      }
      if (isGroup(entry)) {
        labels.push(
          `<span style="position:absolute;left:${pct((at + 3) / w)};width:${pct((width - 6) / w)};${captionAnchor};${border}:1px solid currentColor;` +
            `text-align:center;font-size:8px;line-height:11px;opacity:0.7;white-space:nowrap;">${esc(entry.group)}</span>`,
        );
      }
      at += width + gaps[index + 1] * PITCH;
    });
  };
  side(left, 0, 'left');
  side(right, 1, 'right');
  edge(top, 0, 'top');
  edge(bottom, 1, 'bottom');
  const titleTop = topBand / h;
  const titleBottom = (h - bottomBand) / h;
  const title =
    `<div style="position:absolute;left:0;right:0;top:${pct(titleTop)};bottom:${pct(1 - titleBottom)};display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.15;">` +
    `<b style="font-size:12px;">${esc(spec.title)}</b>${spec.part ? `<span style="font-size:9px;opacity:0.75;">${esc(spec.part)}</span>` : ''}</div>`;
  const value = `<div style="position:relative;width:100%;height:100%;font-size:9px;">${title}${labels.join('')}</div>`;
  const [fill, stroke] = spec.colors;
  const style =
    `rounded=1;arcSize=4;absoluteArcSize=1;whiteSpace=wrap;html=1;overflow=fill;spacing=0;verticalAlign=top;fillColor=${fill};strokeColor=${stroke};fontColor=#1a1a1a;` +
    `points=${JSON.stringify(pins.map((p) => [p.x, p.y, 0]))};${SCHEMATIC_KEY}`;
  return { id: spec.id, title: spec.title, style, width: w, height: h, value, tags: [spec.part, spec.tags].filter(Boolean).join(' '), pins };
}
