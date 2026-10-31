/**
 * Image shapes the way draw.io stores them: the image lives in the style as
 * `image=data:image/png,<base64>` (no `;base64`, since `;` separates style keys).
 * Uploads are downscaled so a diagram stays small enough to sync in realtime.
 */

const MAX_DIMENSION = 1600;
/** Embedded images above this (after downscaling) are refused. */
export const MAX_IMAGE_BYTES = 1_500_000;
/** Initial on-canvas size limit. */
const MAX_INSERT_SIZE = 400;

export interface ImageData {
  url: string;
  width: number;
  height: number;
}

export function imageStyle(url: string): string {
  return `shape=image;verticalLabelPosition=bottom;labelBackgroundColor=default;verticalAlign=top;aspect=fixed;imageAspect=0;image=${url};`;
}

/** Fits an image's natural size within the initial insert size. */
export function insertSize(width: number, height: number): { width: number; height: number } {
  const k = Math.min(1, MAX_INSERT_SIZE / Math.max(width, height));
  return { width: Math.max(10, Math.round(width * k)), height: Math.max(10, Math.round(height * k)) };
}

const toDrawioDataUrl = (dataUrl: string) => dataUrl.replace(/;base64,/, ',');

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function naturalSize(src: string): Promise<{ width: number; height: number }> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return { width: img.naturalWidth || 100, height: img.naturalHeight || 100 };
}

export async function imageFromFile(file: File): Promise<ImageData> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.');
  const original = await readAsDataUrl(file);
  const size = await naturalSize(original);
  // SVGs scale without loss; keep them as-is.
  if (file.type === 'image/svg+xml' || (file.size <= 300_000 && Math.max(size.width, size.height) <= MAX_DIMENSION)) {
    if (file.size > MAX_IMAGE_BYTES) throw new Error('That image is too large (max 1.5 MB).');
    return { url: toDrawioDataUrl(original), ...size };
  }
  const k = Math.min(1, MAX_DIMENSION / Math.max(size.width, size.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(size.width * k);
  canvas.height = Math.round(size.height * k);
  const bitmap = await createImageBitmap(file);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
  const url = canvas.toDataURL(type, 0.85);
  if (url.length > MAX_IMAGE_BYTES * 1.37) throw new Error('That image is too large even after resizing (max 1.5 MB).');
  return { url: toDrawioDataUrl(url), width: canvas.width, height: canvas.height };
}

export async function imageFromUrl(url: string): Promise<ImageData> {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error('Enter a full image address, starting with https://');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http(s) image addresses are supported.');
  try {
    return { url: parsed.href, ...(await naturalSize(parsed.href)) };
  } catch {
    throw new Error("Couldn't load an image from that address.");
  }
}
