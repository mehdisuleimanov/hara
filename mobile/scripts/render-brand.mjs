// Renders the app icon, Android adaptive icon layers and favicon from the
// team's own logo (assets/brand/hara-logo.svg + the map-line art of hara-logo-original.svg).
// Usage: node scripts/render-brand.mjs   (writes assets/*.png; dev-time only)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = (p) => path.join(root, 'assets', p);

const NAVY = '#071532';
const NAVY_LIGHT = '#0D2550';
const LINE = '#1A4766';
const WHITE = '#FFFFFF';

/* ---------- read the team art */
const logoSvg = fs.readFileSync(A('brand/hara-logo.svg'), 'utf8');
const LOGO_VB = { x: 100, y: 292, w: 1057, h: 724 };
const logoPaths = [...logoSvg.matchAll(/<path[^>]*fill="([^"]+)"[^>]*d="([^"]+)"/g)].map((m) => ({ fill: m[1], d: m[2] }));
if (!logoPaths.length) throw new Error('no logo paths');

const orig = fs.readFileSync(A('brand/hara-logo-original.svg'), 'utf8');
const LINE_FILLS = new Set(['#14364B', '#14374C', '#16384E']);
const linePaths = [...orig.matchAll(/<path([^>]*?)d="([^"]+)"/g)]
  .map((m) => ({ fill: (m[1].match(/fill="([^"]+)"/) || [])[1], d: m[2].replace(/\s+/g, ' ').trim() }))
  .filter((p) => LINE_FILLS.has(p.fill) && p.d.length > 1000);
const ORIG = 1254;

/* lighter "face" colors of the logo (the 3D extrusion uses the darker teal fills) */
const FACE = new Set(['#71FAC8', '#71F9C8', '#6FF7C6', '#70F9C7', '#8AF4D5']);

/* ---------- building blocks */
function logo({ cx, cy, width, mono, faceOnly = false, halo = 0 }) {
  const s = width / LOGO_VB.w;
  const h = LOGO_VB.h * s;
  const tf = `translate(${cx - width / 2} ${cy - h / 2}) scale(${s}) translate(${-LOGO_VB.x} ${-LOGO_VB.y})`;
  const ps = logoPaths.filter((p) => !faceOnly || FACE.has(p.fill));
  const haloG = halo
    ? `<g fill="${NAVY}" stroke="${NAVY}" stroke-width="${halo / s}" stroke-linejoin="round">${logoPaths.map((p) => `<path d="${p.d}"/>`).join('')}</g>`
    : '';
  return `<g transform="${tf}">${haloG}${ps.map((p) => `<path fill="${mono ?? p.fill}" d="${p.d}"/>`).join('')}</g>`;
}

function mapLines(size, scale = 1) {
  const s = (size / ORIG) * scale;
  const off = (size - ORIG * s) / 2;
  return `<g transform="translate(${off} ${off}) scale(${s})" fill="${LINE}">${linePaths.map((p) => `<path d="${p.d}"/>`).join('')}</g>`;
}

const navyGradient = (id) =>
  `<radialGradient id="${id}" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="${NAVY_LIGHT}"/><stop offset="1" stop-color="${NAVY}"/></radialGradient>`;

function svg(size, body, defs = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs>${defs}</defs>${body}</svg>`;
}

function write(file, svgText, size) {
  const png = new Resvg(svgText, { fitTo: { mode: 'width', value: size }, font: { loadSystemFonts: false } }).render().asPng();
  fs.writeFileSync(A(file), png);
  console.log('wrote', file, size, `${(png.length / 1024).toFixed(0)} KB`);
}

/* ---------- 1. app icon (iOS / legacy Android / store): full-bleed navy tile */
{
  const S = 1024;
  const body = `<rect width="${S}" height="${S}" fill="url(#bg)"/>${mapLines(S)}${logo({ cx: S / 2, cy: S / 2, width: S * 0.74, halo: 18 })}`;
  write('icon.png', svg(S, body, navyGradient('bg')), S);
}

/* ---------- 2. adaptive icon: background (navy + map), foreground (logo in 66% safe zone), monochrome */
{
  const S = 1024;
  write('android-icon-background.png', svg(S, `<rect width="${S}" height="${S}" fill="url(#bg)"/>${mapLines(S, 0.72)}`, navyGradient('bg')), S);
  // safe zone = circle of 66% → a 1057x724 logo fits when width <= 0.825 * 0.66 * S
  const fgW = S * 0.52;
  write('android-icon-foreground.png', svg(S, logo({ cx: S / 2, cy: S / 2, width: fgW, halo: 12 })), S);
  write('android-icon-monochrome.png', svg(S, logo({ cx: S / 2, cy: S / 2, width: fgW, mono: WHITE, faceOnly: true })), S);
}

/* (the native splash image is owned elsewhere — not rendered here) */

/* ---------- 3. favicon: rounded navy tile */
{
  const S = 196;
  const body = `<rect width="${S}" height="${S}" rx="${S * 0.24}" fill="url(#bg)"/>${logo({ cx: S / 2, cy: S / 2, width: S * 0.78, halo: 3 })}`;
  write('favicon.png', svg(S, body, navyGradient('bg')), 96);
}
