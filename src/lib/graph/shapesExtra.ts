import {
  AbstractPathShape,
  ArrowConnectorShape,
  EdgeMarkerRegistry,
  Perimeter,
  PerimeterRegistry,
  Shape,
  ShapeRegistry,
  type AbstractCanvas2D,
  type MarkerFactoryFunction,
} from '@maxgraph/core';

/**
 * More of draw.io's built-in shapes and markers, under their draw.io names
 * and style keys, so files look the same here and in diagrams.net.
 */

type Style = Record<string, unknown> | null;
const num = (style: Style, key: string, fallback: number) => {
  const v = Number(style?.[key]);
  return Number.isFinite(v) ? v : fallback;
};

function pathShape(draw: (c: AbstractCanvas2D, w: number, h: number, style: Style) => void) {
  return class extends AbstractPathShape {
    redrawPath(c: AbstractCanvas2D, _x: number, _y: number, w: number, h: number): void {
      draw(c, w, h, this.style as Style);
    }
  };
}

const poly = (c: AbstractCanvas2D, pts: [number, number][]) => {
  c.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) c.lineTo(x, y);
  c.close();
};

const shapes = {
  // shape=callout;size=30;position=0.5;base=20
  callout: pathShape((c, w, h, s) => {
    const size = num(s, 'size', 30);
    const base = num(s, 'base', 20);
    const pos = num(s, 'position', 0.5) * w;
    const body = Math.max(0, h - size);
    poly(c, [[0, 0], [w, 0], [w, body], [Math.min(w, pos + base / 2), body], [pos, h], [Math.max(0, pos - base / 2), body], [0, body]]);
  }),
  // shape=singleArrow;arrowWidth=0.3;arrowSize=0.3 (fractions of height / width)
  singleArrow: pathShape((c, w, h, s) => {
    const aw = (h * num(s, 'arrowWidth', 0.3)) / 2;
    const as = w * num(s, 'arrowSize', 0.3);
    poly(c, [[0, h / 2 - aw], [w - as, h / 2 - aw], [w - as, 0], [w, h / 2], [w - as, h], [w - as, h / 2 + aw], [0, h / 2 + aw]]);
  }),
  doubleArrow: pathShape((c, w, h, s) => {
    const aw = (h * num(s, 'arrowWidth', 0.3)) / 2;
    const as = w * num(s, 'arrowSize', 0.2);
    poly(c, [[0, h / 2], [as, 0], [as, h / 2 - aw], [w - as, h / 2 - aw], [w - as, 0], [w, h / 2], [w - as, h], [w - as, h / 2 + aw], [as, h / 2 + aw], [as, h]]);
  }),
  // shape=cross;size=0.2 (arm thickness as a fraction)
  cross: pathShape((c, w, h, s) => {
    const k = Math.min(w, h) * num(s, 'size', 0.2);
    const x0 = (w - k) / 2;
    const y0 = (h - k) / 2;
    poly(c, [[x0, 0], [x0 + k, 0], [x0 + k, y0], [w, y0], [w, y0 + k], [x0 + k, y0 + k], [x0 + k, h], [x0, h], [x0, y0 + k], [0, y0 + k], [0, y0], [x0, y0]]);
  }),
  // shape=cube;size=10: a box with visible top and right faces
  cube: pathShape((c, w, h, s) => {
    const d = Math.min(w, h, num(s, 'size', 10));
    poly(c, [[0, d], [d, 0], [w, 0], [w, h - d], [w - d, h], [0, h]]);
    c.moveTo(0, d);
    c.lineTo(w - d, d);
    c.lineTo(w, 0);
    c.moveTo(w - d, d);
    c.lineTo(w - d, h);
  }),
  // shape=folder;tabWidth=40;tabHeight=14
  folder: pathShape((c, w, h, s) => {
    const tw = Math.min(w, num(s, 'tabWidth', 40));
    const th = Math.min(h, num(s, 'tabHeight', 14));
    poly(c, [[0, 0], [tw, 0], [tw, th], [w, th], [w, h], [0, h]]);
  }),
  // shape=component: a box with two small "jacks" on its left edge (UML 1 style, as in draw.io)
  component: pathShape((c, w, h) => {
    const jw = Math.min(20, w / 3);
    const jh = Math.min(10, h / 5);
    poly(c, [[jw / 2, 0], [w, 0], [w, h], [jw / 2, h]]);
    for (const y of [h * 0.25 - jh / 2, h * 0.65 - jh / 2]) poly(c, [[0, y], [jw, y], [jw, y + jh], [0, y + jh]]);
  }),
  // shape=umlFrame;width=60;height=20: a frame with a name tab in the corner
  umlFrame: pathShape((c, w, h, s) => {
    const fw = Math.min(w, num(s, 'width', 60));
    const fh = Math.min(h, num(s, 'height', 20));
    poly(c, [[0, 0], [w, 0], [w, h], [0, h]]);
    c.moveTo(0, fh);
    c.lineTo(fw - 10, fh);
    c.lineTo(fw, fh - 10);
    c.lineTo(fw, 0);
  }),
};

/** shape=umlLifeline;size=40: a header box with a dashed line down the middle. */
class UmlLifelineShape extends Shape {
  paintVertexShape(c: AbstractCanvas2D, x: number, y: number, w: number, h: number): void {
    const size = Math.min(h, num(this.style as Style, 'size', 40));
    c.rect(x, y, w, size);
    c.fillAndStroke();
    c.setDashed(true);
    c.begin();
    c.moveTo(x + w / 2, y + size);
    c.lineTo(x + w / 2, y + h);
    c.stroke();
  }
}

/** draw.io's crow's-foot (ER) line ends. */
function erMarker(parts: ('one' | 'one2' | 'many' | 'zero')[]): MarkerFactoryFunction {
  return (c, _shape, _type, pe, unitX, unitY, size, _source, sw) => {
    const nx = unitX * (size + sw + 1);
    const ny = unitY * (size + sw + 1);
    const p = pe.clone();
    return () => {
      c.begin();
      for (const part of parts) {
        if (part === 'many') {
          c.moveTo(p.x + ny / 2, p.y - nx / 2);
          c.lineTo(p.x - nx, p.y - ny);
          c.lineTo(p.x - ny / 2, p.y + nx / 2);
        } else if (part === 'one' || part === 'one2') {
          // A bar across the line; the second bar sits a little further out.
          const k = part === 'one' ? 1 : 0.5;
          c.moveTo(p.x - nx * k - ny / 2, p.y - ny * k + nx / 2);
          c.lineTo(p.x - nx * k + ny / 2, p.y - ny * k - nx / 2);
        }
      }
      c.stroke();
      if (parts.includes('zero')) {
        const r = Math.hypot(nx, ny) / 2;
        c.ellipse(p.x - nx * 1.5 - r, p.y - ny * 1.5 - r, 2 * r, 2 * r);
        c.stroke();
      }
    };
  };
}

let registered = false;

export function registerExtraShapes(): void {
  if (registered) return;
  registered = true;
  for (const [name, ctor] of Object.entries(shapes)) ShapeRegistry.add(name, ctor);
  ShapeRegistry.add('umlLifeline', UmlLifelineShape);
  // draw.io's wide "flex" arrow connector.
  ShapeRegistry.add('flexArrow', ArrowConnectorShape);
  PerimeterRegistry.add('calloutPerimeter', Perimeter.RectanglePerimeter);
  PerimeterRegistry.add('lifelinePerimeter', Perimeter.RectanglePerimeter);
  EdgeMarkerRegistry.add('ERone', erMarker(['one']));
  EdgeMarkerRegistry.add('ERmandOne', erMarker(['one', 'one2']));
  EdgeMarkerRegistry.add('ERmany', erMarker(['many']));
  EdgeMarkerRegistry.add('ERoneToMany', erMarker(['many', 'one']));
  EdgeMarkerRegistry.add('ERzeroToMany', erMarker(['many', 'zero']));
  EdgeMarkerRegistry.add('ERzeroToOne', erMarker(['one2', 'zero']));
}
