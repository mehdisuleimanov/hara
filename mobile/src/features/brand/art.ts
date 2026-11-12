/**
 * Brand illustration data — Əhməd (the team's turquoise pin mascot with a navy flat cap)
 * and the illustrated people avatars (Aysel, Murad, Nənə).
 *
 * Pure data, no React Native imports: the app renders it with react-native-svg
 * (components/Brand.tsx); toSvg/mascotSvg/avatarSvg serialize it for Node previews.
 * Coordinates: mascot viewBox "0 0 140 150" (full) / "20 4 100 116" (head); avatars "0 0 100 100".
 */

export type Shape =
  | { t: 'path'; d: string; fill?: string; stroke?: string; sw?: number; op?: number; tf?: string }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill: string; op?: number; tf?: string }
  | { t: 'circle'; cx: number; cy: number; r: number; fill: string; op?: number }
  | { t: 'g'; tf?: string; op?: number; c: Shape[] };

export type Mood = 'smile' | 'talk' | 'think' | 'alert' | 'wave';
export type Who = 'aysel' | 'murad' | 'nene';

/** Colors sampled from the mascot artwork. */
export const MASCOT = {
  bodyTop: '#45E0C3',
  bodyBottom: '#1FC2A5',
  limb: '#27C9AC',
  limbDark: '#1FB497',
  cap: '#1D2536',
  capBrim: '#262F45',
  face: '#101521',
  cheek: '#7FEBD5',
  glow: '#2FE0C0',
  tongue: '#F27A8A',
};

export const PIN =
  'M50 4C26.8 4 8 22.4 8 45.2c0 27.6 33.3 59.6 39.1 64.9a4.3 4.3 0 0 0 5.8 0C58.7 104.8 92 72.8 92 45.2 92 22.4 73.2 4 50 4Z';

export const VB_FULL = '0 0 140 150';
export const VB_HEAD = '20 4 104 116';
/** head offset inside the full canvas */
const HX = 20;
const HY = 6;

/** Pivot points (full-canvas coordinates) used by the app to animate layers. */
export const PIVOT = {
  /** shoulder of the waving arm */
  shoulder: { x: 104, y: 74 },
  /** eye line (blink squashes around it) */
  eyes: { x: 70.5, y: 61 },
  /** mouth centre (talking mouth scales around it) */
  mouth: { x: 71, y: 77.5 },
};

const limb = (d: string, w = 11): Shape => ({ t: 'path', d, stroke: MASCOT.limb, sw: w, fill: 'none' });

export function mascotGlow(): Shape[] {
  return [
    { t: 'circle', cx: 70, cy: 70, r: 68, fill: MASCOT.glow, op: 0.1 },
    { t: 'circle', cx: 70, cy: 66, r: 56, fill: MASCOT.glow, op: 0.14 },
  ];
}

/** Legs + the hanging left arm (drawn behind the body). */
export function mascotBack(): Shape[] {
  return [
    limb('M62 108 L 61 130'),
    limb('M79 108 L 80 130'),
    { t: 'ellipse', cx: 58, cy: 136, rx: 11.5, ry: 7, fill: MASCOT.limb },
    { t: 'ellipse', cx: 83, cy: 136, rx: 11.5, ry: 7, fill: MASCOT.limb },
    { t: 'ellipse', cx: 58, cy: 138.5, rx: 9, ry: 3, fill: MASCOT.limbDark, op: 0.55 },
    { t: 'ellipse', cx: 83, cy: 138.5, rx: 9, ry: 3, fill: MASCOT.limbDark, op: 0.55 },
    limb('M34 76 Q 22 88 24 104'),
    { t: 'ellipse', cx: 24, cy: 107, rx: 7.5, ry: 8.5, fill: MASCOT.limb },
  ];
}

/** Raised right arm with the open waving hand (rotates around PIVOT.shoulder). */
export function mascotWaveArm(): Shape[] {
  return [
    limb('M104 74 Q 120 68 122 46'),
    { t: 'ellipse', cx: 123, cy: 38, rx: 10, ry: 11, fill: MASCOT.limb },
    { t: 'ellipse', cx: 114.5, cy: 27, rx: 3.6, ry: 7, fill: MASCOT.limb, tf: 'rotate(-18 114.5 27)' },
    { t: 'ellipse', cx: 122, cy: 24, rx: 3.6, ry: 7.5, fill: MASCOT.limb, tf: 'rotate(-4 122 24)' },
    { t: 'ellipse', cx: 129.5, cy: 26, rx: 3.6, ry: 7, fill: MASCOT.limb, tf: 'rotate(12 129.5 26)' },
    { t: 'ellipse', cx: 134.5, cy: 35, rx: 3.3, ry: 6, fill: MASCOT.limb, tf: 'rotate(48 134.5 35)' },
  ];
}

/** Brows per mood (head coordinates). */
function brows(mood: Mood): Shape[] {
  const b = (d: string): Shape => ({ t: 'path', d, stroke: MASCOT.face, sw: 3.6, fill: 'none' });
  switch (mood) {
    case 'think':
      return [b('M28 37 q 8 -7 15 -3'), b('M57 42 q 8 -1 15 1')];
    case 'alert':
      return [b('M28 41 q 7 -7 15 -6'), b('M57 35 q 8 -1 15 6')];
    case 'talk':
    case 'wave':
      return [b('M28 39 q 8 -7 15 -3'), b('M57 37 q 8 -5 15 1')];
    default:
      return [b('M28 42 q 8 -6 15 -2'), b('M57 40 q 8 -4 15 2')];
  }
}

/** Eyes per mood (head coordinates). Kept in their own layer for the blink. */
function eyes(mood: Mood): Shape[] {
  const big = mood === 'alert';
  const rx = big ? 9.4 : 8.8;
  const ry = big ? 11.4 : 10.5;
  // pupil offset: original artwork looks up-left; "think" looks up-right
  const px = mood === 'think' ? 2.4 : mood === 'alert' ? 0 : -1;
  const py = mood === 'think' ? -3 : mood === 'alert' ? 0.5 : 0.5;
  const pr = big ? 4.8 : 5.4;
  const out: Shape[] = [];
  for (const cx of [38, 63]) {
    out.push({ t: 'ellipse', cx, cy: 55, rx, ry, fill: '#FFFFFF' });
    out.push({ t: 'circle', cx: cx + px, cy: 55 + py, r: pr, fill: MASCOT.face });
    out.push({ t: 'circle', cx: cx + px + 1.8, cy: 55 + py - 2.9, r: 1.9, fill: '#FFFFFF' });
  }
  return out;
}

function mouth(mood: Mood): Shape[] {
  switch (mood) {
    case 'talk':
      return [
        { t: 'ellipse', cx: 51, cy: 71.5, rx: 5.6, ry: 4.6, fill: MASCOT.face },
        { t: 'ellipse', cx: 51, cy: 74, rx: 3.2, ry: 1.7, fill: MASCOT.tongue },
      ];
    case 'wave':
      return [
        { t: 'path', d: 'M41.5 67.5 Q 51 68.6 60.5 67.5 Q 58.5 79 51 79 Q 43.5 79 41.5 67.5 Z', fill: MASCOT.face },
        { t: 'ellipse', cx: 51, cy: 75.6, rx: 4.6, ry: 2.4, fill: MASCOT.tongue },
      ];
    case 'think':
      return [{ t: 'path', d: 'M46 72 q 6 -2.6 12 0.4', stroke: MASCOT.face, sw: 3.2, fill: 'none' }];
    case 'alert':
      return [{ t: 'ellipse', cx: 51, cy: 72, rx: 3.6, ry: 4.3, fill: MASCOT.face }];
    default:
      return [{ t: 'path', d: 'M43 69 c 4 5.5 12 5.5 16 0', stroke: MASCOT.face, sw: 3.2, fill: 'none' }];
  }
}

/** Pin body, cap, brows, cheeks (+ the static mouth unless the app animates it). */
export function mascotHead(mood: Mood, opts: { withMouth?: boolean; withEyes?: boolean } = {}): Shape[] {
  const { withMouth = true, withEyes = false } = opts;
  const c: Shape[] = [
    { t: 'path', d: PIN, fill: 'url(#ahmedBody)' },
    { t: 'path', d: 'M22 30 C 26 20 36 14 46 13', stroke: '#FFFFFF', op: 0.25, sw: 4, fill: 'none' },
    // big flat cap: dome over the top + brim out to the right
    { t: 'path', d: 'M7 42 C 4 18 26 0 52 0 C 77 0 94 13 95 31 C 81 25 65 23 50 24 C 33 25 17 31 7 42 Z', fill: MASCOT.cap },
    { t: 'path', d: 'M58 30 C 74 23 96 22 103 31 C 98 39 80 39 61 36 Z', fill: MASCOT.capBrim },
    { t: 'path', d: 'M16 30 C 24 14 40 6 56 6', stroke: '#FFFFFF', op: 0.1, sw: 4, fill: 'none' },
    { t: 'circle', cx: 51, cy: 3.2, r: 2.6, fill: MASCOT.capBrim },
    ...brows(mood),
    { t: 'ellipse', cx: 25, cy: 69, rx: 7.5, ry: 5, fill: MASCOT.cheek, op: mood === 'alert' ? 0.45 : 0.75 },
    { t: 'ellipse', cx: 76, cy: 69, rx: 7.5, ry: 5, fill: MASCOT.cheek, op: mood === 'alert' ? 0.45 : 0.75 },
  ];
  if (withEyes) c.push(...eyes(mood));
  if (withMouth) c.push(...mouth(mood));
  return [{ t: 'g', tf: `translate(${HX} ${HY})`, c }];
}

export function mascotEyes(mood: Mood): Shape[] {
  return [{ t: 'g', tf: `translate(${HX} ${HY})`, c: eyes(mood) }];
}

/** Open mouth used while speaking (scaled by the voice level around PIVOT.mouth). */
export function mascotTalkMouth(): Shape[] {
  return [
    { t: 'g', tf: `translate(${HX} ${HY})`, c: mouth('talk') },
  ];
}

/* ------------------------------------------------------------------ people */

const SKIN = { light: '#F6CDB0', mid: '#E9B48F', deep: '#D59A72', shade: '#E3A986' };
const INK = '#1D2536';

function face(o: { cx?: number; eyeY: number; gap: number; eyeR?: number; smileY: number; smileW?: number; cheekY: number; cheek?: string }): Shape[] {
  const cx = o.cx ?? 50;
  const r = o.eyeR ?? 2.6;
  const w = o.smileW ?? 7;
  return [
    { t: 'ellipse', cx: cx - o.gap, cy: o.eyeY, rx: r, ry: r * 1.15, fill: INK },
    { t: 'ellipse', cx: cx + o.gap, cy: o.eyeY, rx: r, ry: r * 1.15, fill: INK },
    { t: 'circle', cx: cx - o.gap + 0.9, cy: o.eyeY - 1, r: 0.85, fill: '#FFFFFF' },
    { t: 'circle', cx: cx + o.gap + 0.9, cy: o.eyeY - 1, r: 0.85, fill: '#FFFFFF' },
    { t: 'ellipse', cx: cx - o.gap - 3.4, cy: o.cheekY, rx: 3.8, ry: 2.4, fill: o.cheek ?? '#F59AA0', op: 0.45 },
    { t: 'ellipse', cx: cx + o.gap + 3.4, cy: o.cheekY, rx: 3.8, ry: 2.4, fill: o.cheek ?? '#F59AA0', op: 0.45 },
    { t: 'path', d: `M${cx - w / 2} ${o.smileY} q ${w / 2} ${w * 0.55} ${w} 0`, stroke: INK, sw: 1.9, fill: 'none' },
  ];
}

export const AVATAR_BG: Record<Who, string> = { aysel: '#DDF6EA', murad: '#DCE9FF', nene: '#ECEAFF' };
export const AVATAR_NAME: Record<Who, string> = { aysel: 'Aysel', murad: 'Murad', nene: 'Nənə' };

export function avatarArt(who: Who): Shape[] {
  if (who === 'aysel') {
    const skin = SKIN.light;
    return [
      // long hair behind
      { t: 'path', d: 'M27 44 C 26 24 37 15 51 15 C 66 15 75 25 74 44 C 74 60 77 72 81 82 L 20 82 C 24 72 27 60 27 44 Z', fill: '#2B1D1A' },
      // shoulders / top (brand green)
      { t: 'path', d: 'M14 100 C 15 83 30 75 50 75 C 70 75 85 83 86 100 Z', fill: '#12B76A' },
      { t: 'path', d: 'M40 76 Q 50 86 60 76 Z', fill: skin },
      // neck
      { t: 'path', d: 'M44 60 L 44 74 Q 50 79 56 74 L 56 60 Z', fill: SKIN.shade },
      // face
      { t: 'ellipse', cx: 50, cy: 46, rx: 17.5, ry: 19.5, fill: skin },
      // ears + earrings
      { t: 'ellipse', cx: 32.6, cy: 48, rx: 2.6, ry: 3.6, fill: SKIN.shade },
      { t: 'ellipse', cx: 67.4, cy: 48, rx: 2.6, ry: 3.6, fill: SKIN.shade },
      { t: 'circle', cx: 32.6, cy: 54, r: 1.7, fill: '#1F6FEB' },
      { t: 'circle', cx: 67.4, cy: 54, r: 1.7, fill: '#1F6FEB' },
      // side-swept fringe
      { t: 'path', d: 'M31 44 C 30 28 40 21 52 21 C 62 21 70 27 70 38 C 62 36 54 31 49 25 C 46 33 39 40 31 44 Z', fill: '#2B1D1A' },
      { t: 'path', d: 'M50 23 C 54 28 60 32 67 34', stroke: '#4A332D', sw: 1.4, fill: 'none', op: 0.8 },
      ...face({ eyeY: 48, gap: 7, smileY: 56.5, cheekY: 53.5 }),
    ];
  }
  if (who === 'murad') {
    const skin = SKIN.mid;
    return [
      // t-shirt (route blue) + backpack straps
      { t: 'path', d: 'M16 100 C 17 84 31 77 50 77 C 69 77 83 84 84 100 Z', fill: '#1F6FEB' },
      { t: 'path', d: 'M29 82 L 33 100 L 39 100 L 35 79 Z', fill: '#0F1B2D' },
      { t: 'path', d: 'M71 82 L 67 100 L 61 100 L 65 79 Z', fill: '#0F1B2D' },
      { t: 'path', d: 'M42 78 Q 50 85 58 78 Z', fill: skin },
      { t: 'path', d: 'M45 62 L 45 76 Q 50 80 55 76 L 55 62 Z', fill: SKIN.deep },
      // ears
      { t: 'ellipse', cx: 30.8, cy: 50, rx: 3.2, ry: 4.2, fill: SKIN.deep },
      { t: 'ellipse', cx: 69.2, cy: 50, rx: 3.2, ry: 4.2, fill: SKIN.deep },
      // round face
      { t: 'ellipse', cx: 50, cy: 49, rx: 19, ry: 19.5, fill: skin },
      // short hair with a tuft
      { t: 'path', d: 'M31 46 C 29 30 38 22 51 22 C 64 22 72 30 70 46 C 68 39 64 35 58 34 C 52 36 44 36 38 34 C 34 37 32 41 31 46 Z', fill: '#24170F' },
      { t: 'path', d: 'M47 23 C 49 17 55 16 58 19 C 55 19 52 21 51 24 Z', fill: '#24170F' },
      ...face({ eyeY: 50.5, gap: 7.4, eyeR: 2.9, smileY: 59, smileW: 8, cheekY: 56 }),
    ];
  }
  const skin = SKIN.light;
  return [
    // cardigan (AI violet) + blouse
    { t: 'path', d: 'M14 100 C 15 84 30 77 50 77 C 70 77 85 84 86 100 Z', fill: '#7C7CF8' },
    { t: 'path', d: 'M43 78 L 50 100 L 57 78 Q 50 82 43 78 Z', fill: '#FFFFFF' },
    { t: 'circle', cx: 50, cy: 90, r: 1.4, fill: '#5B5BF6' },
    { t: 'path', d: 'M45 62 L 45 76 Q 50 80 55 76 L 55 62 Z', fill: SKIN.shade },
    // silver hair: bun + volume
    { t: 'circle', cx: 50, cy: 20, r: 8.5, fill: '#B9C0CC' },
    { t: 'path', d: 'M29 50 C 26 30 37 23 50 23 C 63 23 74 30 71 50 C 70 44 68 40 64 38 L 36 38 C 32 40 30 44 29 50 Z', fill: '#C9CED8' },
    { t: 'ellipse', cx: 50, cy: 49, rx: 17.5, ry: 19, fill: skin },
    { t: 'path', d: 'M33 42 C 34 31 42 27 50 27 C 58 27 66 31 67 42 C 61 36 56 34 50 34 C 44 34 39 36 33 42 Z', fill: '#C9CED8' },
    { t: 'path', d: 'M40 30 C 44 28 48 28 52 29', stroke: '#E4E7EE', sw: 1.4, fill: 'none' },
    ...face({ eyeY: 50, gap: 7, eyeR: 2.3, smileY: 58.5, smileW: 8, cheekY: 55.5 }),
    // round glasses
    { t: 'circle', cx: 43, cy: 50, r: 5.6, fill: '#FFFFFF', op: 0.18 },
    { t: 'circle', cx: 57, cy: 50, r: 5.6, fill: '#FFFFFF', op: 0.18 },
    { t: 'path', d: 'M37.4 50 a 5.6 5.6 0 1 0 11.2 0 a 5.6 5.6 0 1 0 -11.2 0 M51.4 50 a 5.6 5.6 0 1 0 11.2 0 a 5.6 5.6 0 1 0 -11.2 0 M48.6 49.4 q 1.4 -1.2 2.8 0', stroke: '#334155', sw: 1.5, fill: 'none' },
  ];
}

/* ------------------------------------------------------------------ svg string (Node) */

function attrs(s: Record<string, string | number | undefined>) {
  return Object.entries(s)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
}

/** Serialize shapes to an SVG fragment (used by scripts/render-brand.mjs). */
export function toSvg(shapes: Shape[]): string {
  return shapes
    .map((s) => {
      switch (s.t) {
        case 'g':
          return `<g ${attrs({ transform: s.tf, opacity: s.op })}>${toSvg(s.c)}</g>`;
        case 'path':
          return `<path ${attrs({
            d: s.d,
            fill: s.fill ?? 'none',
            stroke: s.stroke,
            'stroke-width': s.sw,
            'stroke-linecap': s.stroke ? 'round' : undefined,
            'stroke-linejoin': s.stroke ? 'round' : undefined,
            opacity: s.op,
            transform: s.tf,
          })}/>`;
        case 'ellipse':
          return `<ellipse ${attrs({ cx: s.cx, cy: s.cy, rx: s.rx, ry: s.ry, fill: s.fill, opacity: s.op, transform: s.tf })}/>`;
        case 'circle':
          return `<circle ${attrs({ cx: s.cx, cy: s.cy, r: s.r, fill: s.fill, opacity: s.op })}/>`;
      }
    })
    .join('');
}

export const MASCOT_DEFS = `<defs><linearGradient id="ahmedBody" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="${MASCOT.bodyTop}"/><stop offset="1" stop-color="${MASCOT.bodyBottom}"/></linearGradient></defs>`;

/** Whole mascot as an SVG string (full or head-only). */
export function mascotSvg(mood: Mood = 'smile', full = true, glow = full): string {
  const vb = full ? VB_FULL : VB_HEAD;
  const parts = [
    ...(glow ? mascotGlow() : []),
    ...(full ? mascotBack() : []),
    ...(full ? mascotWaveArm() : []),
    ...mascotHead(mood, { withEyes: true }),
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${MASCOT_DEFS}${toSvg(parts)}</svg>`;
}

export function avatarSvg(who: Who): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><clipPath id="c"><circle cx="50" cy="50" r="50"/></clipPath></defs><g clip-path="url(#c)"><rect width="100" height="100" fill="${AVATAR_BG[who]}"/>${toSvg(avatarArt(who))}</g></svg>`;
}
