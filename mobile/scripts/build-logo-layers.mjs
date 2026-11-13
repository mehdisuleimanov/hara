// Splits the traced "hara" logo (assets/brand/hara-logo.svg) into animatable layers:
//   faces  — the 6 main mint shapes (route, h, a1, r, a2, dot)
//   depth  — the darker extrusion slivers, each assigned to the nearest face
// and writes src/components/splash/logoLayers.ts (shared by the app splash and the video renderer).
//
//   node scripts/build-logo-layers.mjs [--debug out.png]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = fs.readFileSync(path.join(root, 'assets/brand/hara-logo.svg'), 'utf8');

const paths = [...svg.matchAll(/<path fill="([^"]+)" d="([^"]+)"/g)].map((m, i) => {
  const nums = m[2].match(/-?\d+(?:\.\d+)?/g).map(Number);
  const pts = [];
  for (let k = 0; k + 1 < nums.length; k += 2) pts.push([nums[k], nums[k + 1]]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  return { i, fill: m[1], d: m[2], pts, bbox, area: (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) };
});

// Main faces, identified by bbox (stable for this trace; asserted below).
const FACE_IDS = { route: 0, h: 1, dot: 2, a1: 40, r: 42, a2: 41 };
const expect = { route: [116, 299, 1150, 908], h: [147, 447, 407, 746], dot: [107, 926, 186, 1005], a1: [405, 519, 674, 749], r: [646, 521, 838, 746], a2: [798, 517, 1060, 748] };
for (const [k, idx] of Object.entries(FACE_IDS)) {
  const b = paths[idx].bbox.map(Math.round);
  if (b.some((v, j) => Math.abs(v - expect[k][j]) > 2)) throw new Error(`face ${k} not where expected: ${b}`);
}
const faceIdx = new Set(Object.values(FACE_IDS));

// Drop sub-pixel specks (they only add path count).
const depthPaths = paths.filter((p) => !faceIdx.has(p.i) && p.area >= 4);

// Densify each face outline (long straight runs have few points) so "nearest" is reliable.
const dense = {};
for (const [k, idx] of Object.entries(FACE_IDS)) {
  const pts = paths[idx].pts;
  const acc = [];
  for (let j = 1; j < pts.length; j++) {
    const [ax, ay] = pts[j - 1];
    const [bx, by] = pts[j];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 4));
    for (let s = 0; s < n; s++) acc.push([ax + ((bx - ax) * s) / n, ay + ((by - ay) * s) / n]);
  }
  dense[k] = acc;
}

function nearestFace(p) {
  const cx = (p.bbox[0] + p.bbox[2]) / 2;
  const cy = (p.bbox[1] + p.bbox[3]) / 2;
  let best = null;
  let bestD = Infinity;
  for (const k of Object.keys(FACE_IDS)) {
    for (const [x, y] of dense[k]) {
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
  }
  return best;
}

const layers = {};
for (const k of Object.keys(FACE_IDS)) layers[k] = { face: { d: paths[FACE_IDS[k]].d, fill: paths[FACE_IDS[k]].fill }, depth: [], bbox: [...paths[FACE_IDS[k]].bbox] };
for (const p of depthPaths) {
  const k = nearestFace(p);
  layers[k].depth.push({ d: p.d, fill: p.fill });
  const b = layers[k].bbox;
  layers[k].bbox = [Math.min(b[0], p.bbox[0]), Math.min(b[1], p.bbox[1]), Math.max(b[2], p.bbox[2]), Math.max(b[3], p.bbox[3])];
}

// Hand-built centreline of the route band, drawn from the "?" hook (above the dot) to the arrow neck.
// The band is revealed by stroking this line inside a clip of the route face.
const ROUTE_CENTERLINE =
  'M 126 930 C 132 872 158 818 222 813 L 975 813 C 1022 813 1062 792 1074 732 L 1112 568 ' +
  'C 1124 520 1112 450 1040 445 L 400 445 C 360 445 334 428 306 400';

// Approximate the centreline length by sampling (absolute M/C/L only).
function pathLength(d) {
  const tok = d.match(/[MCL]|-?\d+(?:\.\d+)?/g);
  let i = 0;
  let cur = [0, 0];
  let len = 0;
  let cmd = '';
  const num = () => Number(tok[i++]);
  while (i < tok.length) {
    if (/[MCL]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'M') cur = [num(), num()];
    else if (cmd === 'L') {
      const p = [num(), num()];
      len += Math.hypot(p[0] - cur[0], p[1] - cur[1]);
      cur = p;
    } else if (cmd === 'C') {
      const c1 = [num(), num()];
      const c2 = [num(), num()];
      const p = [num(), num()];
      let prev = cur;
      for (let s = 1; s <= 200; s++) {
        const t = s / 200;
        const u = 1 - t;
        const q = [0, 1].map((j) => u * u * u * cur[j] + 3 * u * u * t * c1[j] + 3 * u * t * t * c2[j] + t * t * t * p[j]);
        len += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
        prev = q;
      }
      cur = p;
    }
  }
  return len;
}

// Points at uniform arc length along the centreline (lookup table for the moving "you" marker).
function samplePath(d, count) {
  const tok = d.match(/[MCL]|-?\d+(?:\.\d+)?/g);
  let i = 0;
  let cur = [0, 0];
  let cmd = '';
  const num = () => Number(tok[i++]);
  const poly = [];
  while (i < tok.length) {
    if (/[MCL]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'M') {
      cur = [num(), num()];
      poly.push(cur);
    } else if (cmd === 'L') {
      const p = [num(), num()];
      for (let s = 1; s <= 40; s++) poly.push([cur[0] + ((p[0] - cur[0]) * s) / 40, cur[1] + ((p[1] - cur[1]) * s) / 40]);
      cur = p;
    } else if (cmd === 'C') {
      const c1 = [num(), num()];
      const c2 = [num(), num()];
      const p = [num(), num()];
      for (let s = 1; s <= 200; s++) {
        const t = s / 200;
        const u = 1 - t;
        poly.push([0, 1].map((j) => u * u * u * cur[j] + 3 * u * u * t * c1[j] + 3 * u * t * t * c2[j] + t * t * t * p[j]));
      }
      cur = p;
    }
  }
  const cum = [0];
  for (let j = 1; j < poly.length; j++) cum.push(cum[j - 1] + Math.hypot(poly[j][0] - poly[j - 1][0], poly[j][1] - poly[j - 1][1]));
  const total = cum[cum.length - 1];
  const out = [];
  let j = 0;
  for (let s = 0; s < count; s++) {
    const target = (total * s) / (count - 1);
    while (j < cum.length - 2 && cum[j + 1] < target) j++;
    const f = (target - cum[j]) / (cum[j + 1] - cum[j] || 1);
    out.push([poly[j][0] + (poly[j + 1][0] - poly[j][0]) * f, poly[j][1] + (poly[j + 1][1] - poly[j][1]) * f]);
  }
  return out;
}
const ROUTE_PTS = samplePath(ROUTE_CENTERLINE, 97);

// Region of the route face that belongs to the arrowhead (it snaps in separately).
const ARROW_REGION = 'M 178 286 L 372 326 L 362 362 L 318 392 L 282 430 L 226 432 Z';
const ARROW_ORIGIN = [300, 405]; // arrow neck: scale origin for the snap
const ARROW_DIR = [-0.73, -0.68]; // unit vector the arrow points along (up-left)

const r1 = (v) => Math.round(v * 10) / 10;
const out = [];
out.push('// Generated by scripts/build-logo-layers.mjs from assets/brand/hara-logo.svg. Do not edit by hand.');
out.push('// Layers of the "hara" logo for the intro animation (app splash + social video).');
out.push('');
out.push('export type LogoPart = { d: string; fill: string };');
out.push('export type LogoLayer = { face: LogoPart; depth: LogoPart[]; bbox: [number, number, number, number] };');
out.push('export type LayerKey = "route" | "h" | "a1" | "r" | "a2" | "dot";');
out.push('');
out.push("/** Padded so the arrow overshoot and the dot bounce never touch the edge. */");
out.push("export const MOTION_VIEWBOX = { x: 70, y: 262, w: 1117, h: 784 };");
out.push(`export const ROUTE_CENTERLINE = ${JSON.stringify(ROUTE_CENTERLINE)};`);
out.push(`export const ROUTE_LEN = ${Math.ceil(pathLength(ROUTE_CENTERLINE))};`);
out.push('/** Centreline points at uniform arc length (index i ↔ fraction i/(n-1) drawn). */');
out.push(`export const ROUTE_PTS: [number, number][] = ${JSON.stringify(ROUTE_PTS.map((p) => p.map(Math.round)))};`);
out.push(`export const ARROW_REGION =${JSON.stringify(ARROW_REGION)};`);
out.push(`export const ARROW_ORIGIN: [number, number] = [${ARROW_ORIGIN.join(', ')}];`);
out.push(`export const ARROW_DIR: [number, number] = [${ARROW_DIR.join(', ')}];`);
out.push('');
out.push('export const LOGO_LAYERS: Record<LayerKey, LogoLayer> = {');
for (const [k, L] of Object.entries(layers)) {
  out.push(`  ${k}: {`);
  out.push(`    bbox: [${L.bbox.map(r1).join(', ')}],`);
  out.push(`    face: { fill: '${L.face.fill}', d: '${L.face.d}' },`);
  out.push('    depth: [');
  for (const p of L.depth) out.push(`      { fill: '${p.fill}', d: '${p.d}' },`);
  out.push('    ],');
  out.push('  },');
}
out.push('};');
out.push('');

const dest = path.join(root, 'src/components/splash/logoLayers.ts');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out.join('\n'));
console.log('wrote', path.relative(root, dest));
for (const [k, L] of Object.entries(layers)) console.log(`  ${k.padEnd(5)} depth=${String(L.depth.length).padStart(2)} bbox=${L.bbox.map(Math.round)}`);
console.log('  centreline length', Math.ceil(pathLength(ROUTE_CENTERLINE)));

// --debug out.png: each layer in its own colour + the centreline, for a visual check.
const dbgIdx = process.argv.indexOf('--debug');
if (dbgIdx > 0) {
  const { Resvg } = await import('@resvg/resvg-js');
  const COL = { route: '#ff5d5d', h: '#ffd84d', a1: '#5db8ff', r: '#c77dff', a2: '#5dffa0', dot: '#ffffff' };
  const parts = [];
  for (const [k, L] of Object.entries(layers)) {
    parts.push(`<path d="${L.face.d}" fill="${COL[k]}" fill-opacity="0.55"/>`);
    for (const p of L.depth) parts.push(`<path d="${p.d}" fill="${COL[k]}"/>`);
  }
  parts.push(`<path d="${ARROW_REGION}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="10 8"/>`);
  parts.push(`<path d="${ROUTE_CENTERLINE}" fill="none" stroke="#000" stroke-width="4"/>`);
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="70 262 1117 784" width="1117" height="784"><rect x="70" y="262" width="1117" height="784" fill="#071532"/>${parts.join('')}</svg>`;
  fs.writeFileSync(process.argv[dbgIdx + 1], new Resvg(doc).render().asPng());
  console.log('debug ->', process.argv[dbgIdx + 1]);
}
