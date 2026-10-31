import { unzlibSync } from 'fflate';

/**
 * "Editable" PNG and SVG exports, compatible with diagrams.net:
 * - PNG: a `tEXt` chunk with keyword `mxfile` holding the URL-encoded .drawio XML.
 * - SVG: the .drawio XML in the root element's `content` attribute.
 * Opening such a file (here or in diagrams.net) restores the diagram.
 */

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

let crcTable: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of bytes) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function isPng(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((b, i) => bytes[i] === b);
}

const latin1 = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
const readLatin1 = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join('');

/** Inserts a tEXt chunk with the diagram right after the IHDR chunk. */
export function embedXmlInPng(png: Uint8Array, xml: string): Uint8Array {
  if (!isPng(png)) throw new Error('Not a PNG');
  // encodeURIComponent output is plain ASCII, which tEXt (Latin-1) can hold.
  const data = latin1(`mxfile\0${encodeURIComponent(xml)}`);
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(latin1('tEXt'), 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  const ihdrEnd = 8 + 12 + new DataView(png.buffer, png.byteOffset).getUint32(8);
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, ihdrEnd));
  out.set(chunk, ihdrEnd);
  out.set(png.subarray(ihdrEnd), ihdrEnd + chunk.length);
  return out;
}

/** The diagram embedded in a PNG by this app or diagrams.net, if any. */
export function xmlFromPng(png: Uint8Array): string | null {
  if (!isPng(png)) return null;
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let pos = 8;
  while (pos + 12 <= png.length) {
    const len = view.getUint32(pos);
    const type = readLatin1(png.subarray(pos + 4, pos + 8));
    const data = png.subarray(pos + 8, pos + 8 + len);
    if (type === 'tEXt' || type === 'zTXt') {
      const nul = data.indexOf(0);
      const key = readLatin1(data.subarray(0, nul));
      if (key === 'mxfile' || key === 'mxGraphModel') {
        const text =
          type === 'tEXt'
            ? readLatin1(data.subarray(nul + 1))
            : readLatin1(unzlibSync(data.subarray(nul + 2))); // skip compression-method byte
        try {
          return decodeURIComponent(text);
        } catch {
          return text;
        }
      }
    }
    if (type === 'IEND') break;
    pos += 12 + len;
  }
  return null;
}

/** The diagram embedded in an SVG's `content` attribute, if any. */
export function xmlFromSvg(svg: string): string | null {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const content = doc.documentElement?.getAttribute('content');
  if (!content) return null;
  const t = content.trim();
  return t.startsWith('<') ? t : null;
}
