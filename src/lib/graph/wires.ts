import type { Cell } from '@maxgraph/core';

/**
 * Wiring for electrical schematics: plain (arrowless) orthogonal wires, colored
 * by what they carry, using FRC's wiring conventions.
 */

export const WIRE_BASE = 'endArrow=none;startArrow=none;html=1;edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;';

export interface WireType {
  id: string;
  title: string;
  stroke: string;
  width: number;
  dash?: string;
}

export const WIRE_TYPES: WireType[] = [
  { id: 'wire', title: 'Wire', stroke: '#000000', width: 1 },
  { id: 'power', title: '+12V power', stroke: '#e51400', width: 2 },
  { id: 'ground', title: 'Ground', stroke: '#000000', width: 2 },
  { id: 'can-h', title: 'CAN High', stroke: '#e3b505', width: 2 },
  { id: 'can-l', title: 'CAN Low', stroke: '#2e9e2e', width: 2 },
  { id: 'signal', title: 'Signal / PWM', stroke: '#1f6fd1', width: 1.5 },
  { id: 'ethernet', title: 'Ethernet', stroke: '#7b3fb5', width: 2, dash: '6 3' },
  { id: 'pneumatic', title: 'Pneumatic tubing', stroke: '#10a5c9', width: 3, dash: '10 4' },
];

/** The style keys a wire type sets (null clears a dash left by another type). */
export function wireStyleValues(w: WireType): Record<string, string | number | null> {
  return { strokeColor: w.stroke, strokeWidth: w.width, dashed: w.dash ? 1 : null, dashPattern: w.dash ?? null, endArrow: 'none', startArrow: 'none' };
}

export function wireStyle(w: WireType): string {
  return `${WIRE_BASE}strokeColor=${w.stroke};strokeWidth=${w.width};${w.dash ? `dashed=1;dashPattern=${w.dash};` : ''}`;
}

/** Marks our own schematic parts (FRC blocks, junctions, flags); draw.io keeps unknown keys. */
export const SCHEMATIC_KEY = 'schematic=1;';

/** Electrical stencils (from either editor) and our schematic parts. */
export function isSchematicCell(cell: Cell | null | undefined): boolean {
  const style = cell?.style as Record<string, unknown> | undefined;
  if (!style || !cell?.isVertex()) return false;
  return style.schematic === 1 || (typeof style.shape === 'string' && style.shape.startsWith('mxgraph.electrical.'));
}

/** New connections touching an electrical part are wires, not flowchart arrows (null: use the default). */
export function schematicConnectorStyle(source: Cell | null | undefined, target: Cell | null | undefined): string | null {
  return isSchematicCell(source) || isSchematicCell(target) ? wireStyle(WIRE_TYPES[0]) : null;
}
