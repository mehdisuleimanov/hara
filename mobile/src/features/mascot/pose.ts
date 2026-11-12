/**
 * Static key poses + joint maths (plain data, no React). The animated rig blends these
 * and layers loops on top; the Node preview renders them directly.
 */
import {
  BODY_PIVOT,
  BROW_L_C,
  BROW_R_C,
  CAP_PIVOT,
  CX,
  FACE_X,
  GROUND,
  HIP_L,
  HIP_R,
  SHOULDER_L,
  SHOULDER_R,
  elbowOf,
  wristOf,
  type HandKind,
} from './art';

/** sh/el/wr: outward rotation (deg) at shoulder/elbow/wrist; dx/dy: shoulder reach; hs: hand scale */
export type ArmP = { sh: number; el: number; wr: number; hand: HandKind; front?: boolean; dx?: number; dy?: number; hs?: number };
export type LegP = { rot: number; lift: number; x: number };
export type PoseP = {
  root: { y: number; rot: number; sx: number; sy: number };
  body: { y: number; rot: number; sx: number; sy: number };
  look: [number, number];
  lid: [number, number];
  eyeScale: number;
  happy: number;
  brow: { ly: number; lr: number; ry: number; rr: number };
  mouth: { smile: number; open: number; wide: number; o: number; flat: number; wobble: number };
  cap: { x: number; y: number; rot: number };
  armL: ArmP;
  armR: ArmP;
  legL: LegP;
  legR: LegP;
  prop: 'none' | 'magnifier' | 'flashlight';
  dots: number;
  zzz: number;
};

const relaxed = (): ArmP => ({ sh: 27, el: -36, wr: -8, hand: 'mitten' });

export function basePose(): PoseP {
  return {
    root: { y: 0, rot: 0, sx: 1, sy: 1 },
    body: { y: 0, rot: -2, sx: 1, sy: 1 },
    look: [0.1, 0.05],
    lid: [0, 0],
    eyeScale: 1,
    happy: 0,
    brow: { ly: 0, lr: 0, ry: 0, rr: 0 },
    mouth: { smile: 1, open: 0, wide: 1, o: 0, flat: 0, wobble: 0 },
    cap: { x: 0, y: 0, rot: 0 },
    armL: relaxed(),
    armR: relaxed(),
    legL: { rot: 0, lift: 0, x: 0 },
    legR: { rot: 0, lift: 0, x: 0 },
    prop: 'none',
    dots: 0,
    zzz: 0,
  };
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K] };
function make(p: DeepPartial<PoseP>): PoseP {
  const b = basePose();
  for (const k of Object.keys(p) as (keyof PoseP)[]) {
    const v = p[k] as unknown;
    if (v && typeof v === 'object' && !Array.isArray(v)) (b as Record<string, unknown>)[k] = { ...(b[k] as object), ...(v as object) };
    else (b as Record<string, unknown>)[k] = v;
  }
  return b;
}

/** Key frames for the preview sheet (and the rig's base poses). */
export const KEY_POSES: Record<string, PoseP> = {
  idle: make({}),
  wave: make({
    body: { rot: -4 },
    look: [0.25, -0.05],
    brow: { ly: -1.5, ry: -1.5 },
    armR: { sh: 142, el: -26, wr: -8, hand: 'open' },
  }),
  talk: make({
    body: { rot: 1 },
    brow: { ly: -2, ry: -2.6, rr: -4 },
    mouth: { smile: 0, open: 0.82, wide: 0.92 },
    armL: { sh: 50, el: 58, wr: -24, hand: 'open' },
  }),
  think: make({
    body: { rot: 3 },
    look: [0.75, -0.85],
    brow: { ly: 0.5, lr: 6, ry: -3.2, rr: -6 },
    mouth: { smile: 0, flat: 0, wobble: 1 },
    armR: { sh: 8, el: -140, wr: -24, hand: 'grip', front: true },
    dots: 1,
  }),
  celebrate: make({
    root: { y: -30, sx: 0.95, sy: 1.06 },
    happy: 1,
    brow: { ly: -3, ry: -3 },
    mouth: { smile: 0, open: 1, wide: 1.15 },
    cap: { y: -15, x: -2, rot: -14 },
    armL: { sh: 132, el: 8, wr: -6, hand: 'open' },
    armR: { sh: 132, el: 8, wr: -6, hand: 'open' },
    legL: { rot: 16, lift: 3, x: -1 },
    legR: { rot: -16, lift: 3, x: 1 },
  }),
  stop: make({
    body: { rot: 0 },
    look: [0.05, 0],
    brow: { ly: 1.6, lr: 12, ry: 1.6, rr: -12 },
    mouth: { smile: 0, flat: 1 },
    armR: { sh: 98, el: 82, wr: 2, dx: 8, dy: -3, hs: 1.16, hand: 'open' },
    legL: { rot: 6, x: -3 },
    legR: { rot: -6, x: 3 },
  }),
  scan: make({
    body: { rot: 3 },
    look: [0.9, 0.2],
    brow: { ly: -1, ry: 0.8, rr: -8 },
    mouth: { smile: 0, o: 0.85 },
    armR: { sh: 80, el: 58, wr: 0, hand: 'grip' },
    prop: 'magnifier',
  }),
  night: make({
    body: { rot: 1 },
    look: [0.6, 0.35],
    armR: { sh: 46, el: -8, wr: -4, hand: 'grip' },
    prop: 'flashlight',
  }),
  alert: make({
    eyeScale: 1.14,
    look: [0, 0],
    brow: { ly: -4, ry: -4, lr: -4, rr: 4 },
    mouth: { smile: 0, o: 1.3 },
    armL: { sh: 52, el: 70, wr: 0, hand: 'open' },
    armR: { sh: 52, el: 70, wr: 0, hand: 'open' },
  }),
  sleepy: make({
    body: { rot: 3, sy: 0.985 },
    look: [0, 0.4],
    lid: [0.62, 0.62],
    brow: { ly: 1.5, ry: 1.5, lr: -6, rr: 6 },
    mouth: { smile: 0.85 },
    zzz: 1,
  }),
  confused: make({
    body: { rot: -7 },
    look: [-0.3, -0.3],
    brow: { ly: -3.8, lr: -8, ry: 1.2, rr: -4 },
    mouth: { smile: 0, wobble: 1 },
    armL: { sh: 36, el: 74, wr: 26, hand: 'open' },
    armR: { sh: 36, el: 74, wr: 26, hand: 'open' },
  }),
  point: make({
    look: [1, -0.1],
    armR: { sh: 92, el: 0, wr: 0, hand: 'point' },
    body: { rot: 2 },
  }),
};

// ───────────────────────── joints ─────────────────────────
export type Xf = { tx: number; ty: number; r: number; sx: number; sy: number; px: number; py: number };
const xf = (px: number, py: number, o: Partial<Xf> = {}): Xf => ({ tx: 0, ty: 0, r: 0, sx: 1, sy: 1, px, py, ...o });

/** joint transforms for a (static) pose; `facing` -1 mirrors the character */
export function joints(p: PoseP, facing = 1) {
  const armJ = (s: 'L' | 'R', a: ArmP) => {
    const m = s === 'L' ? 1 : -1;
    const S = s === 'L' ? SHOULDER_L : SHOULDER_R;
    const E = elbowOf(s);
    const W = wristOf(s);
    return {
      sh: xf(S.x, S.y, { r: m * a.sh, tx: -m * (a.dx ?? 0), ty: a.dy ?? 0 }),
      el: xf(E.x, E.y, { r: m * a.el }),
      wr: xf(W.x, W.y, { r: m * a.wr, sx: a.hs ?? 1, sy: a.hs ?? 1 }),
    };
  };
  return {
    root: xf(CX, GROUND, { ty: p.root.y, r: p.root.rot, sx: p.root.sx * facing, sy: p.root.sy }),
    body: xf(BODY_PIVOT.x, BODY_PIVOT.y, { ty: p.body.y, r: p.body.rot, sx: p.body.sx, sy: p.body.sy }),
    face: xf(CX, 110, { tx: FACE_X + p.look[0] * 4.5, ty: p.look[1] * 2.6 }),
    pupil: { x: p.look[0] * 3.2, y: p.look[1] * 3.4 },
    browL: xf(BROW_L_C.x, BROW_L_C.y, { ty: p.brow.ly, r: p.brow.lr }),
    browR: xf(BROW_R_C.x, BROW_R_C.y, { ty: p.brow.ry, r: p.brow.rr }),
    cap: xf(CAP_PIVOT.x, CAP_PIVOT.y, { tx: p.cap.x + p.look[0] * 1.2, ty: p.cap.y, r: p.cap.rot }),
    armL: armJ('L', p.armL),
    armR: armJ('R', p.armR),
    legL: xf(HIP_L.x, HIP_L.y, { tx: p.legL.x, ty: -p.legL.lift, r: p.legL.rot }),
    legR: xf(HIP_R.x, HIP_R.y, { tx: p.legR.x, ty: -p.legR.lift, r: p.legR.rot }),
  };
}
