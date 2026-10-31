import {
  AbstractPathShape,
  CylinderShape,
  Perimeter,
  PerimeterRegistry,
  ShapeRegistry,
  type AbstractCanvas2D,
  type Stylesheet,
} from '@maxgraph/core';
import { registerExtraShapes } from './shapesExtra';

/**
 * Registers the draw.io shape names used by our palettes (and common in
 * diagrams.net files) that maxGraph doesn't ship. Unknown shapes still render
 * as rectangles and their styles round-trip untouched.
 */

type PathFn = (c: AbstractCanvas2D, w: number, h: number, size: number) => void;

function pathShape(draw: PathFn, defaultSize = 20) {
  return class extends AbstractPathShape {
    redrawPath(c: AbstractCanvas2D, _x: number, _y: number, w: number, h: number): void {
      const raw = Number((this.style as Record<string, unknown> | null)?.size);
      draw(c, w, h, Number.isFinite(raw) && raw > 0 ? raw : defaultSize);
    }
  };
}

const poly = (c: AbstractCanvas2D, pts: [number, number][]) => {
  c.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) c.lineTo(x, y);
  c.close();
};

const shapes: Record<string, ReturnType<typeof pathShape>> = {
  parallelogram: pathShape((c, w, h, s) => poly(c, [[s, 0], [w, 0], [w - s, h], [0, h]])),
  trapezoid: pathShape((c, w, h, s) => poly(c, [[0, h], [s, 0], [w - s, 0], [w, h]])),
  step: pathShape((c, w, h, s) => poly(c, [[0, 0], [w - s, 0], [w, h / 2], [w - s, h], [0, h], [s, h / 2]])),
  card: pathShape((c, w, h, s) => poly(c, [[s, 0], [w, 0], [w, h], [0, h], [0, s]])),
  note: pathShape((c, w, h, s) => {
    poly(c, [[0, 0], [w - s, 0], [w, s], [w, h], [0, h]]);
    c.moveTo(w - s, 0);
    c.lineTo(w - s, s);
    c.lineTo(w, s);
  }, 30),
  manualInput: pathShape((c, w, h, s) => poly(c, [[0, s], [w, 0], [w, h], [0, h]])),
  offPageConnector: pathShape((c, w, h) => poly(c, [[0, 0], [w, 0], [w, h * 0.75], [w / 2, h], [0, h * 0.75]])),
  delay: pathShape((c, w, h) => {
    const r = Math.min(w / 2, h / 2);
    c.moveTo(0, 0);
    c.lineTo(w - r, 0);
    c.arcTo(r, h / 2, 0, false, true, w - r, h);
    c.lineTo(0, h);
    c.close();
  }),
  document: pathShape((c, w, h) => {
    const d = h * 0.15;
    c.moveTo(0, 0);
    c.lineTo(w, 0);
    c.lineTo(w, h - d);
    c.curveTo(w * 0.75, h - 2.5 * d, w * 0.25, h + 0.5 * d, 0, h - d);
    c.close();
  }),
  tape: pathShape((c, w, h) => {
    const d = h * 0.2;
    c.moveTo(0, d / 2);
    c.quadTo(w / 4, d * 1.4, w / 2, d / 2);
    c.quadTo((3 * w) / 4, -d * 0.4, w, d / 2);
    c.lineTo(w, h - d / 2);
    c.quadTo((3 * w) / 4, h - d * 1.4, w / 2, h - d / 2);
    c.quadTo(w / 4, h + d * 0.4, 0, h - d / 2);
    c.close();
  }),
  process: pathShape((c, w, h, s) => {
    const inset = Math.min(s / 2, w / 4, 10);
    poly(c, [[0, 0], [w, 0], [w, h], [0, h]]);
    c.moveTo(inset, 0);
    c.lineTo(inset, h);
    c.moveTo(w - inset, 0);
    c.lineTo(w - inset, h);
  }),
  umlActor: pathShape((c, w, h) => {
    const head = h / 4;
    // Two arcs rather than c.ellipse(), which would replace the current path.
    c.moveTo(w / 4, head / 2);
    c.arcTo(w / 4, head / 2, 0, false, true, (3 * w) / 4, head / 2);
    c.arcTo(w / 4, head / 2, 0, false, true, w / 4, head / 2);
    c.close();
    c.moveTo(w / 2, head);
    c.lineTo(w / 2, (2 * h) / 3);
    c.moveTo(0, h / 3);
    c.lineTo(w, h / 3);
    c.moveTo(w / 2, (2 * h) / 3);
    c.lineTo(0, h);
    c.moveTo(w / 2, (2 * h) / 3);
    c.lineTo(w, h);
  }),
};

let registered = false;

export function registerDrawioShapes(): void {
  if (registered) return;
  registered = true;
  registerExtraShapes();
  for (const [name, ctor] of Object.entries(shapes)) ShapeRegistry.add(name, ctor);
  ShapeRegistry.add('cylinder3', CylinderShape);
  // draw.io-specific perimeters: approximate with built-ins so connections land sensibly.
  PerimeterRegistry.add('parallelogramPerimeter', Perimeter.RectanglePerimeter);
  PerimeterRegistry.add('trapezoidPerimeter', Perimeter.RectanglePerimeter);
  PerimeterRegistry.add('stepPerimeter', Perimeter.RectanglePerimeter);
  PerimeterRegistry.add('hexagonPerimeter2', Perimeter.HexagonPerimeter);
}

/** Named base styles draw.io's default stylesheet defines (e.g. `ellipse;...`). */
export function applyDrawioStylesheet(sheet: Stylesheet): void {
  Object.assign(sheet.getDefaultVertexStyle(), {
    fillColor: '#ffffff',
    strokeColor: '#000000',
    fontColor: '#000000',
    fontFamily: 'Helvetica',
    fontSize: 12,
    align: 'center',
    verticalAlign: 'middle',
  });
  Object.assign(sheet.getDefaultEdgeStyle(), {
    strokeColor: '#000000',
    fontColor: '#000000',
    fontFamily: 'Helvetica',
    fontSize: 11,
    endArrow: 'classic',
    labelBackgroundColor: '#ffffff',
  });
  const named: Record<string, Record<string, unknown>> = {
    ellipse: { shape: 'ellipse', perimeter: 'ellipsePerimeter' },
    rhombus: { shape: 'rhombus', perimeter: 'rhombusPerimeter' },
    triangle: { shape: 'triangle', perimeter: 'trianglePerimeter' },
    swimlane: { shape: 'swimlane', fontStyle: 1, startSize: 23, verticalAlign: 'top' },
    text: { fillColor: 'none', strokeColor: 'none', gradientColor: 'none' },
    label: { fontStyle: 1, align: 'left', verticalAlign: 'middle', spacing: 2, spacingLeft: 52 },
    image: { shape: 'image', verticalLabelPosition: 'bottom', verticalAlign: 'top' },
    group: { fillColor: 'none', strokeColor: 'none', gradientColor: 'none', pointerEvents: 0 },
    edgeLabel: { labelBackgroundColor: '#ffffff', fontSize: 11 },
    line: { shape: 'line', strokeWidth: 4, labelBackgroundColor: '#ffffff', verticalAlign: 'top', spacingTop: 8 },
  };
  for (const [name, style] of Object.entries(named)) sheet.putCellStyle(name, style);
}
