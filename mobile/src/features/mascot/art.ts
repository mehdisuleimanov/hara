/**
 * Əhməd — vector art as plain data (no React / RN imports).
 *
 * The character is split into rig parts. Every part is drawn in GLOBAL design
 * coordinates of a 220 × 240 canvas (body centre x = 110, ground y = 228) and
 * carries a tight bounding box, so the app can render each part as its own small
 * static <Svg> (viewBox = box) inside an Animated.View joint, while the Node
 * preview script draws the very same data as one nested SVG.
 *
 * Joints (see JOINTS) define the pivots that the rig rotates/scales around.
 */

export type Stop = [offset: number, color: string, opacity?: number];
export type Grad =
  | { k: 'lin'; id: string; x1: number; y1: number; x2: number; y2: number; stops: Stop[] }
  | { k: 'rad'; id: string; cx: number; cy: number; r: number; fx?: number; fy?: number; stops: Stop[] };

type Paint = { fill?: string; stroke?: string; sw?: number; op?: number; lc?: 'round' | 'butt'; clip?: string };
export type Shape =
  | ({ k: 'path'; d: string } & Paint)
  | ({ k: 'ell'; cx: number; cy: number; rx: number; ry: number; rot?: number } & Paint)
  | ({ k: 'rect'; x: number; y: number; w: number; h: number; r?: number } & Paint)
  | { k: 'g'; tf?: string; op?: number; clip?: string; ch: Shape[] };

export type Clip = { id: string; shapes: Shape[] };
export type Box = [x: number, y: number, w: number, h: number];
export type Art = { box: Box; defs?: Grad[]; clips?: Clip[]; shapes: Shape[] };

// ───────────────────────── layout ─────────────────────────
export const CANVAS = { w: 220, h: 240 } as const;
export const CX = 110;
export const GROUND = 228;
/** default 3/4 turn of the face toward the cap brim (reference look) */
export const FACE_X = 5;

export const SHOULDER_L = { x: 62, y: 140 };
export const SHOULDER_R = { x: 158, y: 140 };
export const UPPER = 18; // shoulder → elbow
export const FORE = 16; // elbow → wrist
export const HIP_L = { x: 100, y: 193 };
export const HIP_R = { x: 120, y: 193 };
export const LEG = 21; // hip → ankle

export const EYE_L = { x: 87.5, y: 106.5, rx: 12, ry: 15.2 };
export const EYE_R = { x: 132.5, y: 106.5, rx: 12, ry: 15.2 };
export const MOUTH = { x: 110, y: 124 };
export const CAP_PIVOT = { x: 96, y: 74 };
export const BODY_PIVOT = { x: 110, y: 206 };

// ───────────────────────── palette ─────────────────────────
export const COL = {
  bodyHi: '#4FE8D0',
  body: '#14D3BA',
  bodyMid: '#0AC4AD',
  bodyLo: '#06AA97',
  bodyDeep: '#048E80',
  limbHi: '#3BE0C8',
  limb: '#12CAB2',
  limbLo: '#08A893',
  cap: '#243248',
  capHi: '#3A4C69',
  capLo: '#161F2F',
  seam: '#121A28',
  brimTop: '#2B3A53',
  brimUnder: '#0A111C',
  ink: '#0E1A2B',
  white: '#FFFFFF',
  cheek: '#9AF0E3',
  lid: '#12C8AF',
  lidLo: '#0FB9A2',
  tongue: '#FF8A97',
  glow: '#2FE0C0',
  shadow: '#0F1B2D',
  ai: '#5B5BF6',
  lens: '#CFEFFF',
  metal: '#C9D4E3',
  beam: '#FFE9A8',
};

// ───────────────────────── helpers ─────────────────────────
const f = (n: number) => Math.round(n * 100) / 100;
/** vertical capsule from (x, y1) to (x, y2), width w */
function capsule(x: number, y1: number, y2: number, w: number): string {
  const r = w / 2;
  return `M${f(x - r)} ${f(y1)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y1)}L${f(x + r)} ${f(y2)}A${f(r)} ${f(r)} 0 0 1 ${f(x - r)} ${f(y2)}Z`;
}
const tubeStops: Stop[] = [
  [0, '#0FBDA6'],
  [0.32, '#2FDAC1'],
  [0.62, COL.limb],
  [1, '#0CB7A0'],
];

// ───────────────────────── body ─────────────────────────
/** plush map-pin: round top (r = 62.5 around 110,117), soft rounded point at y ≈ 209 */
export const PIN_PATH =
  'M110 209C116.5 209 123 202 130 192C147 170 172.5 149 172.5 117C172.5 82.5 144.5 54.5 110 54.5C75.5 54.5 47.5 82.5 47.5 117C47.5 149 73 170 90 192C97 202 103.5 209 110 209Z';

export const BODY: Art = {
  box: [44, 52, 132, 160],
  defs: [
    { k: 'rad', id: 'bodyFill', cx: 0.4, cy: 0.26, r: 0.78, fx: 0.36, fy: 0.2, stops: [[0, COL.bodyHi], [0.42, COL.body], [0.78, COL.bodyMid], [1, COL.bodyLo]] },
    { k: 'lin', id: 'bodyShade', x1: 0.2, y1: 0.35, x2: 0.85, y2: 1, stops: [[0, COL.bodyDeep, 0], [0.6, COL.bodyDeep, 0.1], [1, COL.bodyDeep, 0.5]] },
    { k: 'rad', id: 'bodySpec', cx: 0.5, cy: 0.5, r: 0.5, stops: [[0, '#FFFFFF', 0.5], [1, '#FFFFFF', 0]] },
    { k: 'lin', id: 'bodyRim', x1: 0, y1: 0, x2: 1, y2: 0, stops: [[0, '#FFFFFF', 0], [0.7, '#FFFFFF', 0], [1, '#BFFFF3', 0.35]] },
  ],
  shapes: [
    { k: 'path', d: PIN_PATH, fill: 'url(#bodyFill)' },
    { k: 'path', d: PIN_PATH, fill: 'url(#bodyShade)' },
    { k: 'path', d: PIN_PATH, fill: 'url(#bodyRim)' },
    // soft specular highlight (upper left, under the cap edge)
    { k: 'ell', cx: 68, cy: 108, rx: 11, ry: 19, rot: 24, fill: 'url(#bodySpec)', op: 0.32 },
    // subtle edge definition on the white canvas
    { k: 'path', d: PIN_PATH, fill: 'none', stroke: COL.bodyLo, sw: 0.7, op: 0.35 },
  ],
};

/** contact shadow of the cap on the head (clipped to the body) — fades when the cap lifts */
export const CAP_SHADOW: Art = {
  box: [44, 52, 132, 60],
  clips: [{ id: 'pinClip', shapes: [{ k: 'path', d: PIN_PATH }] }],
  shapes: [
    {
      k: 'g',
      clip: 'pinClip',
      ch: [
        { k: 'path', d: 'M40 99C58 89 70 80 80 75C95 71 110 67 128 63.4C142 60.6 154 58 164 55', fill: 'none', stroke: COL.bodyDeep, sw: 11, op: 0.16, lc: 'round' },
        { k: 'path', d: 'M40 99C58 89 70 80 80 75C95 71 110 67 128 63.4C142 60.6 154 58 164 55', fill: 'none', stroke: COL.bodyDeep, sw: 6, op: 0.22, lc: 'round' },
      ],
    },
  ],
};

// ───────────────────────── cap (newsboy) ─────────────────────────
// Measured from the reference: puffy 8-panel crown overhanging a long curved front brim
// that runs from the left-centre of the forehead (≈79,74) to its tip (≈165,52).
const CROWN =
  'M44.4 96.8C38 90 36.6 78 39.6 68C42.6 58 50 48 60 41C68 35 76 30.4 84 28.2C98 25 118 25.4 131 30.5C140 34 146.4 38.6 148.2 43.6C148.8 45.4 148.2 46.4 147 46.8C140 46.6 133 47.2 128.5 48.6C118 52 109 56.6 104.6 59.6C95 64.6 86 69.4 78.6 73.6C71.6 79 61.6 87.4 44.4 96.8Z';
const BRIM =
  'M76 74.6C94 62.4 124 46.6 150 43.6C157 42.8 162.4 44.2 165 47.8C167.8 51.6 166.2 54.4 162 55.8C152 58.8 140 60.2 128 62.6C116 65 104 69.8 92 74.2C85.4 76.6 80 76.8 76 74.6Z';
const BRIM_UNDER =
  'M98 72.2C114 66.6 140 60 162 55.8C162 58.4 158.6 60.8 152.6 62.6C140.6 66 124 68.6 112 71.6C106 73 101 73.6 98 72.2Z';

export const CAP: Art = {
  box: [32, 20, 140, 82],
  defs: [
    { k: 'rad', id: 'crown', cx: 0.3, cy: 0.16, r: 0.95, fx: 0.28, fy: 0.1, stops: [[0, COL.capHi], [0.42, COL.cap], [1, COL.capLo]] },
    { k: 'lin', id: 'brim', x1: 0.1, y1: 0, x2: 0.35, y2: 1, stops: [[0, '#33435E'], [0.6, '#27354C'], [1, '#1C2739']] },
  ],
  shapes: [
    // brim (the crown's front lip overlaps its upper edge)
    { k: 'path', d: BRIM_UNDER, fill: '#101826' },
    { k: 'path', d: BRIM, fill: 'url(#brim)' },
    // brim outer-edge highlight
    { k: 'path', d: 'M86 73.4C102 68.4 120 63.6 134 60.8C146 58.6 155 57 161.6 54.4', fill: 'none', stroke: '#6E83A6', sw: 1, op: 0.5, lc: 'round' },
    // crown
    { k: 'path', d: CROWN, fill: 'url(#crown)' },
    // panel seams (8-panel crown, 3 visible) + their soft highlights
    { k: 'path', d: 'M80.6 31.4C70 39 62.6 51 61.4 75', fill: 'none', stroke: COL.seam, sw: 1.15, op: 0.75, lc: 'round' },
    { k: 'path', d: 'M82.2 32.4C72.4 40 65.4 51.4 64.2 74', fill: 'none', stroke: '#4E6284', sw: 0.8, op: 0.42, lc: 'round' },
    { k: 'path', d: 'M85.4 29.2C98 29.2 109.6 32.4 113.6 37.6C116.6 41.6 117.6 45.6 117.6 52', fill: 'none', stroke: COL.seam, sw: 1.15, op: 0.75, lc: 'round' },
    { k: 'path', d: 'M85.6 31.2C97 31.4 107.4 34.4 111 39C113.6 42.6 114.6 46.6 114.6 53', fill: 'none', stroke: '#4E6284', sw: 0.8, op: 0.38, lc: 'round' },
    { k: 'path', d: 'M120.6 29.2C131 31.6 140 35.6 145 41', fill: 'none', stroke: COL.seam, sw: 1, op: 0.45, lc: 'round' },
    // shading under the front lip + rolled band on the left
    { k: 'path', d: 'M47 94.6C60 86.8 70 79.6 79.2 73.4C88 68.4 97 63.6 105 59.6C113 55.6 121 51.6 129 49.2C135 47.6 141 47.2 146.4 46.8', fill: 'none', stroke: COL.capLo, sw: 2.6, op: 0.8, lc: 'round' },
    { k: 'path', d: 'M39.8 80C40.4 87 42.6 92 46 95.4', fill: 'none', stroke: '#6E83A6', sw: 1.2, op: 0.35, lc: 'round' },
    // top highlight
    { k: 'path', d: 'M48 60C54 49 64 40 78 34', fill: 'none', stroke: '#7287AB', sw: 2.6, op: 0.3, lc: 'round' },
    { k: 'path', d: 'M96 28.4C110 27.6 122 29.4 131 33.4', fill: 'none', stroke: '#7287AB', sw: 1.6, op: 0.22, lc: 'round' },
    // button
    { k: 'ell', cx: 80.5, cy: 30.3, rx: 6.2, ry: 2.9, fill: COL.capLo },
    { k: 'ell', cx: 80.5, cy: 29.2, rx: 5.6, ry: 2.4, fill: '#33435E' },
    { k: 'ell', cx: 79.4, cy: 28.6, rx: 2.4, ry: 0.9, fill: '#6B80A3', op: 0.5 },
  ],
};

// ───────────────────────── face ─────────────────────────
export const CHEEKS: Art = {
  box: [60, 116, 100, 20],
  defs: [{ k: 'rad', id: 'cheek', cx: 0.5, cy: 0.5, r: 0.5, stops: [[0, COL.cheek, 0.85], [0.6, COL.cheek, 0.55], [1, COL.cheek, 0]] }],
  shapes: [
    { k: 'ell', cx: 71.5, cy: 127, rx: 12, ry: 8.2, fill: 'url(#cheek)' },
    { k: 'ell', cx: 148.5, cy: 127, rx: 12, ry: 8.2, fill: 'url(#cheek)' },
  ],
};

type Eye = typeof EYE_L;
const eyeBox = (e: Eye, pad = 0): Box => [e.x - e.rx - pad, e.y - e.ry - pad, 2 * (e.rx + pad), 2 * (e.ry + pad)];
export function eyeWhite(e: Eye): Art {
  return {
    box: eyeBox(e),
    shapes: [
      { k: 'ell', cx: e.x, cy: e.y, rx: e.rx, ry: e.ry, fill: COL.white },
      // faint inner shade at the top (depth)
      { k: 'ell', cx: e.x, cy: e.y - e.ry * 0.7, rx: e.rx * 0.7, ry: e.ry * 0.28, fill: '#E3F3F3', op: 0.35 },
    ],
  };
}
/** pupil + glints (moves inside the eye, clipped by the eye white) */
export function pupil(e: Eye): Art {
  const px = e.x + 0.6;
  const py = e.y + 1.2;
  return {
    box: eyeBox(e),
    shapes: [
      { k: 'ell', cx: px, cy: py, rx: 7.3, ry: 9.4, fill: COL.ink },
      { k: 'ell', cx: px + 2.5, cy: py - 4.2, rx: 2.8, ry: 2.9, fill: COL.white },
      { k: 'ell', cx: px - 2.7, cy: py + 4.4, rx: 1.1, ry: 1.1, fill: COL.white, op: 0.7 },
    ],
  };
}
/** upper eyelid: skin-coloured, lash line on its lower edge. Slides down to close. */
export function lid(e: Eye): Art {
  const { x, y, rx, ry } = e;
  const [top, bot] = e.x < CX ? ['#45E3CB', '#30D9C1'] : ['#2DD6BF', '#1ECDB6'];
  return {
    box: [x - rx - 1, y - 2 * ry - 6, 2 * rx + 2, 2 * ry + 12],
    defs: [{ k: 'lin', id: 'lid', x1: 0, y1: 0, x2: 0, y2: 1, stops: [[0, top], [0.75, bot], [1, COL.lidLo]] }],
    shapes: [
      { k: 'path', d: `M${x - rx - 1} ${y - 2 * ry - 6}H${x + rx + 1}V${y}Q${x} ${y + 5} ${x - rx - 1} ${y}Z`, fill: 'url(#lid)' },
      { k: 'path', d: `M${x - rx - 1} ${y}Q${x} ${y + 5} ${x + rx + 1} ${y}`, fill: 'none', stroke: COL.ink, sw: 2.3, lc: 'round' },
    ],
  };
}
/** lid translateY (design units): 0 = open … 1 = closed */
export function lidOffset(e: Eye, closed: number) {
  const open = -(e.ry + 5);
  const shut = e.ry * 0.52;
  return open + (shut - open) * closed;
}
/** happy "^" closed eye */
export function happyEye(e: Eye): Art {
  return {
    box: [e.x - e.rx - 2, e.y - 10, 2 * e.rx + 4, 16],
    shapes: [{ k: 'path', d: `M${e.x - 9} ${e.y + 3}Q${e.x} ${e.y - 9} ${e.x + 9} ${e.y + 3}`, fill: 'none', stroke: COL.ink, sw: 3.2, lc: 'round' }],
  };
}

export const BROW_L: Art = {
  box: [74, 80, 26, 14],
  shapes: [{ k: 'path', d: 'M78 91.5C80.5 85.5 88 83 95.8 84.8', fill: 'none', stroke: COL.ink, sw: 3.1, lc: 'round' }],
};
export const BROW_R: Art = {
  box: [120, 80, 26, 14],
  shapes: [{ k: 'path', d: 'M124.2 84.8C132 83 139.5 85.5 142 91.5', fill: 'none', stroke: COL.ink, sw: 3.1, lc: 'round' }],
};
export const BROW_L_C = { x: 87, y: 87 };
export const BROW_R_C = { x: 133, y: 87 };

// mouths (all centred on MOUTH)
export const MOUTH_SMILE: Art = {
  box: [94, 114, 32, 18],
  shapes: [{ k: 'path', d: 'M97.6 120.2C100.6 129.4 119.4 129.4 122.4 120.2', fill: 'none', stroke: COL.ink, sw: 3.2, lc: 'round' }],
};
const OPEN_D = 'M98 119.5C104 121.8 116 121.8 122 119.5C121.6 129 115.5 133 110 133C104.5 133 98.4 129 98 119.5Z';
/** open "D" mouth with tongue; scaled vertically from its top edge for lip-sync */
export const MOUTH_OPEN: Art = {
  box: [95, 117, 30, 18],
  clips: [{ id: 'mouthClip', shapes: [{ k: 'path', d: OPEN_D }] }],
  shapes: [
    { k: 'path', d: OPEN_D, fill: COL.ink, stroke: COL.ink, sw: 1.6 },
    { k: 'g', clip: 'mouthClip', ch: [{ k: 'ell', cx: 110, cy: 133, rx: 7.5, ry: 5, fill: COL.tongue }] },
  ],
};
export const MOUTH_TOP = 120; // pivot y for the open mouth (scaleY from the top lip)
export const MOUTH_O: Art = {
  box: [102, 116, 16, 16],
  clips: [{ id: 'oClip', shapes: [{ k: 'ell', cx: 110, cy: 124, rx: 4.6, ry: 5.6 }] }],
  shapes: [
    { k: 'ell', cx: 110, cy: 124, rx: 4.6, ry: 5.6, fill: COL.ink },
    { k: 'g', clip: 'oClip', ch: [{ k: 'ell', cx: 110, cy: 129.5, rx: 4, ry: 2.6, fill: COL.tongue }] },
  ],
};
export const MOUTH_FLAT: Art = {
  box: [98, 117, 24, 10],
  shapes: [{ k: 'path', d: 'M102 122.5Q110 124.3 118 122', fill: 'none', stroke: COL.ink, sw: 2.8, lc: 'round' }],
};
export const MOUTH_WOBBLE: Art = {
  box: [97, 116, 26, 12],
  shapes: [{ k: 'path', d: 'M100.5 123Q103.5 119.5 106.5 122.5T112.5 122.5T119 121', fill: 'none', stroke: COL.ink, sw: 2.6, lc: 'round' }],
};

// ───────────────────────── limbs ─────────────────────────
type Side = 'L' | 'R';
const sh = (s: Side) => (s === 'L' ? SHOULDER_L : SHOULDER_R);
export function upperArm(s: Side): Art {
  const p = sh(s);
  return {
    box: [p.x - 9, p.y - 9, 18, UPPER + 18],
    defs: [{ k: 'lin', id: 'tube', x1: 0, y1: 0, x2: 1, y2: 0, stops: tubeStops }],
    shapes: [{ k: 'path', d: capsule(p.x, p.y, p.y + UPPER, 16.4), fill: 'url(#tube)' }],
  };
}
export function foreArm(s: Side): Art {
  const p = sh(s);
  const y0 = p.y + UPPER;
  return {
    box: [p.x - 9, y0 - 9, 18, FORE + 18],
    defs: [{ k: 'lin', id: 'tube', x1: 0, y1: 0, x2: 1, y2: 0, stops: tubeStops }],
    shapes: [{ k: 'path', d: capsule(p.x, y0, y0 + FORE, 15.4), fill: 'url(#tube)' }],
  };
}
export const wristOf = (s: Side) => ({ x: sh(s).x, y: sh(s).y + UPPER + FORE });
export const elbowOf = (s: Side) => ({ x: sh(s).x, y: sh(s).y + UPPER });

export type HandKind = 'mitten' | 'open' | 'point' | 'grip';
export const HAND_KINDS: HandKind[] = ['mitten', 'open', 'point', 'grip'];

const handGrad: Grad = { k: 'rad', id: 'hand', cx: 0.4, cy: 0.35, r: 0.75, stops: [[0, COL.limbHi], [0.55, COL.limb], [1, COL.limbLo]] };
/** hand shapes in wrist-local coords (wrist at 0,0, arm pointing +y, thumb on -x for the right arm) */
function handLocal(kind: HandKind): Shape[] {
  const F = 'url(#hand)';
  switch (kind) {
    case 'mitten':
      return [
        { k: 'ell', cx: 0.6, cy: 8, rx: 7.8, ry: 8.8, fill: F },
        { k: 'ell', cx: -5.4, cy: 7.4, rx: 3.1, ry: 4.8, rot: 18, fill: F },
        { k: 'path', d: 'M-3 12.5Q-2.6 15.4 -1 16.6', fill: 'none', stroke: COL.limbLo, sw: 1, op: 0.8, lc: 'round' },
      ];
    case 'open':
      return [
        { k: 'ell', cx: -7.6, cy: 5.2, rx: 3, ry: 5.4, rot: 52, fill: F },
        { k: 'ell', cx: -3.9, cy: 15, rx: 3.2, ry: 5.8, rot: 14, fill: F },
        { k: 'ell', cx: 0.6, cy: 16.4, rx: 3.2, ry: 6, rot: 0, fill: F },
        { k: 'ell', cx: 5, cy: 14.6, rx: 3.1, ry: 5.4, rot: -16, fill: F },
        { k: 'ell', cx: 0.4, cy: 8, rx: 7.8, ry: 7.4, fill: F },
      ];
    case 'point':
      return [
        { k: 'ell', cx: 0.4, cy: 16, rx: 2.9, ry: 7.4, fill: F },
        { k: 'ell', cx: 0.6, cy: 7.4, rx: 7.2, ry: 7.4, fill: F },
        { k: 'ell', cx: -5.4, cy: 7.8, rx: 2.9, ry: 4.4, rot: 20, fill: F },
        { k: 'path', d: 'M2 12Q4.6 12.6 6.4 11', fill: 'none', stroke: COL.limbLo, sw: 1, op: 0.8, lc: 'round' },
      ];
    case 'grip':
      return [
        { k: 'ell', cx: 0.4, cy: 7.4, rx: 7.6, ry: 7.6, fill: F },
        { k: 'path', d: 'M-1.6 3.6Q-4.2 8 -1.6 12.4', fill: 'none', stroke: COL.limbLo, sw: 1, op: 0.85, lc: 'round' },
        { k: 'path', d: 'M2.6 3.6Q0.6 8 2.6 12.4', fill: 'none', stroke: COL.limbLo, sw: 1, op: 0.6, lc: 'round' },
        { k: 'ell', cx: -5.6, cy: 8.6, rx: 2.8, ry: 4.2, rot: 10, fill: F },
      ];
  }
}
export function hand(s: Side, kind: HandKind): Art {
  const w = wristOf(s);
  const m = s === 'R' ? 1 : -1;
  return {
    box: [w.x - 19, w.y - 8, 38, 40],
    defs: [handGrad],
    shapes: [{ k: 'g', tf: `translate(${w.x} ${w.y}) scale(${m * 1.26} 1.26)`, ch: handLocal(kind) }],
  };
}

export function leg(s: Side): Art {
  const h = s === 'L' ? HIP_L : HIP_R;
  const m = s === 'L' ? -1 : 1;
  const ankle = h.y + LEG;
  return {
    box: [h.x - 18, h.y - 8, 36, LEG + 20],
    defs: [
      { k: 'lin', id: 'tube', x1: 0, y1: 0, x2: 1, y2: 0, stops: tubeStops },
      { k: 'rad', id: 'foot', cx: 0.42, cy: 0.3, r: 0.8, stops: [[0, COL.limbHi], [0.5, COL.limb], [1, COL.limbLo]] },
    ],
    shapes: [
      { k: 'path', d: capsule(h.x, h.y - 2, ankle, 16.4), fill: 'url(#tube)' },
      { k: 'ell', cx: h.x + m * 3.4, cy: ankle + 5, rx: 14.4, ry: 9, fill: 'url(#foot)' },
      { k: 'path', d: `M${h.x + m * 3.4 - 8} ${ankle + 1.6}Q${h.x + m * 3.4} ${ankle - 0.6} ${h.x + m * 3.4 + 8} ${ankle + 1.6}`, fill: 'none', stroke: '#FFFFFF', sw: 1.4, op: 0.25, lc: 'round' },
    ],
  };
}

// ───────────────────────── props (attached to the right wrist) ─────────────────────────
/** magnifier: handle runs through the fist along the arm, lens beyond the hand */
export function magnifier(): Art {
  const w = wristOf('R');
  return {
    box: [w.x - 16, w.y - 2, 32, 48],
    defs: [
      { k: 'rad', id: 'lens', cx: 0.4, cy: 0.35, r: 0.7, stops: [[0, '#FFFFFF', 0.85], [0.5, COL.lens, 0.55], [1, '#9FD8F5', 0.6]] },
      { k: 'lin', id: 'ring', x1: 0, y1: 0, x2: 1, y2: 1, stops: [[0, '#3B4E6E'], [1, '#141D2C']] },
    ],
    shapes: [
      {
        k: 'g',
        tf: `translate(${w.x} ${w.y})`,
        ch: [
          { k: 'rect', x: -2.6, y: 0, w: 5.2, h: 17, r: 2.6, fill: '#1E2B40' },
          { k: 'rect', x: -2, y: 13.5, w: 4, h: 4.5, r: 1, fill: '#8C9BB6' },
          { k: 'ell', cx: 0, cy: 30, rx: 13.6, ry: 13.6, fill: 'url(#ring)' },
          { k: 'ell', cx: 0, cy: 30, rx: 10.6, ry: 10.6, fill: 'url(#lens)' },
          { k: 'path', d: 'M-6.4 25Q-4 21.2 0.6 20.6', fill: 'none', stroke: '#FFFFFF', sw: 2, op: 0.95, lc: 'round' },
          { k: 'ell', cx: 5.4, cy: 35.4, rx: 1.4, ry: 1.4, fill: '#FFFFFF', op: 0.8 },
        ],
      },
    ],
  };
}
/** lens glint sparkle (separate so it can twinkle) */
export function lensGlint(): Art {
  const w = wristOf('R');
  const cx = w.x + 6.5;
  const cy = w.y + 22;
  return {
    box: [cx - 6, cy - 6, 12, 12],
    shapes: [{ k: 'path', d: `M${cx} ${cy - 5.5}Q${cx + 0.9} ${cy - 0.9} ${cx + 5.5} ${cy}Q${cx + 0.9} ${cy + 0.9} ${cx} ${cy + 5.5}Q${cx - 0.9} ${cy + 0.9} ${cx - 5.5} ${cy}Q${cx - 0.9} ${cy - 0.9} ${cx} ${cy - 5.5}Z`, fill: '#FFFFFF' }],
  };
}
export function flashlight(): Art {
  const w = wristOf('R');
  return {
    box: [w.x - 8, w.y - 2, 16, 26],
    defs: [{ k: 'lin', id: 'torch', x1: 0, y1: 0, x2: 1, y2: 0, stops: [[0, '#1A2638'], [0.4, '#3A4C69'], [1, '#141D2C']] }],
    shapes: [
      {
        k: 'g',
        tf: `translate(${w.x} ${w.y})`,
        ch: [
          { k: 'rect', x: -3.3, y: 0, w: 6.6, h: 17, r: 2, fill: 'url(#torch)' },
          { k: 'path', d: 'M-3.3 16L-5.2 21.5H5.2L3.3 16Z', fill: '#2B3A53' },
          { k: 'rect', x: -5.4, y: 21, w: 10.8, h: 2.4, r: 1.2, fill: COL.metal },
          { k: 'ell', cx: 0, cy: 22.3, rx: 4.2, ry: 0.9, fill: '#FFF6D6' },
        ],
      },
    ],
  };
}
export function beam(): Art {
  const w = wristOf('R');
  const y0 = w.y + 22;
  return {
    box: [w.x - 26, y0, 52, 58],
    defs: [{ k: 'lin', id: 'beam', x1: 0, y1: 0, x2: 0, y2: 1, stops: [[0, COL.beam, 0.85], [0.5, COL.beam, 0.35], [1, COL.beam, 0]] }],
    shapes: [{ k: 'path', d: `M${w.x - 4.6} ${y0}L${w.x - 24} ${y0 + 56}Q${w.x} ${y0 + 62} ${w.x + 24} ${y0 + 56}L${w.x + 4.6} ${y0}Z`, fill: 'url(#beam)' }],
  };
}

// ───────────────────────── fx ─────────────────────────
export const THINK_DOT = (cx: number, cy: number, r: number): Art => ({
  box: [cx - r - 1, cy - r - 1, 2 * r + 2, 2 * r + 2],
  shapes: [{ k: 'ell', cx, cy, rx: r, ry: r, fill: COL.ai }],
});
export const ZZZ = (cx: number, cy: number, s: number): Art => ({
  box: [cx - s, cy - s, 2 * s, 2 * s],
  shapes: [{ k: 'path', d: `M${cx - s * 0.55} ${cy - s * 0.55}H${cx + s * 0.55}L${cx - s * 0.55} ${cy + s * 0.55}H${cx + s * 0.55}`, fill: 'none', stroke: COL.ai, sw: Math.max(1.4, s * 0.28), lc: 'round' }],
});

export const GLOW: Art = {
  box: [10, 30, 200, 200],
  defs: [{ k: 'rad', id: 'glow', cx: 0.5, cy: 0.5, r: 0.5, stops: [[0, COL.glow, 0.42], [0.55, COL.glow, 0.16], [1, COL.glow, 0]] }],
  shapes: [{ k: 'ell', cx: 110, cy: 130, rx: 100, ry: 100, fill: 'url(#glow)' }],
};
export const SHADOW: Art = {
  box: [66, 220, 88, 16],
  defs: [{ k: 'rad', id: 'shadow', cx: 0.5, cy: 0.5, r: 0.5, stops: [[0, COL.shadow, 0.26], [0.6, COL.shadow, 0.12], [1, COL.shadow, 0]] }],
  shapes: [{ k: 'ell', cx: 110, cy: 228, rx: 44, ry: 8, fill: 'url(#shadow)' }],
};

/** crop windows (design units) */
export const CROPS = {
  full: [0, 14, 220, 226] as Box,
  bust: [16, 16, 188, 186] as Box,
  head: [32, 20, 150, 140] as Box,
};
