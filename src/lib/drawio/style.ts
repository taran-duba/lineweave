import type { CellStyle } from '@maxgraph/core';

/**
 * draw.io style strings look like `ellipse;whiteSpace=wrap;fillColor=#fff;`.
 * Tokens without `=` are named base styles; the rest are key/value pairs.
 * Everything here preserves token order and unknown keys so files round-trip
 * losslessly with diagrams.net.
 */

type Token = { name: string } | { key: string; value: string };

function tokenize(raw: string): Token[] {
  const tokens: Token[] = [];
  for (const part of raw.split(';')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq === -1) tokens.push({ name: part });
    else tokens.push({ key: part.slice(0, eq), value: part.slice(eq + 1) });
  }
  return tokens;
}

function join(tokens: Token[], leadingSemicolon: boolean, trailingSemicolon: boolean): string {
  const body = tokens.map((t) => ('name' in t ? t.name : `${t.key}=${t.value}`)).join(';');
  if (!body) return leadingSemicolon ? ';' : '';
  return `${leadingSemicolon ? ';' : ''}${body}${trailingSemicolon ? ';' : ''}`;
}

export function getStyleValue(raw: string | undefined, key: string): string | undefined {
  if (!raw) return undefined;
  let found: string | undefined;
  for (const t of tokenize(raw)) if ('key' in t && t.key === key) found = t.value;
  return found;
}

export function getStyleNames(raw: string | undefined): string[] {
  if (!raw) return [];
  return tokenize(raw).flatMap((t) => ('name' in t ? [t.name] : []));
}

/** Sets (or removes, when value is null) a single key, leaving every other token untouched. */
export function setStyleValue(raw: string | undefined, key: string, value: string | number | null): string {
  const src = raw ?? '';
  const tokens = tokenize(src);
  const idx = tokens.findIndex((t) => 'key' in t && t.key === key);
  if (value === null) {
    if (idx !== -1) tokens.splice(idx, 1);
  } else if (idx !== -1) {
    tokens[idx] = { key, value: String(value) };
  } else {
    tokens.push({ key, value: String(value) });
  }
  return join(tokens, src.startsWith(';'), src === '' || src.endsWith(';'));
}

export function setStyleValues(raw: string | undefined, values: Record<string, string | number | null>): string {
  let out = raw ?? '';
  for (const [k, v] of Object.entries(values)) out = setStyleValue(out, k, v);
  return out;
}

const NUMERIC = /^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i;
// maxGraph renamed a few mxGraph keys.
const TO_MAXGRAPH: Record<string, string> = { autosize: 'autoSize' };
const FROM_MAXGRAPH: Record<string, string> = { autoSize: 'autosize' };

/** Converts a raw draw.io style string into maxGraph's CellStyle object. */
export function toCellStyle(raw: string | undefined): CellStyle {
  const style: Record<string, unknown> = {};
  if (!raw) return style;
  if (raw.startsWith(';')) style.ignoreDefaultStyle = true;
  for (const t of tokenize(raw)) {
    if ('name' in t) {
      ((style.baseStyleNames as string[] | undefined) ??= []).push(t.name);
    } else {
      style[TO_MAXGRAPH[t.key] ?? t.key] = NUMERIC.test(t.value) ? Number(t.value) : t.value;
    }
  }
  return style as CellStyle;
}

function stringifyStyleValue(v: unknown): string {
  if (typeof v === 'boolean') return v ? '1' : '0';
  return String(v);
}

/**
 * Folds a (possibly edited) maxGraph CellStyle back into the previous raw
 * string: unchanged keys keep their original spelling and position, changed
 * keys are updated in place, removed keys are dropped, new keys appended.
 */
export function mergeCellStyle(prevRaw: string | undefined, style: CellStyle | null | undefined): string {
  const src = prevRaw ?? '';
  const obj = { ...(style ?? {}) } as Record<string, unknown>;
  const names = (obj.baseStyleNames as string[] | undefined) ?? [];
  const leading = obj.ignoreDefaultStyle === true;
  delete obj.baseStyleNames;
  delete obj.ignoreDefaultStyle;

  const wanted = new Map<string, string>();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    wanted.set(FROM_MAXGRAPH[k] ?? k, stringifyStyleValue(v));
  }

  const out: Token[] = [];
  const remainingNames = [...names];
  for (const t of tokenize(src)) {
    if ('name' in t) {
      const i = remainingNames.indexOf(t.name);
      if (i !== -1) {
        out.push(t);
        remainingNames.splice(i, 1);
      }
    } else if (wanted.has(t.key)) {
      const next = wanted.get(t.key)!;
      // Keep the original spelling when numerically equal (e.g. "1.0" vs "1").
      const same = next === t.value || (NUMERIC.test(t.value) && Number(t.value) === Number(next));
      out.push(same ? t : { key: t.key, value: next });
      wanted.delete(t.key);
    }
  }
  for (const n of remainingNames) out.push({ name: n });
  for (const [key, value] of wanted) out.push({ key, value });
  return join(out, leading, src === '' || src.endsWith(';'));
}
