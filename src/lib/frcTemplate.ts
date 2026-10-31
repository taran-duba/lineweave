import { frcDevice } from '@/lib/graph/palettes/frc';
import { file, vertex } from '@/lib/graph/palettes/snippet';
import { WIRE_TYPES, wireStyle, type WireType } from '@/lib/graph/wires';

/**
 * A starting FRC robot wiring diagram: battery, main breaker, PDH, roboRIO,
 * VH-109 radio, and two motor controllers on the CAN bus, wired terminal to
 * terminal with FRC's wire colors.
 */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const wireOf = (id: string) => WIRE_TYPES.find((w) => w.id === id)!;

interface Placed {
  id: string;
  device: string;
  x: number;
  y: number;
}

export function frcWiringTemplate(): string {
  // Blocks follow the real parts' layouts, so a few wires must cross (e.g. the PDH's left channels are
  // - above +, the roboRIO's plug is + then -); they hop (line jumps) where they do. No wires overlap.
  const placed: Placed[] = [
    { id: 'rio', device: 'roborio', x: 120, y: 140 },
    { id: 'radio', device: 'radio', x: 100, y: 600 },
    { id: 'pdh', device: 'pdh', x: 440, y: 140 },
    { id: 'battery', device: 'battery', x: 220, y: 860 },
    { id: 'breaker', device: 'main-breaker', x: 320, y: 780 },
    { id: 'spark', device: 'spark-max', x: 800, y: 200 },
    { id: 'neo', device: 'neo', x: 1080, y: 60 },
    { id: 'kraken', device: 'kraken-x60', x: 800, y: 560 },
  ];
  const at = new Map(placed.map((p) => [p.id, p]));
  const cells = placed.map((p) => {
    const d = frcDevice(p.device);
    return vertex(p.id, d.value ?? '', d.style, { x: p.x, y: p.y, w: d.width, h: d.height });
  });

  type End = [cell: string, pin: string];
  const pin = ([cellId, name]: End) => {
    const p = at.get(cellId)!;
    const found = frcDevice(p.device).pins.find((q) => q.name === name);
    if (!found) throw new Error(`${p.device} has no pin ${name}`);
    return found;
  };
  let n = 0;
  const wire = (from: End, to: End, type: WireType, label = '', via: [number, number][] = []) => {
    const a = pin(from);
    const b = pin(to);
    const style =
      `${wireStyle(type)}jumpStyle=arc;jumpSize=8;exitX=${a.x};exitY=${a.y};exitDx=0;exitDy=0;exitPerimeter=0;` +
      `entryX=${b.x};entryY=${b.y};entryDx=0;entryDy=0;entryPerimeter=0;`;
    const points = via.length ? `<Array as="points">${via.map(([x, y]) => `<mxPoint x="${x}" y="${y}"/>`).join('')}</Array>` : '';
    cells.push(
      `<mxCell id="w${n++}" value="${esc(label)}" style="${esc(style)}" edge="1" parent="1" source="${from[0]}" target="${to[0]}">` +
        `<mxGeometry relative="1" as="geometry">${points}</mxGeometry></mxCell>`,
    );
  };

  const power = wireOf('power');
  const ground = wireOf('ground');
  const battery = { ...power, width: 4 };
  const batteryGround = { ...ground, width: 4 };
  const canH = wireOf('can-h');
  const canL = wireOf('can-l');

  // Main power: battery -> 120 A breaker -> PDH battery input.
  wire(['battery', '+'], ['breaker', 'BATT'], battery, '6 AWG', [[250, 800]]);
  wire(['breaker', 'AUX'], ['pdh', 'BATTERY +'], battery, '6 AWG', [[660, 800]]);
  wire(['battery', '-'], ['pdh', 'BATTERY -'], batteryGround, '6 AWG', [[290, 840], [680, 840]]);

  // Motor controllers on 40 A channels; roboRIO and radio on the fused low-current channels.
  wire(['pdh', '2+'], ['spark', 'POWER V+'], power, '12 AWG', [[970, 430]]);
  wire(['pdh', '2-'], ['spark', 'POWER V-'], ground, '', [[990, 450]]);
  wire(['pdh', '0+'], ['kraken', 'V+'], power, '12 AWG', [[960, 510], [960, 660], [930, 660]]);
  wire(['pdh', '0-'], ['kraken', 'V-'], ground, '', [[720, 530], [720, 650], [830, 650]]);
  wire(['pdh', '20+'], ['rio', 'POWER +'], power, '18 AWG', [[380, 570], [380, 120], [130, 120]]);
  wire(['pdh', '20-'], ['rio', 'POWER -'], ground, '', [[400, 550], [400, 110], [150, 110]]);
  wire(['pdh', '21+'], ['radio', '12V +'], power, '18 AWG');
  wire(['pdh', '21-'], ['radio', '12V -'], ground);

  // Motor phases and encoder.
  for (const [i, phase] of ['A', 'B', 'C'].entries()) {
    const x = 830 + i * 20;
    wire(['spark', `MOTOR ${phase}`], ['neo', phase], WIRE_TYPES[0], '', [[x, 70 + i * 20]]);
  }
  wire(['spark', 'Encoder'], ['neo', 'Encoder'], wireOf('signal'), '', [[950, 130]]);

  // Network: roboRIO Ethernet to the radio's RIO port.
  wire(['rio', 'Ethernet'], ['radio', 'RIO'], wireOf('ethernet'), '', [[270, 100], [340, 100], [340, 650]]);

  // CAN bus: roboRIO -> SPARK MAX (in, out) -> Kraken -> PDH, which terminates the far end (TERM switch on).
  wire(['rio', 'CAN H'], ['spark', 'CAN in H'], canH, '', [[80, 200], [80, 60], [760, 60], [760, 340], [880, 340]]);
  wire(['rio', 'CAN L'], ['spark', 'CAN in L'], canL, '', [[90, 180], [90, 70], [750, 70], [750, 350], [860, 350]]);
  wire(['spark', 'CAN out H'], ['kraken', 'CAN H'], canH, '', [[940, 380], [780, 380], [780, 690], [870, 690]]);
  wire(['spark', 'CAN out L'], ['kraken', 'CAN L'], canL, '', [[920, 370], [770, 370], [770, 700], [890, 700]]);
  wire(['kraken', 'CAN H'], ['pdh', 'CAN in H'], canH, '', [[870, 760], [500, 760]]);
  wire(['kraken', 'CAN L'], ['pdh', 'CAN in L'], canL, '', [[890, 750], [520, 750]]);

  cells.push(
    vertex('title', '<b style="font-size:18px;">Robot wiring</b><br>Team ____ &middot; Season ____', 'text;html=1;align=left;verticalAlign=top;', { x: 1080, y: 230, w: 300, h: 50 }),
    vertex(
      'can-note',
      'CAN bus: terminated at the roboRIO and at the PDH (TERM switch ON) at the far end.',
      'text;html=1;align=left;verticalAlign=top;whiteSpace=wrap;fontSize=11;fontColor=#555555;',
      { x: 1080, y: 290, w: 260, h: 40 },
    ),
  );

  // Wire color legend.
  cells.push(vertex('legend', '<b>Wire colors</b>', 'text;html=1;align=left;verticalAlign=middle;', { x: 1080, y: 380, w: 140, h: 20 }));
  WIRE_TYPES.forEach((w, i) => {
    const y = 414 + i * 24;
    cells.push(
      `<mxCell id="lg${i}" value="" style="${esc(wireStyle(w))}" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="1080" y="${y}" as="sourcePoint"/><mxPoint x="1130" y="${y}" as="targetPoint"/></mxGeometry></mxCell>`,
      vertex(`lt${i}`, esc(w.title), 'text;html=1;align=left;verticalAlign=middle;fontSize=11;', { x: 1140, y: y - 10, w: 140, h: 20 }),
    );
  });

  return file('Robot wiring', ...cells);
}
