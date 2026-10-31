const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Replaces the HTML (foreignObject) labels of an exported SVG with plain SVG
 * text and rectangles at the positions the browser laid them out. PDF output
 * can't render foreignObject, and drawing it into a canvas taints the canvas,
 * but rich labels (bold titles, line breaks, the positioned terminal names of
 * wiring blocks) should still come out as they look on screen.
 *
 * The SVG is briefly attached to the document so its labels can be measured.
 */
export function flattenHtmlLabels(svg: SVGSVGElement): SVGSVGElement {
  const objects = Array.from(svg.getElementsByTagNameNS(SVG_NS, 'foreignObject'));
  if (!objects.length) return svg;
  const host = document.createElement('div');
  Object.assign(host.style, { position: 'fixed', left: '-100000px', top: '0', visibility: 'hidden', pointerEvents: 'none' });
  host.appendChild(svg);
  document.body.appendChild(host);
  try {
    const origin = svg.getBoundingClientRect();
    const box = svg.viewBox.baseVal;
    const kx = box && box.width ? box.width / origin.width : 1;
    const ky = box && box.height ? box.height / origin.height : 1;
    const toSvg = (r: DOMRect) => ({ x: (r.left - origin.left) * kx, y: (r.top - origin.top) * ky, w: r.width * kx, h: r.height * ky });
    const layer = document.createElementNS(SVG_NS, 'g');
    for (const fo of objects) {
      const out = document.createElementNS(SVG_NS, 'g');
      for (const el of Array.from(fo.querySelectorAll<HTMLElement>('*'))) {
        const bg = getComputedStyle(el).backgroundColor;
        if (!isVisibleColor(bg)) continue;
        const r = toSvg(el.getBoundingClientRect());
        if (!r.w || !r.h) continue;
        out.appendChild(svgEl('rect', { x: r.x, y: r.y, width: r.w, height: r.h, fill: bg }));
      }
      const walker = document.createTreeWalker(fo, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
        for (const line of textLines(node)) {
          const r = toSvg(line.rect);
          const css = getComputedStyle(node.parentElement!);
          const size = parseFloat(css.fontSize) * ky;
          const text = svgEl('text', {
            x: r.x,
            // Baseline: centered in the line box, as the browser placed it.
            y: r.y + r.h / 2 + size * 0.35,
            fill: css.color,
            'fill-opacity': inheritedOpacity(node.parentElement!, fo),
            'font-family': baseFont(css.fontFamily),
            'font-size': size,
            'font-weight': css.fontWeight,
            'font-style': css.fontStyle,
            'text-decoration': css.textDecorationLine === 'none' ? undefined : css.textDecorationLine,
          });
          text.textContent = line.text;
          out.appendChild(text);
        }
      }
      layer.appendChild(out);
      // maxGraph wraps each foreignObject in a <switch> with a plain-text fallback.
      const wrapper = fo.parentElement?.localName === 'switch' ? fo.parentElement : fo;
      wrapper.remove();
    }
    svg.appendChild(layer);
  } finally {
    host.remove();
  }
  return svg;
}

/** Splits a text node into its rendered lines (it may wrap), with each line's box. */
function textLines(node: Text): { text: string; rect: DOMRect }[] {
  const value = node.data;
  const lines: { text: string; rect: DOMRect }[] = [];
  const range = document.createRange();
  const re = /\S+/g;
  let current: { words: string[]; left: number; top: number; right: number; bottom: number } | null = null;
  const flush = () => {
    if (current) lines.push({ text: current.words.join(' '), rect: new DOMRect(current.left, current.top, current.right - current.left, current.bottom - current.top) });
  };
  for (let m = re.exec(value); m; m = re.exec(value)) {
    range.setStart(node, m.index);
    range.setEnd(node, m.index + m[0].length);
    const r = range.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    if (current && Math.abs(r.top - current.top) < r.height / 2) {
      current.words.push(m[0]);
      current.right = Math.max(current.right, r.right);
      current.bottom = Math.max(current.bottom, r.bottom);
    } else {
      flush();
      current = { words: [m[0]], left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }
  }
  flush();
  return lines;
}

function inheritedOpacity(el: Element, stop: Element): number | undefined {
  let o = 1;
  for (let e: Element | null = el; e && e !== stop; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity) || 0;
  return o < 1 ? +o.toFixed(3) : undefined;
}

function isVisibleColor(c: string): boolean {
  if (!c || c === 'transparent') return false;
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return true;
  const parts = m[1].split(/[,\s/]+/).filter(Boolean);
  return parts.length < 4 || parseFloat(parts[3]) > 0;
}

function svgEl(tag: string, attrs: Record<string, string | number | undefined>): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== '') el.setAttribute(k, String(v));
  return el;
}

/** The closest of the three fonts every PDF reader has, which is what the PDF export can use. */
function baseFont(family: string): string {
  const f = family.toLowerCase();
  if (/mono|courier|consol/.test(f)) return 'courier';
  if (/(^|[\s,"'])(serif|times|georgia|garamond)/.test(f) && !/sans/.test(f.split(',')[0])) return 'times';
  return 'helvetica';
}
