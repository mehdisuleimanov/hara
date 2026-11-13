// Renders the "hara" logo intro as social-media videos — no browser needed:
// every frame is an SVG built from the shared timeline, rasterised with resvg, encoded with ffmpeg.
//
//   node scripts/render-logo-motion.mjs                 # square + story + gif + contact sheet
//   node scripts/render-logo-motion.mjs --only square   # one format (square | story)
//   node scripts/render-logo-motion.mjs --frame 1500    # single PNG of t=1500ms (quick look)
//
// Output: ../docs/design/motion/  (relative to hara/mobile)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import {
  T,
  prog,
  easeOutCubic,
  easeInOutCubic,
  dotFrame,
  routeDraw,
  routeHead,
  arrowFrame,
  letterFrame,
  depthFrame,
  shineFrame,
} from '../src/components/splash/timeline.ts';
import {
  LOGO_LAYERS,
  ROUTE_CENTERLINE,
  ROUTE_LEN,
  ROUTE_PTS,
  ARROW_REGION,
  ARROW_ORIGIN,
} from '../src/components/splash/logoLayers.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(root, '../docs/design/motion');

const BG = '#071532';
const MAP = '#14384C';
const MINT = '#71FAC8';

const FPS = 60;
const LOGO_DELAY = 300; // map draws first
const DURATION = LOGO_DELAY + T.end + 1350; // + hold on the finished logo

const FORMATS = {
  square: { w: 1080, h: 1080, logoW: 860, mapY: -420 },
  story: { w: 1080, h: 1920, logoW: 900, mapY: 0 },
};

// ---------- background map (drawn in 1080×1920 story space; square crops the middle) ----------
const ROADS = [
  'M -60 700 C 180 560 380 560 560 590 C 760 620 900 540 1140 470',
  'M 760 380 C 830 520 900 660 930 800 C 960 940 1010 1060 1140 1130',
  'M -60 1350 C 200 1250 420 1300 600 1400 C 760 1490 900 1440 1140 1330',
  'M 520 1610 C 560 1500 600 1440 700 1385',
  'M -60 180 C 240 260 520 160 760 220 C 920 260 1020 320 1140 300',
  'M -60 1770 C 260 1700 500 1830 760 1765 C 900 1730 1020 1780 1140 1800',
  'M 300 1960 C 330 1800 380 1670 520 1610',
  'M 140 -40 C 170 120 160 260 120 420 C 100 520 40 600 -60 640',
];
const BLOCKS = [
  { x: 905, y: 545, s: 128, rot: 22 },
  { x: 110, y: 1445, s: 118, rot: 24 },
  { x: 250, y: 330, s: 104, rot: -18 },
  { x: 880, y: 1640, s: 112, rot: -20 },
];

function cubicLength(d) {
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
      for (let s = 1; s <= 64; s++) {
        const t = s / 64;
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
const ROAD_LEN = ROADS.map((d) => Math.ceil(cubicLength(d)));

function mapSvg(t, fmt) {
  const drift = -14 * easeInOutCubic(prog(t, 0, DURATION)); // slow parallax drift
  const parts = [];
  ROADS.forEach((d, i) => {
    const p = easeOutCubic(prog(t, 60 * i, 60 * i + 1000));
    if (p <= 0) return;
    const L = ROAD_LEN[i];
    parts.push(`<path d="${d}" fill="none" stroke="${MAP}" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="${L} ${L}" stroke-dashoffset="${(L * (1 - p)).toFixed(1)}"/>`);
  });
  BLOCKS.forEach((b, i) => {
    const p = easeOutCubic(prog(t, 450 + 110 * i, 1150 + 110 * i));
    if (p <= 0) return;
    const h = b.s / 2;
    const cells = [
      [-h, -h],
      [0, -h],
      [-h, 0],
      [0, 0],
    ]
      .map(([x, y]) => `<rect x="${x}" y="${y}" width="${h}" height="${h}"/>`)
      .join('');
    parts.push(
      `<g transform="translate(${b.x} ${b.y}) rotate(${b.rot}) scale(${(0.85 + 0.15 * p).toFixed(3)})" fill="none" stroke="${MAP}" stroke-width="4" opacity="${p.toFixed(3)}">${cells}</g>`,
    );
  });
  return `<g transform="translate(0 ${fmt.mapY + drift})">${parts.join('')}</g>`;
}

// ---------- logo ----------
const LOGO_CX = 629; // centre of the logo artwork in viewBox units
const LOGO_CY = 655;
const LOGO_ARTW = 1044;

const f3 = (v) => (Math.abs(v) < 1e-6 ? '0' : v.toFixed(3));

/** matrix for: translate(tx,ty) · scale(sx,sy) about (ox,oy) */
function about(ox, oy, sx, sy, tx = 0, ty = 0) {
  return `matrix(${f3(sx)} 0 0 ${f3(sy)} ${f3(ox * (1 - sx) + tx)} ${f3(oy * (1 - sy) + ty)})`;
}

function depthGroup(layer, dep) {
  if (dep.opacity <= 0 || layer.depth.length === 0) return '';
  const paths = layer.depth.map((p) => `<path d="${p.d}" fill="${p.fill}"/>`).join('');
  return `<g transform="translate(${f3(dep.dx)} ${f3(dep.dy)})" opacity="${f3(dep.opacity)}">${paths}</g>`;
}

function logoSvg(tl) {
  const dep = depthFrame(tl);
  const parts = [];

  // route band: revealed by stroking the centreline inside the route-face clip
  const draw = routeDraw(tl);
  parts.push(depthGroup(LOGO_LAYERS.route, dep));
  if (draw > 0) {
    parts.push(
      `<g clip-path="url(#routeClip)"><path d="${ROUTE_CENTERLINE}" fill="none" stroke="${MINT}" stroke-width="124" stroke-dasharray="${ROUTE_LEN} ${ROUTE_LEN}" stroke-dashoffset="${f3(ROUTE_LEN * (1 - draw))}"/></g>`,
    );
  }

  // arrowhead snap + push
  const ar = arrowFrame(tl);
  if (ar.opacity > 0 && ar.scale > 0.001) {
    const [ox, oy] = ARROW_ORIGIN;
    parts.push(
      `<g transform="${about(ox, oy, ar.scale, ar.scale)}"><g clip-path="url(#routeClip)"><path d="${ARROW_REGION}" fill="${MINT}"/></g></g>`,
    );
  }

  // letters
  ['h', 'a1', 'r', 'a2'].forEach((k, i) => {
    const L = LOGO_LAYERS[k];
    const f = letterFrame(tl, i);
    if (f.opacity <= 0) return;
    const ox = (L.bbox[0] + L.bbox[2]) / 2;
    const oy = L.bbox[3];
    parts.push(
      `<g transform="${about(ox, oy, f.scale, f.scale, 0, f.ty)}" opacity="${f3(f.opacity)}">${depthGroup(L, dep)}<path d="${L.face.d}" fill="${L.face.fill}"/></g>`,
    );
  });

  // dot (its depth is always on — without it the traced face looks bitten)
  const d = dotFrame(tl);
  if (d.opacity > 0) {
    const L = LOGO_LAYERS.dot;
    const ox = (L.bbox[0] + L.bbox[2]) / 2;
    const oy = L.bbox[3];
    parts.push(
      `<g transform="${about(ox, oy, d.sx, d.sy, 0, d.ty)}" opacity="${f3(d.opacity)}">${depthGroup(L, { dx: 0, dy: 0, opacity: 1 })}<path d="${L.face.d}" fill="${L.face.fill}"/></g>`,
    );
  }

  // moving "you" marker at the drawing front
  const hd = routeHead(tl, ROUTE_PTS);
  if (hd.opacity > 0) {
    parts.push(
      `<g opacity="${f3(hd.opacity)}"><circle cx="${f3(hd.x)}" cy="${f3(hd.y)}" r="54" fill="url(#headGlow)"/><circle cx="${f3(hd.x)}" cy="${f3(hd.y)}" r="17" fill="#FFFFFF"/></g>`,
    );
  }

  // light sweep over the finished faces
  const sh = shineFrame(tl);
  if (sh.opacity > 0) {
    parts.push(
      `<g clip-path="url(#facesClip)" opacity="${f3(sh.opacity * 0.85)}"><rect x="${f3(sh.x - 110)}" y="240" width="220" height="820" fill="url(#shineGrad)" transform="skewX(-22)"/></g>`,
    );
  }
  return parts.join('');
}

const DEFS = (() => {
  const faces = Object.values(LOGO_LAYERS)
    .map((L) => `<path d="${L.face.d}"/>`)
    .join('');
  return `<defs>
<clipPath id="routeClip"><path d="${LOGO_LAYERS.route.face.d}"/></clipPath>
<clipPath id="facesClip">${faces}</clipPath>
<linearGradient id="shineGrad" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/>
  <stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.55"/>
  <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
</linearGradient>
<filter id="shadow" x="-10%" y="-10%" width="120%" height="135%">
  <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#000814" flood-opacity="0.55"/>
</filter>
<radialGradient id="headGlow">
  <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.9"/>
  <stop offset="0.35" stop-color="${MINT}" stop-opacity="0.55"/>
  <stop offset="1" stop-color="${MINT}" stop-opacity="0"/>
</radialGradient>
<radialGradient id="vignette" cx="0.5" cy="0.5" r="0.75">
  <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
  <stop offset="1" stop-color="#000" stop-opacity="0.35"/>
</radialGradient>
</defs>`;
})();

function frameSvg(t, fmt) {
  const tl = t - LOGO_DELAY;
  const k = fmt.logoW / LOGO_ARTW;
  const push = 1 + 0.03 * easeInOutCubic(prog(tl, T.depthStart, DURATION - LOGO_DELAY)); // slow push-in at the end
  const s = k * push;
  const tx = fmt.w / 2 - LOGO_CX * s;
  const ty = fmt.h / 2 - LOGO_CY * s;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt.w}" height="${fmt.h}" viewBox="0 0 ${fmt.w} ${fmt.h}">
${DEFS}
<rect width="${fmt.w}" height="${fmt.h}" fill="${BG}"/>
${mapSvg(t, fmt)}
<rect width="${fmt.w}" height="${fmt.h}" fill="url(#vignette)"/>
<g transform="matrix(${f3(s)} 0 0 ${f3(s)} ${f3(tx)} ${f3(ty)})" filter="url(#shadow)">${logoSvg(tl)}</g>
</svg>`;
}

function renderPng(t, fmt) {
  return new Resvg(frameSvg(t, fmt), { fitTo: { mode: 'original' } }).render().asPng();
}

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + args.join(' '));
}

// ---------- CLI ----------
const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
fs.mkdirSync(OUT, { recursive: true });

const single = arg('--frame');
if (single !== undefined) {
  const fmt = FORMATS[arg('--only') ?? 'square'];
  const file = path.join(OUT, `frame-${single}.png`);
  fs.writeFileSync(file, renderPng(Number(single), fmt));
  console.log('wrote', file);
  process.exit(0);
}

const only = arg('--only');
const names = only ? [only] : Object.keys(FORMATS);
const frames = Math.round((DURATION / 1000) * FPS);

for (const name of names) {
  const fmt = FORMATS[name];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `hara-${name}-`));
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    fs.writeFileSync(path.join(tmp, `f${String(i).padStart(4, '0')}.png`), renderPng((i * 1000) / FPS, fmt));
    if (i % 30 === 0) process.stdout.write(`\r${name}: ${i}/${frames}`);
  }
  console.log(`\r${name}: ${frames} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const mp4 = path.join(OUT, `hara-intro-${fmt.w}x${fmt.h}.mp4`);
  ffmpeg(['-framerate', String(FPS), '-i', path.join(tmp, 'f%04d.png'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
  console.log('wrote', mp4);

  if (name === 'square') {
    const gif = path.join(OUT, 'hara-intro.gif');
    ffmpeg([
      '-framerate', String(FPS), '-i', path.join(tmp, 'f%04d.png'),
      '-vf', 'fps=30,scale=540:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4',
      '-loop', '0', gif,
    ]);
    console.log('wrote', gif);

    // contact sheet: 12 evenly spaced frames, 4×3
    const step = Math.floor(frames / 12);
    const sheet = path.join(OUT, 'contact-sheet.png');
    ffmpeg([
      '-framerate', String(FPS), '-i', path.join(tmp, 'f%04d.png'),
      '-vf', `select='not(mod(n\\,${step}))',scale=360:-1,tile=4x3:padding=6:color=0x0d1f3c`,
      '-frames:v', '1', '-update', '1', sheet,
    ]);
    console.log('wrote', sheet);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}
