// Static renderer for Əhməd (Node + resvg).
// Usage (from this folder): node --no-warnings --import ./ts-resolve-hooks.mjs render-preview.mjs <mobileDir> <outDir> [all|front|poses|extra|head|vs|variants]
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const mobile = process.argv[2];
const outDir = process.argv[3];
const what = process.argv[4] ?? 'all';
mkdirSync(outDir, { recursive: true });
const req = createRequire(path.join(mobile, 'package.json'));
const { Resvg } = req('@resvg/resvg-js');
const A = await import(pathToFileURL(path.join(mobile, 'src/features/mascot/art.ts')).href);
const P = await import(pathToFileURL(path.join(mobile, 'src/features/mascot/pose.ts')).href);

let uid = 0;
const n = (v) => Math.round(v * 1000) / 1000;
function tf(x) {
  return `translate(${n(x.tx + x.px)} ${n(x.ty + x.py)}) rotate(${n(x.r)}) scale(${n(x.sx)} ${n(x.sy)}) translate(${n(-x.px)} ${n(-x.py)})`;
}
function paint(s, ids) {
  const fix = (v) => (typeof v === 'string' ? v.replace(/url\(#([^)]+)\)/, (_, id) => `url(#${ids[id] ?? id})`) : v);
  let a = '';
  a += ` fill="${s.fill !== undefined ? fix(s.fill) : '#000'}"`;
  if (s.stroke) a += ` stroke="${fix(s.stroke)}" stroke-width="${s.sw ?? 1}" stroke-linecap="${s.lc ?? 'butt'}" stroke-linejoin="round"`;
  if (s.op !== undefined) a += ` opacity="${s.op}"`;
  if (s.clip) a += ` clip-path="url(#${ids[s.clip]})"`;
  return a;
}
function shape(s, ids) {
  switch (s.k) {
    case 'path':
      return `<path d="${s.d}"${paint(s, ids)}/>`;
    case 'ell': {
      const t = s.rot ? ` transform="rotate(${s.rot} ${s.cx} ${s.cy})"` : '';
      return `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}"${t}${paint(s, ids)}/>`;
    }
    case 'rect':
      return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r ?? 0}"${paint(s, ids)}/>`;
    case 'g':
      return `<g${s.tf ? ` transform="${s.tf}"` : ''}${s.op !== undefined ? ` opacity="${s.op}"` : ''}${s.clip ? ` clip-path="url(#${ids[s.clip]})"` : ''}>${s.ch.map((c) => shape(c, ids)).join('')}</g>`;
  }
}
function art(a, opacity = 1) {
  const ids = {};
  let defs = '';
  for (const g of a.defs ?? []) {
    const id = `${g.id}_${++uid}`;
    ids[g.id] = id;
    const stops = g.stops.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op !== undefined ? ` stop-opacity="${op}"` : ''}/>`).join('');
    defs +=
      g.k === 'lin'
        ? `<linearGradient id="${id}" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}">${stops}</linearGradient>`
        : `<radialGradient id="${id}" cx="${g.cx}" cy="${g.cy}" r="${g.r}"${g.fx !== undefined ? ` fx="${g.fx}" fy="${g.fy}"` : ''}>${stops}</radialGradient>`;
  }
  for (const c of a.clips ?? []) {
    const id = `${c.id}_${++uid}`;
    ids[c.id] = id;
    defs += `<clipPath id="${id}">${c.shapes.map((s) => shape({ ...s, fill: '#000' }, ids)).join('')}</clipPath>`;
  }
  return `<g${opacity !== 1 ? ` opacity="${opacity}"` : ''}>${defs ? `<defs>${defs}</defs>` : ''}${a.shapes.map((s) => shape(s, ids)).join('')}</g>`;
}
const G = (x, inner, extra = '') => `<g transform="${tf(x)}"${extra}>${inner}</g>`;

function eye(e, p, pup, closed) {
  const id = `eyeclip_${++uid}`;
  const sc = p.eyeScale;
  const lidY = A.lidOffset(e, closed);
  return `<g transform="translate(${e.x} ${e.y}) scale(${sc}) translate(${-e.x} ${-e.y})">
    <defs><clipPath id="${id}"><ellipse cx="${e.x}" cy="${e.y}" rx="${e.rx}" ry="${e.ry}"/></clipPath></defs>
    <g clip-path="url(#${id})">${art(A.eyeWhite(e))}<g transform="translate(${pup.x} ${pup.y})">${art(A.pupil(e))}</g><g transform="translate(0 ${lidY})">${art(A.lid(e))}</g></g></g>`;
}

function arm(side, j, a, p) {
  const isR = side === 'R';
  let wristInner = '';
  if (isR && p.prop === 'flashlight') wristInner += art(A.beam(), 0.9) + art(A.flashlight());
  if (isR && p.prop === 'magnifier') wristInner += art(A.magnifier());
  wristInner += art(A.hand(side, a.hand));
  if (isR && p.prop === 'magnifier') wristInner += art(A.lensGlint(), 0.95);
  return G(j.sh, art(A.upperArm(side)) + G(j.el, art(A.foreArm(side)) + G(j.wr, wristInner)));
}

/** full character for pose p (in design coords, 220x240 canvas) */
export function character(p, { facing = 1, glow = 0.6, limbs = true } = {}) {
  const J = P.joints(p, facing);
  const shadowScale = Math.max(0.45, 1 + p.root.y / 70);
  const sh = `<g transform="translate(110 228) scale(${shadowScale}) translate(-110 -228)" opacity="${shadowScale}">${art(A.SHADOW)}</g>`;
  if (!limbs) { p = { ...p, armL: { ...p.armL, front: false }, armR: { ...p.armR, front: false } }; }
  const backArms = !limbs ? '' : (p.armL.front ? '' : arm('L', J.armL, p.armL, p)) + (p.armR.front ? '' : arm('R', J.armR, p.armR, p));
  const frontArms = !limbs ? '' : (p.armL.front ? arm('L', J.armL, p.armL, p) : '') + (p.armR.front ? arm('R', J.armR, p.armR, p) : '');
  const m = p.mouth;
  const mouth =
    (m.smile > 0.01 ? art(A.MOUTH_SMILE, m.smile) : '') +
    (m.open > 0.01 ? `<g transform="translate(110 ${A.MOUTH_TOP}) scale(${m.wide} ${m.open}) translate(-110 ${-A.MOUTH_TOP})">${art(A.MOUTH_OPEN)}</g>` : '') +
    (m.o > 0.01 ? `<g transform="translate(110 124) scale(${m.o}) translate(-110 -124)">${art(A.MOUTH_O)}</g>` : '') +
    (m.flat > 0.01 ? art(A.MOUTH_FLAT, m.flat) : '') +
    (m.wobble > 0.01 ? art(A.MOUTH_WOBBLE, m.wobble) : '');
  const eyes =
    p.happy > 0.5
      ? art(A.happyEye(A.EYE_L)) + art(A.happyEye(A.EYE_R))
      : eye(A.EYE_L, p, J.pupil, p.lid[0]) + eye(A.EYE_R, p, J.pupil, p.lid[1]);
  const face = G(J.face, art(A.CHEEKS) + eyes + G(J.browL, art(A.BROW_L)) + G(J.browR, art(A.BROW_R)) + mouth);
  let fx = '';
  if (p.dots) fx += art(A.THINK_DOT(124, 18, 2.2), 0.55) + art(A.THINK_DOT(136, 11, 3), 0.75) + art(A.THINK_DOT(150, 6, 3.8), 0.95);
  if (p.zzz) fx += art(A.ZZZ(150, 40, 4), 0.5) + art(A.ZZZ(160, 28, 5.5), 0.7) + art(A.ZZZ(172, 13, 7), 0.9);
  const capLift = Math.min(1, Math.abs(p.cap.y) / 6);
  const body = G(J.body, backArms + art(A.BODY) + art(A.CAP_SHADOW, 1 - capLift) + face + G(J.cap, art(A.CAP)) + frontArms + fx);
  const legs = !limbs ? '' : G(J.legL, art(A.leg('L'))) + G(J.legR, art(A.leg('R')));
  return sh + G(J.root, (glow ? art(A.GLOW, glow) : '') + legs + body);
}

function svgDoc(w, h, inner, bg = '#FFFFFF') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ''}${inner}</svg>`;
}
/** place the character's crop box into a w×h cell at (x,y) */
function cell(x, y, w, h, crop, inner, clip = false) {
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${crop.join(' ')}"${clip ? '' : ' overflow="visible"'}>${inner}</svg>`;
}
function png(file, svg, width) {
  const r = new Resvg(svg, { fitTo: width ? { mode: 'width', value: width } : { mode: 'original' }, font: { loadSystemFonts: true, defaultFontFamily: 'Arial' } });
  writeFileSync(path.join(outDir, file), r.render().asPng());
  console.log('wrote', file);
}
const label = (x, y, t, c = '#334155') => `<text x="${x}" y="${y}" font-family="Arial" font-size="22" font-weight="700" fill="${c}" text-anchor="middle">${t}</text>`;

const K = P.KEY_POSES;
const FULL = A.CROPS.full;

if (what === 'all' || what === 'front') {
  const h = 1024;
  const w = Math.round((h * FULL[2]) / FULL[3]);
  png('ahmed-front.png', svgDoc(w, h, cell(0, 0, w, h, FULL, character(K.idle))));
}
if (what === 'all' || what === 'poses') {
  const names = [
    ['idle', 'idle'],
    ['wave', 'wave'],
    ['talk', 'talk'],
    ['think', 'think'],
    ['celebrate', 'celebrate'],
    ['stop', 'stop · dayan!'],
    ['scan', 'scan · magnifier'],
    ['night', 'night · flashlight'],
  ];
  const cw = 360, ch = 400, cols = 4;
  const crop = [-6, -10, 232, 250];
  let inner = '';
  names.forEach(([k, t], i) => {
    const x = (i % cols) * cw;
    const y = Math.floor(i / cols) * (ch + 70);
    inner += cell(x + 10, y + 10, cw - 20, ch - 20, crop, character(K[k])) + label(x + cw / 2, y + ch + 22, t);
  });
  png('ahmed-poses.png', svgDoc(cw * cols, (ch + 70) * 2 - 20, inner));
}
if (what === 'all' || what === 'extra') {
  const names = ['alert', 'confused', 'sleepy', 'point'];
  const cw = 300, ch = 330;
  const crop = [-6, -10, 232, 250];
  let inner = '';
  names.forEach((k, i) => (inner += cell(i * cw + 8, 8, cw - 16, ch - 16, crop, character(K[k])) + label(i * cw + cw / 2, ch + 20, k)));
  png('ahmed-poses-extra.png', svgDoc(cw * names.length, ch + 36, inner));
}
if (what === 'all' || what === 'head') {
  const HC = A.CROPS.head;
  const sizes = [128, 64, 40];
  let x = 24;
  let inner = '';
  for (const s of sizes) {
    const w = (s * HC[2]) / HC[3];
    inner += cell(x, 24 + (128 - s), w, s, HC, character(K.idle, { glow: 0, limbs: false }), true);
    x += w + 28;
  }
  // same on a light card + a dark chip
  inner += `<rect x="${x}" y="24" width="${(64 * HC[2]) / HC[3] + 24}" height="88" rx="20" fill="#EAF2FF"/>`;
  inner += cell(x + 12, 36, (64 * HC[2]) / HC[3], 64, HC, character(K.idle, { glow: 0, limbs: false }), true);
  x += (64 * HC[2]) / HC[3] + 40;
  inner += `<rect x="${x}" y="24" width="${(40 * HC[2]) / HC[3] + 20}" height="60" rx="16" fill="#0F1B2D"/>`;
  inner += cell(x + 10, 34, (40 * HC[2]) / HC[3], 40, HC, character(K.talk, { glow: 0, limbs: false }), true);
  x += (40 * HC[2]) / HC[3] + 44;
  png('ahmed-head.png', svgDoc(Math.round(x), 176, inner));
}
if (what === 'all' || what === 'vs') {
  const ref = readFileSync(path.join(mobile, 'assets/brand/ahmed-reference.png')).toString('base64');
  const H = 760;
  // reference character region (px): x 110..730, y 80..770
  const rw = Math.round((H * 620) / 690);
  let inner = `<svg x="0" y="0" width="${rw}" height="${H}" viewBox="110 80 620 690"><image href="data:image/png;base64,${ref}" x="0" y="0" width="1536" height="1024"/></svg>`;
  const cw = Math.round((H * FULL[2]) / FULL[3]);
  inner += `<rect x="${rw}" y="0" width="${cw}" height="${H}" fill="#050E1F"/>`;
  inner += cell(rw, 0, cw, H, FULL, character(K.wave, { glow: 1.6 }));
  inner += cell(rw + cw, 0, cw, H, FULL, character(K.wave));
  inner += label(rw / 2, H - 16, 'reference', '#94A3B8') + label(rw + cw / 2, H - 16, 'vector (dark)', '#94A3B8') + label(rw + cw + cw / 2, H - 16, 'vector (app canvas)');
  png('ahmed-vs-reference.png', svgDoc(rw + 2 * cw, H, inner));
}

if (what === 'all' || what === 'variants') {
  const opts = [
    [0, 'A · no glow'],
    [0.6, 'B · subtle glow (default)'],
    [1.5, 'C · strong glow'],
  ];
  const cw = 380, ch = 420;
  let inner = '';
  opts.forEach(([gl, t], i) => (inner += cell(i * cw + 10, 10, cw - 20, ch - 20, FULL, character(K.wave, { glow: gl })) + label(i * cw + cw / 2, ch + 20, t)));
  png('ahmed-variants-glow.png', svgDoc(cw * opts.length, ch + 36, inner));
}