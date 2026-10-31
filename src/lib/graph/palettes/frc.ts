import type { PaletteSection } from '../palette';
import { device, type DeviceItem, type DeviceSpec, type PinGroup } from './device';
import { symbol } from './electrical';

/**
 * FRC control system parts as wiring-diagram blocks, with each terminal a
 * connection point. Each block follows the real part seen from the top in the
 * manufacturer's reference view (label upright): terminals sit on the same
 * edge and in the same order as on the hardware, named as printed on it.
 * Sources are noted per part; parts drawn from a single lead bundle list
 * their leads in the order they leave the part.
 */

const POWER: [string, string] = ['#f8cecc', '#b85450'];
const CONTROL: [string, string] = ['#dae8fc', '#6c8ebf'];
const COMMS: [string, string] = ['#fff2cc', '#d6b656'];
const DRIVE: [string, string] = ['#d5e8d4', '#82b366'];
const MOTOR: [string, string] = ['#f5f5f5', '#666666'];
const AIR: [string, string] = ['#b1ddf0', '#10739e'];
const SENSOR: [string, string] = ['#e1d5e7', '#9673a6'];

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
/** Distribution channels as +/- terminal pairs, in the order given (`first` terminal of each pair first). */
const channels = (list: number[], first: '+' | '-') => list.flatMap((n) => (first === '+' ? [`${n}+`, `${n}-`] : [`${n}-`, `${n}+`]));
const up = (from: number, to: number) => range(from, to).map(Number);
const down = (from: number, to: number) => up(from, to).reverse();
const group = (name: string, pins: string[]): PinGroup => ({ group: name, pins });
/** Two bridged CAN pairs for daisy-chaining (in and out are interchangeable). */
const canInOut = (first: 'H' | 'L' = 'H'): PinGroup[] => {
  const pair = first === 'H' ? ['H', 'L'] : ['L', 'H'];
  return [group('CAN in', pair), group('CAN out', pair)];
};

const d = (spec: DeviceSpec) => device({ ...spec, id: `frc-${spec.id}`, tags: `frc ${spec.tags ?? ''}`.trim() });

export const FRC_POWER: PaletteSection = {
  id: 'frc-power',
  title: 'FRC: Power & Control',
  list: true,
  items: [
    d({ id: 'battery', title: 'Battery', part: '12V SLA', colors: POWER, pins: { top: ['+', '-'] } }),
    // Studs at each end of the breaker (WPILib robot wiring guide).
    d({ id: 'main-breaker', title: 'Main Breaker', part: '120 A', colors: POWER, pins: { left: ['BATT'], right: ['AUX'] } }),
    // REV docs and product photo: channels 0-9 down the right (9 at top), 10-19 then 20-23 down the left,
    // controls and the battery input along the bottom.
    d({
      id: 'pdh',
      title: 'Power Distribution Hub',
      part: 'REV PDH',
      colors: POWER,
      pins: {
        left: [...channels(up(10, 19), '-'), ...channels([20, 21, 22], '-'), '23 SW-', '23 SW+'],
        right: channels(down(0, 9), '+'),
        bottom: ['USB-C', ...canInOut(), 'RS485', group('BATTERY', ['+', '-'])],
      },
      tags: 'pdh pdp distribution',
      sidesFromTop: true,
    }),
    // CTRE PDP user's guide: fused outputs on top, channels down both sides, battery and CAN at the bottom.
    d({
      id: 'pdp',
      title: 'Power Distribution Panel',
      part: 'CTRE PDP',
      colors: POWER,
      pins: {
        top: [group('roboRIO', ['-', '+']), group('VRM', ['-', '+']), group('PCM', ['-', '+'])],
        left: channels(up(8, 15), '-'),
        right: channels(down(0, 7), '+'),
        bottom: [group('BATTERY', ['-', '+']), ...canInOut()],
      },
      tags: 'pdp distribution',
    }),
    // CTRE VRM user's guide.
    d({
      id: 'vrm',
      title: 'Voltage Regulator',
      part: 'CTRE VRM',
      colors: POWER,
      pins: {
        top: [group('12V IN', ['+', '-'])],
        left: ['12V/2A +', '12V/2A -', '12V/500mA +', '12V/500mA -'],
        right: ['5V/2A -', '5V/2A +', '5V/500mA -', '5V/500mA +'],
      },
      tags: 'vrm',
    }),
    // REV RPM docs: radio port at the top end, 12V input and roboRIO port at the bottom end.
    d({ id: 'rpm', title: 'Radio Power Module', part: 'REV RPM', colors: POWER, pins: { top: ['WiFi Radio (PoE)'], bottom: [group('12V IN', ['+', '-']), 'NI roboRIO'] }, tags: 'rpm poe' }),
    symbol('frc-breaker', 'Circuit breaker (40 A)', 'miscellaneous.circuit_breaker', 100, 13, '', '40 A', 'frc snap action'),
    symbol('frc-fuse', 'Fuse (10 A)', 'miscellaneous.fuse_2', 100, 20, '', '10 A', 'frc mini'),
    // NI roboRIO 2.0 user manual, figure 1. The MXP header sits mid-board; it is drawn on the bottom edge.
    d({
      id: 'roborio',
      title: 'roboRIO 2',
      part: 'NI roboRIO',
      colors: CONTROL,
      pins: {
        top: [group('POWER', ['+', '-']), 'USB-B', group('USB-A', ['0', '1']), 'Ethernet', 'SPI'],
        left: ['CAN L', 'CAN H', 'I2C', 'RS-232', ...range(0, 9).map((n) => `DIO ${n}`)],
        right: range(0, 9).map((n) => `PWM ${n}`),
        bottom: ['RSL', group('Relay', range(0, 3)), group('Analog In', range(0, 3)), 'MXP'],
      },
      tags: 'rio controller',
    }),
    // Limelight Systemcore specifications (June 2025), top view.
    d({
      id: 'systemcore',
      title: 'Systemcore',
      part: 'Limelight robot controller',
      colors: CONTROL,
      pins: {
        top: [group('POWER', ['-', '+']), 'BRIDGE', 'LINK', ...[0, 1, 2, 3, 4].map((n) => group(`CAN ${n}`, ['H', 'L']))],
        right: ['Ethernet'],
        bottom: ['RSL', group('Smart I/O', range(0, 5)), group('USB', range(0, 3)), group('I2C', ['0', '1'])],
      },
      tags: 'controller 2027 limelight',
    }),
    // Vivid-Hosting VH-109 drawing: Ethernet and power only on the two short ends. RIO accepts PoE.
    d({ id: 'radio', title: 'Robot Radio', part: 'Vivid-Hosting VH-109', colors: COMMS, pins: { left: ['DS', 'AUX1'], right: ['12V +', '12V -', 'RIO', 'AUX2'] }, tags: 'wifi wireless' }),
    // Allen-Bradley 855PB light: N in the middle; the roboRIO's S goes to Lb with La jumpered to Lb.
    d({ id: 'rsl', title: 'Signal Light', part: 'RSL', colors: COMMS, pins: { left: ['La', 'N', 'Lb'] }, tags: 'rsl robot signal light' }),
    d({ id: 'switch', title: 'Ethernet Switch', colors: COMMS, pins: { left: ['PWR +', 'PWR -'], right: ['ETH 1', 'ETH 2', 'ETH 3', 'ETH 4'] }, tags: 'network' }),
    // CTRE CANivore user's guide: USB-C on top, one Weidmuller block (CANL, CANH, V+, V-) at the bottom.
    d({ id: 'canivore', title: 'CANivore', part: 'CTRE USB-CAN', colors: COMMS, pins: { top: ['USB-C'], bottom: ['CAN L', 'CAN H', 'V+', 'V-'] }, tags: 'can fd' }),
    symbol('frc-can-term', 'CAN terminator (120 Ω)', 'resistors.resistor_2', 100, 20, '', '120 Ω', 'frc can termination resistor'),
    // Limelight docs (LL4; the 3G is the same): USB-C on top, power on the right, Ethernet at the bottom.
    d({ id: 'limelight', title: 'Limelight 4', part: 'also Limelight 3G', colors: COMMS, pins: { top: ['USB-C'], right: ['+', '-'], bottom: ['Ethernet'] }, tags: 'camera vision' }),
    d({ id: 'coprocessor', title: 'Coprocessor', part: 'vision / logging', colors: COMMS, pins: { left: ['PWR +', 'PWR -'], right: ['Ethernet', 'USB'] }, tags: 'orange pi raspberry jetson' }),
  ],
};

export const FRC_MOTORS: PaletteSection = {
  id: 'frc-motors',
  title: 'FRC: Motors & Controllers',
  list: true,
  items: [
    // REV docs: motor leads and encoder port at one end; USB-C, the 4-pin CAN/PWM port (L H L H, bridged) and power leads at the other.
    d({
      id: 'spark-max',
      title: 'SPARK MAX',
      part: 'REV motor controller',
      colors: DRIVE,
      pins: { top: [group('MOTOR', ['A', 'B', 'C']), 'Encoder'], bottom: ['USB-C', ...canInOut('L'), group('POWER', ['V+', 'V-'])] },
      tags: 'rev controller brushless',
    }),
    // REV docs: everything on one side face; the motor docks on the opposite face.
    d({
      id: 'spark-flex',
      title: 'SPARK Flex',
      part: 'REV motor controller',
      colors: DRIVE,
      pins: { top: ['Vortex dock'], bottom: ['Data', 'USB-C', ...canInOut(), group('POWER', ['-', '+'])] },
      tags: 'rev controller',
    }),
    // CTRE Talon FXS user's guide: ports at one end, phase terminals mid-body, power and CAN rings at the other.
    d({
      id: 'talon-fxs',
      title: 'Talon FXS',
      part: 'CTRE motor controller',
      colors: DRIVE,
      pins: { left: ['Data port', 'Sensor'], top: [group('MOTOR', ['C', 'B', 'A'])], right: ['V+', 'CAN L', 'CAN H', 'V-'] },
      tags: 'ctre controller minion',
    }),
    // CTRE Talon SRX user's guide: motor leads at one end; ground, two CAN pairs and V+ at the other.
    d({
      id: 'talon-srx',
      title: 'Talon SRX',
      part: 'CTRE motor controller',
      colors: DRIVE,
      pins: { left: ['M-', 'M+'], top: ['Data port'], right: ['V-', ...canInOut(), 'V+'] },
      tags: 'ctre controller brushed',
    }),
    // CTRE Victor SPX user's guide.
    d({ id: 'victor-spx', title: 'Victor SPX', part: 'CTRE motor controller', colors: DRIVE, pins: { left: ['M-', 'M+'], right: ['GND', ...canInOut(), 'V+'] }, tags: 'ctre controller brushed' }),
    // WCP Kraken docs: screw terminals on the rear Talon FX cap, - H L + left to right.
    d({ id: 'kraken-x60', title: 'Kraken X60', part: 'integrated Talon FX', colors: MOTOR, pins: { bottom: ['V-', group('CAN', ['H', 'L']), 'V+'] }, tags: 'wcp motor talon fx' }),
    d({ id: 'kraken-x44', title: 'Kraken X44', part: 'integrated Talon FX', colors: MOTOR, pins: { bottom: ['V-', group('CAN', ['H', 'L']), 'V+'] }, tags: 'wcp motor talon fx' }),
    // CTRE Falcon 500 user's guide: power leads and two CAN pairs (one male, one female plug).
    d({ id: 'falcon', title: 'Falcon 500', part: 'integrated Talon FX', colors: MOTOR, pins: { bottom: [group('POWER', ['V+', 'V-']), ...canInOut()] }, tags: 'vex motor talon fx' }),
    // REV docs: phase leads (red, black, white) and the encoder cable leave the rear of the can.
    d({ id: 'neo', title: 'NEO', part: 'REV brushless motor', colors: MOTOR, pins: { left: ['A', 'B', 'C', 'Encoder'] }, tags: 'rev motor' }),
    d({ id: 'neo-550', title: 'NEO 550', part: 'REV brushless motor', colors: MOTOR, pins: { left: ['A', 'B', 'C', 'Encoder'] }, tags: 'rev motor' }),
    d({ id: 'vortex', title: 'NEO Vortex', part: 'docks to SPARK Flex', colors: MOTOR, pins: { bottom: ['Dock'] }, tags: 'rev motor' }),
    d({ id: 'minion', title: 'Minion', part: 'brushless, for Talon FXS', colors: MOTOR, pins: { left: ['A', 'B', 'C', 'Sensor'] }, tags: 'ctre motor' }),
    d({ id: 'brushed', title: 'Brushed Motor', part: 'CIM / 775 / window', colors: MOTOR, pins: { left: ['M+', 'M-'] }, tags: 'motor cim bag 775' }),
  ],
};

export const FRC_PNEUMATICS: PaletteSection = {
  id: 'frc-pneumatics',
  title: 'FRC: Pneumatics, Sensors & More',
  list: true,
  items: [
    // REV docs and product photo: compressor and channels 8-15 on the left, sensors and channels 7-0 on the right.
    d({
      id: 'ph',
      title: 'Pneumatic Hub',
      part: 'REV PH',
      colors: AIR,
      pins: {
        left: ['COMPRESSOR -', 'COMPRESSOR +', ...channels(up(8, 15), '-')],
        right: ['PRESSURE DIGITAL', 'ANALOG 1', 'ANALOG 0', ...channels(down(0, 7), '+')],
        bottom: ['USB-C', ...canInOut(), group('POWER', ['+', '-'])],
      },
      tags: 'ph pneumatics solenoid',
      sidesFromTop: true,
    }),
    // CTRE PCM user's guide.
    d({
      id: 'pcm',
      title: 'Pneumatics Control Module',
      part: 'CTRE PCM',
      colors: AIR,
      pins: {
        top: [...canInOut(), ...[7, 6, 5, 4].map((n) => group(String(n), ['-', '+']))],
        left: ['Vin -', 'Vin +'],
        bottom: [group('PRESSURE SW', ['1', '2']), group('COMPRESSOR', ['-', '+']), ...[0, 1, 2, 3].map((n) => group(String(n), ['+', '-']))],
      },
      tags: 'pcm solenoid',
    }),
    d({ id: 'compressor', title: 'Compressor', colors: AIR, pins: { left: ['+', '-'] }, tags: 'pneumatics' }),
    d({ id: 'solenoid', title: 'Single Solenoid', part: 'valve', colors: AIR, pins: { left: ['+', '-'] }, tags: 'pneumatics valve' }),
    d({ id: 'double-solenoid', title: 'Double Solenoid', part: 'valve', colors: AIR, pins: { left: ['A +', 'A -', 'B +', 'B -'] }, tags: 'pneumatics valve' }),
    // REV analog pressure sensor, wired to a PH ANALOG port (S + -).
    d({ id: 'pressure-sensor', title: 'Pressure Sensor', part: 'analog', colors: AIR, pins: { left: ['S', '+', '-'] }, tags: 'pneumatics transducer' }),
    // CTRE CANcoder user's guide: six solder holes along one end.
    d({ id: 'cancoder', title: 'CANcoder', part: 'CTRE encoder', colors: SENSOR, pins: { bottom: ['GND', group('CAN L', ['1', '2']), group('CAN H', ['1', '2']), 'V+'] }, tags: 'ctre absolute encoder swerve' }),
    // CTRE Pigeon 2.0 user's guide: power and two CAN lead pairs leave the bottom.
    d({ id: 'pigeon', title: 'Pigeon 2.0', part: 'CTRE IMU', colors: SENSOR, pins: { bottom: [group('POWER', ['+', '-']), group('CAN in', ['H', 'L']), group('CAN out', ['L', 'H'])] }, tags: 'gyro imu' }),
    // REV Through Bore Encoder: one 6-pin JST-PH at the end opposite the bore (wires: +V, ABS, A, B, Index, GND).
    d({ id: 'bore-encoder', title: 'Through Bore Encoder', part: 'REV', colors: SENSOR, pins: { bottom: ['+V', 'ABS', 'A', 'B', 'I', 'GND'] }, tags: 'encoder' }),
    d({ id: 'limit-switch', title: 'Limit Switch', colors: SENSOR, pins: { left: ['COM', 'NO', 'NC'] }, tags: 'micro switch dio' }),
    d({ id: 'beam-break', title: 'Beam Break', part: 'IR sensor', colors: SENSOR, pins: { left: ['5V', 'GND', 'Signal'] }, tags: 'sensor photoelectric dio' }),
    // CTRE CANdle user's guide: input leads at one end, LED output leads at the other (as labeled on the case).
    d({ id: 'candle', title: 'CANdle', part: 'CTRE LED controller', colors: SENSOR, pins: { left: ['+VIN', '-VIN', 'CAN L', 'CAN H'], right: ['5VOUT', '+VOUT', 'DOUT', '-VOUT'] }, tags: 'led lights' }),
    // REV Blinkin docs: 12V input and PWM header on the left, LED strip connector on the right.
    d({ id: 'blinkin', title: 'Blinkin', part: 'REV LED driver', colors: SENSOR, pins: { left: ['V+', 'V-', 'PWM S', 'PWM +', 'PWM -'], right: ['LED strip'] }, tags: 'led lights' }),
    d({ id: 'sb50', title: 'SB50 Connector', part: 'Anderson', colors: MOTOR, pins: { left: ['+', '-'], right: ['+', '-'] }, tags: 'battery connector anderson' }),
    d({ id: 'connector', title: 'Connector', colors: MOTOR, pins: { left: ['1', '2'], right: ['1', '2'] }, tags: 'wago powerpole splice' }),
    d({ id: 'custom', title: 'Device', part: 'edit to rename', colors: MOTOR, pins: { left: ['V+', 'V-'], right: ['Out'] }, tags: 'custom generic block' }),
  ],
};

export const FRC_PALETTES = [FRC_POWER, FRC_MOTORS, FRC_PNEUMATICS];

/** A block by its short id (`pdh`, `spark-max`, ...), with its terminal layout. */
export function frcDevice(id: string): DeviceItem {
  const item = FRC_PALETTES.flatMap((s) => s.items).find((i) => i.id === `frc-${id}`);
  if (!item || !('pins' in item)) throw new Error(`Unknown FRC device: ${id}`);
  return item as DeviceItem;
}
