import { StencilShape, StencilShapeRegistry } from '@maxgraph/core';
import { ELECTRICAL_STENCILS } from './electrical';

/** draw.io's stencil key: `<package>.<shape name, lowercased, spaces as underscores>`. */
export const stencilKey = (pkg: string, name: string) => `${pkg}.${name.toLowerCase().replace(/ /g, '_')}`;

/**
 * Registers draw.io's electrical stencils under the names diagrams.net uses
 * (`shape=mxgraph.electrical.resistors.resistor_1`), so schematics drawn in
 * either editor look identical and keep their terminal connection points.
 */
export function registerElectricalStencils(): number {
  applyCellFontColorToStencilText();
  const parser = new DOMParser();
  let count = 0;
  for (const set of ELECTRICAL_STENCILS) {
    const root = parser.parseFromString(set, 'text/xml').documentElement;
    const pkg = root.getAttribute('name')!;
    for (const shape of Array.from(root.getElementsByTagName('shape'))) {
      const name = shape.getAttribute('name');
      if (!name) continue;
      StencilShapeRegistry.add(stencilKey(pkg, name), new StencilShape(shape));
      count++;
    }
  }
  return count;
}

let patched = false;

/**
 * Text inside a stencil (the "V" of a voltmeter, "M" of a motor) should use the
 * cell's font color as in draw.io; maxGraph leaves it at the canvas default
 * black, which vanishes on the dark canvas.
 */
function applyCellFontColorToStencilText(): void {
  if (patched) return;
  patched = true;
  const draw = StencilShape.prototype.drawShape;
  StencilShape.prototype.drawShape = function (canvas, shape, x, y, w, h) {
    canvas.setFontColor(String(shape.style?.fontColor ?? '#000000'));
    draw.call(this, canvas, shape, x, y, w, h);
  };
}
