import type { PaletteItem, PaletteSection } from '../palette';
import { SCHEMATIC_KEY, WIRE_TYPES, wireStyle } from '../wires';

/**
 * Schematic symbols: draw.io's own electrical stencils (registered in
 * ../stencils), with the same style strings and sizes as diagrams.net's
 * Electrical library, so files look identical in both editors.
 */

const S = 'verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;pointerEvents=1;';

/** A stencil symbol: `shape` is the part after `mxgraph.electrical.`. */
function sym(id: string, title: string, shape: string, w: number, h: number, extra = '', value = '', tags?: string): PaletteItem {
  return { id: `el-${id}`, title, style: `${S}${extra}shape=mxgraph.electrical.${shape};`, width: w, height: h, value, tags };
}

const DIODE = 'fillColor=strokeColor;';

export const WIRES_SECTION: PaletteSection = {
  id: 'el-wires',
  title: 'Electrical: Wires & Power',
  items: [
    ...WIRE_TYPES.map((w) => ({ id: `wire-${w.id}`, title: `${w.title} wire`, style: wireStyle(w), width: 120, height: 0, edge: true, tags: 'wire cable' })),
    { id: 'wire-battery-pos', title: '6 AWG battery cable (+)', style: wireStyle({ ...WIRE_TYPES[1], width: 4 }), width: 120, height: 0, edge: true, value: '6 AWG', tags: 'wire cable main power' },
    { id: 'wire-battery-neg', title: '6 AWG battery cable (-)', style: wireStyle({ ...WIRE_TYPES[2], width: 4 }), width: 120, height: 0, edge: true, value: '6 AWG', tags: 'wire cable main ground' },
    {
      id: 'el-junction',
      title: 'Junction dot',
      style: `ellipse;aspect=fixed;html=1;fillColor=strokeColor;strokeColor=#000000;resizable=0;points=[[0.5,0.5,0]];${SCHEMATIC_KEY}`,
      width: 8,
      height: 8,
      tags: 'node splice connection wire',
    },
    {
      id: 'el-terminal',
      title: 'Terminal',
      style: `ellipse;aspect=fixed;html=1;fillColor=#ffffff;strokeColor=#000000;labelPosition=right;align=left;spacingLeft=2;points=[[0.5,0.5,0]];${SCHEMATIC_KEY}`,
      width: 10,
      height: 10,
      tags: 'pin pad connection',
    },
    {
      id: 'el-net-label',
      title: 'Net label',
      style: `shape=hexagon;perimeter=hexagonPerimeter2;fixedSize=1;size=8;html=1;whiteSpace=wrap;fontStyle=1;fontSize=10;points=[[0,0.5,0],[1,0.5,0]];${SCHEMATIC_KEY}`,
      width: 60,
      height: 20,
      value: 'NET',
      tags: 'net name wire label port off-page',
    },
    // vss2 is drawn bar-up (terminal below), the usual supply symbol; vdd is the same bar-down.
    sym('vdd', 'Power rail (+12V)', 'signal_sources.vss2', 60, 40, 'verticalLabelPosition=top;verticalAlign=bottom;', '+12V', 'vcc supply'),
    sym('vss', 'Power rail (negative)', 'signal_sources.vdd', 60, 40, '', '-V', 'vee supply'),
    sym('ground', 'Ground', 'signal_sources.signal_ground', 45, 30, '', '', 'gnd earth'),
    sym('chassis', 'Chassis ground', 'miscellaneous.chassis', 65, 32, '', '', 'gnd frame'),
    sym('earth', 'Protective earth', 'signal_sources.protective_earth', 25, 20, '', '', 'gnd'),
    sym('connector', 'Plug / socket', 'miscellaneous.plug_socket_connection', 20, 20, '', '', 'connector'),
    sym('terminal-board', 'Terminal block', 'miscellaneous.terminal_board', 50, 100, '', '', 'connector wago'),
  ],
};

export const PASSIVES_SECTION: PaletteSection = {
  id: 'el-passive',
  title: 'Electrical: Passives & Sources',
  items: [
    sym('resistor', 'Resistor (US)', 'resistors.resistor_2', 100, 20),
    sym('resistor-iec', 'Resistor (IEC)', 'resistors.resistor_1', 100, 20),
    sym('potentiometer', 'Potentiometer', 'resistors.potentiometer_1', 100, 40, '', '', 'pot variable'),
    sym('thermistor', 'Thermistor', 'miscellaneous.thermistor_1', 100, 60, '', '', 'temperature'),
    sym('capacitor', 'Capacitor', 'capacitors.capacitor_1', 100, 60),
    sym('capacitor-polar', 'Electrolytic capacitor', 'capacitors.capacitor_3', 100, 60, '', '', 'polarized'),
    sym('inductor', 'Inductor', 'inductors.inductor_5', 100, 14, '', '', 'coil choke'),
    sym('transformer', 'Transformer', 'inductors.transformer_1', 64, 60),
    sym('crystal', 'Crystal', 'miscellaneous.crystal_1', 100, 40, '', '', 'oscillator'),
    sym('fuse', 'Fuse', 'miscellaneous.fuse_2', 100, 20),
    sym('breaker', 'Circuit breaker', 'miscellaneous.circuit_breaker', 100, 13),
    sym('battery', 'Battery (cell)', 'miscellaneous.monocell_battery', 100, 60),
    sym('battery-multi', 'Battery', 'miscellaneous.multicell_battery', 100, 60, '', '12V'),
    sym('dc-source', 'DC voltage source', 'signal_sources.dc_source_1', 70, 75),
    sym('ac-source', 'AC voltage source', 'signal_sources.ac_source', 60, 60, 'aspect=fixed;'),
    sym('current-source', 'Current source', 'signal_sources.current_source', 40, 60),
    sym('voltmeter', 'Voltmeter', 'instruments.voltmeter', 60, 60, 'aspect=fixed;perimeter=ellipsePerimeter;'),
    sym('ammeter', 'Ammeter', 'instruments.ampermeter', 60, 60, 'aspect=fixed;perimeter=ellipsePerimeter;'),
  ],
};

export const SEMIS_SECTION: PaletteSection = {
  id: 'el-semis',
  title: 'Electrical: Semiconductors & Logic',
  items: [
    sym('diode', 'Diode', 'diodes.diode', 100, 60, DIODE),
    sym('zener', 'Zener diode', 'diodes.zener_diode_1', 100, 50, DIODE),
    sym('schottky', 'Schottky diode', 'diodes.schottky_diode', 100, 60, DIODE),
    sym('led', 'LED', 'opto_electronics.led_2', 100, 70, '', '', 'light'),
    sym('photodiode', 'Photodiode', 'opto_electronics.photodiode', 100, 70),
    sym('optocoupler', 'Optocoupler', 'opto_electronics.opto-coupler', 99, 60, '', '', 'opto isolator'),
    sym('npn', 'NPN transistor', 'transistors.npn_transistor_1', 95, 100, '', '', 'bjt'),
    sym('pnp', 'PNP transistor', 'transistors.pnp_transistor_1', 95, 100, '', '', 'bjt'),
    sym('nmos', 'N-channel MOSFET', 'mosfets1.n-channel_mosfet_1', 95, 100, '', '', 'fet'),
    sym('pmos', 'P-channel MOSFET', 'mosfets1.p-channel_mosfet_1', 95, 100, '', '', 'fet'),
    sym('opamp', 'Op-amp', 'abstract.operational_amp_1', 98, 90, '', '', 'amplifier operational'),
    sym('regulator', 'Voltage regulator', 'abstract.voltage_regulator', 70, 58, '', '', 'vrm buck'),
    sym('and', 'AND gate', 'logic_gates.and', 100, 60),
    sym('or', 'OR gate', 'logic_gates.or', 100, 60),
    sym('not', 'NOT gate', 'logic_gates.inverter_2', 100, 60, '', '', 'inverter'),
    sym('nand', 'NAND gate', 'logic_gates.nand', 100, 60),
    sym('nor', 'NOR gate', 'logic_gates.nor', 100, 60),
    sym('xor', 'XOR gate', 'logic_gates.xor', 100, 60),
  ],
};

export const SWITCHES_SECTION: PaletteSection = {
  id: 'el-switches',
  title: 'Electrical: Switches, Relays & Loads',
  items: [
    sym('switch', 'Switch (SPST)', 'electro-mechanical.simple_switch', 75, 19, '', '', 'toggle'),
    sym('switch-spdt', 'Switch (SPDT)', 'electro-mechanical.2-way_switch', 75, 26, '', '', 'changeover'),
    sym('switch-dpdt', 'Switch (DPDT)', 'electro-mechanical.dpdt', 75, 32),
    sym('push-no', 'Push button (NO)', 'electro-mechanical.push_switch_no', 75, 19, '', '', 'momentary'),
    sym('push-nc', 'Push button (NC)', 'electro-mechanical.push_switch_nc', 75, 10, '', '', 'momentary'),
    sym('limit-no', 'Limit switch (NO)', 'electro-mechanical.limit_switch_no', 75, 24, '', '', 'micro'),
    sym('limit-nc', 'Limit switch (NC)', 'electro-mechanical.limit_switch_nc', 75, 13, '', '', 'micro'),
    sym('reed', 'Reed switch', 'electro-mechanical.reed_switch', 75, 20, '', '', 'magnetic'),
    sym('pressure-switch', 'Pressure switch', 'electro-mechanical.pressure_actuated', 75, 31, '', '', 'pneumatic'),
    sym('relay-coil', 'Relay coil', 'electro-mechanical.relay_coil', 70, 35),
    sym('relay-no', 'Relay contact (NO)', 'electro-mechanical.relay_contact_no', 20, 100),
    sym('relay-nc', 'Relay contact (NC)', 'electro-mechanical.relay_contact_nc', 10, 100),
    sym('relay', 'Relay', 'electro-mechanical.relay', 100, 50),
    sym('motor', 'Motor', 'electro-mechanical.motor_1', 100, 60),
    sym('lamp', 'Lamp', 'miscellaneous.light_bulb', 60, 50, '', '', 'light bulb indicator'),
    sym('buzzer', 'Buzzer', 'electro-mechanical.buzzer', 45, 60),
    sym('speaker', 'Speaker', 'electro-mechanical.loudspeaker', 25, 50),
  ],
};

/** Exposed for the FRC library (breakers, fuses and terminators are plain symbols with a rating). */
export const symbol = sym;
