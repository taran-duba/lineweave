import fs from 'node:fs';
// Run from the repo: node scripts/gen-lucide-icons.mjs
const root = new URL('..', import.meta.url).pathname;
const dir = root + 'node_modules/lucide-react/dist/esm/icons/';
const names = ['server','database','hard-drive','laptop','monitor','smartphone','tablet','router','wifi','globe','cloud','shield','lock','key-round','user','users','mail','cpu','container','box','layers','zap','inbox','git-branch','terminal','printer','network','radio-tower','bell','credit-card','shopping-cart','file-text','folder','image','video','activity','chart-column','workflow','bot','webhook'];
const out = {};
for (const n of names) {
  const f = dir + n + '.mjs';
  if (!fs.existsSync(f)) { console.error('missing', n); continue; }
  const { __iconData } = await import(f);
  out[n] = __iconData.node.map(([tag, attrs]) => { const rest = { ...attrs }; delete rest.key; return [tag, rest]; });
}
const header = `/**
 * Icon outlines from Lucide (https://lucide.dev), ISC license.
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT).
 * All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 * Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee
 * is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
 *
 * Generated from lucide-react (see scripts/gen-lucide-icons.mjs); regenerate rather than editing by hand.
 */
export const LUCIDE_ICONS: Record<string, [string, Record<string, string>][]> = {
${Object.entries(out).map(([k, v]) => `  '${k}': ${JSON.stringify(v)},`).join('\n')}
};
`;
fs.writeFileSync(root + 'src/lib/graph/palettes/lucideIcons.ts', header);
console.log(Object.keys(out).length, 'icons');
