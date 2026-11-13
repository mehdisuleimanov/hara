/**
 * Əhməd's pose solver — pure worklets that run every frame on the UI thread.
 * Key poses (pose.ts) are flattened into numeric vectors, blended with springy
 * weights, then procedural layers (loops, lip-sync, blink, glance, touch, tap,
 * landing impact) are added. Output = two flat arrays read by the views.
 */
import { FACE_X, EYE_L, HAND_KINDS } from './art';
import { KEY_POSES, type PoseP } from './pose';

export const POSES = ['idle', 'wave', 'talk', 'listen', 'think', 'walk', 'celebrate', 'alert', 'point', 'confused', 'scan', 'stop', 'sleepy'] as const;
export type AhmedPose = (typeof POSES)[number];
export const poseIndex = (p: AhmedPose) => Math.max(0, POSES.indexOf(p));

// ── parameter vector layout ──
const ROOT_Y = 0, ROOT_R = 1, ROOT_SX = 2, ROOT_SY = 3;
const BODY_Y = 4, BODY_R = 5, BODY_SX = 6, BODY_SY = 7;
const LOOK_X = 8, LOOK_Y = 9, LID_L = 10, LID_R = 11, EYE_S = 12, HAPPY = 13;
const BLY = 14, BLR = 15, BRY = 16, BRR = 17;
const SMILE = 18, OPEN = 19, WIDE = 20, MO = 21, FLAT = 22, WOB = 23;
const CAP_X = 24, CAP_Y = 25, CAP_R = 26;
const AL = 27; // sh, el, wr, dx, dy, hs
const AR = 33;
const LL = 39; // rot, lift, x
const LR = 42;
const DOTS = 45, ZZZ = 46, HL = 47, HR = 51, FRONT_R = 55, MAG = 56, TORCH = 57;
const N = 58;

function toVec(p: PoseP): number[] {
  const v = new Array(N).fill(0);
  v[ROOT_Y] = p.root.y; v[ROOT_R] = p.root.rot; v[ROOT_SX] = p.root.sx; v[ROOT_SY] = p.root.sy;
  v[BODY_Y] = p.body.y; v[BODY_R] = p.body.rot; v[BODY_SX] = p.body.sx; v[BODY_SY] = p.body.sy;
  v[LOOK_X] = p.look[0]; v[LOOK_Y] = p.look[1]; v[LID_L] = p.lid[0]; v[LID_R] = p.lid[1];
  v[EYE_S] = p.eyeScale; v[HAPPY] = p.happy;
  v[BLY] = p.brow.ly; v[BLR] = p.brow.lr; v[BRY] = p.brow.ry; v[BRR] = p.brow.rr;
  v[SMILE] = p.mouth.smile; v[OPEN] = p.mouth.open; v[WIDE] = p.mouth.wide; v[MO] = p.mouth.o; v[FLAT] = p.mouth.flat; v[WOB] = p.mouth.wobble;
  v[CAP_X] = p.cap.x; v[CAP_Y] = p.cap.y; v[CAP_R] = p.cap.rot;
  const arm = (o: number, a: PoseP['armL'], h: number) => {
    v[o] = a.sh; v[o + 1] = a.el; v[o + 2] = a.wr; v[o + 3] = a.dx ?? 0; v[o + 4] = a.dy ?? 0; v[o + 5] = a.hs ?? 1;
    v[h + Math.max(0, HAND_KINDS.indexOf(a.hand))] = 1;
  };
  arm(AL, p.armL, HL);
  arm(AR, p.armR, HR);
  v[LL] = p.legL.rot; v[LL + 1] = p.legL.lift; v[LL + 2] = p.legL.x;
  v[LR] = p.legR.rot; v[LR + 1] = p.legR.lift; v[LR + 2] = p.legR.x;
  v[DOTS] = p.dots; v[ZZZ] = p.zzz; v[FRONT_R] = p.armR.front ? 1 : 0;
  v[MAG] = p.prop === 'magnifier' ? 1 : 0; v[TORCH] = p.prop === 'flashlight' ? 1 : 0;
  return v;
}

const LID_OPEN = -(EYE_L.ry + 5);
const LID_SHUT = EYE_L.ry * 0.52;
const BASE: number[][] = POSES.map((n) => toVec(KEY_POSES[n] ?? KEY_POSES.idle));
// right-arm holds for accessories (magnifier / flashlight)
const HOLD_MAG = [80, 58, 0, 0, 0, 1];
const HOLD_TORCH = [46, -8, -4, 0, 0, 1];
// poses that may hold an accessory in the right hand
const CAN_HOLD = [1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1];

// ── output layout (read by views) ──
// G1: motion (every frame)
export const O = {
  rootY: 0, rootR: 1, rootSX: 2, rootSY: 3, bodyY: 4, bodyR: 5, bodySX: 6, bodySY: 7,
  faceX: 8, faceY: 9, pupX: 10, pupY: 11, lidL: 12, lidR: 13, eyeS: 14,
  bly: 15, blr: 16, bry: 17, brr: 18, open: 19, wide: 20, o: 21, capX: 22, capY: 23, capR: 24,
  al: 25, ar: 31, ll: 37, lr: 40, dots: 43, zzz: 44, glint: 45, shadow: 46, t: 47, glow: 48,
  N: 49,
} as const;
// G2: discrete-ish state (only written when it changes)
export const Q = { happy: 0, smile: 1, flat: 2, wob: 3, hl: 4, hr: 8, front: 12, mag: 13, torch: 14, capShadow: 15, N: 16 } as const;

export type RigInput = {
  pose: number;
  prop: number; // 0 none, 1 magnifier, 2 flashlight
  facing: number;
  pointAngle: number;
  speaking: number;
  hasLevel: number;
  lite: number;
  touch: number;
  tx: number; // finger, design units
  ty: number;
  tapSeq: number; // increments on every tap
  impactSeq: number; // increments on every landing (drop-in)
  walkPhase: number; // -1 = time based
};

export type RigState = {
  t: number;
  w: number[];
  wv: number[];
  start: number[];
  lastPose: number;
  env: number;
  envSlow: number;
  syl: number;
  sylDur: number;
  sylAmp: number;
  gap: number;
  blinkIn: number;
  blinkT: number;
  dbl: number;
  glanceIn: number;
  glanceHold: number;
  gx: number;
  gy: number;
  gxs: number;
  gys: number;
  touchW: number;
  lookTX: number;
  lookTY: number;
  hold: number;
  holdV: number;
  facing: number;
  facingV: number;
  g2: number[];
  tapSeq: number;
  tapAt: number;
  impactSeq: number;
  impactAt: number;
};

export function initState(pose: number, facing: number): RigState {
  const w = new Array(POSES.length).fill(0);
  w[pose] = 1;
  return {
    t: 0, w, wv: new Array(POSES.length).fill(0), start: new Array(POSES.length).fill(0), lastPose: pose,
    env: 0, envSlow: 0, syl: 0, sylDur: 0.15, sylAmp: 0, gap: 0,
    blinkIn: 1.5 + Math.random() * 2, blinkT: -1, dbl: 0,
    glanceIn: 3, glanceHold: 0, gx: 0, gy: 0, gxs: 0, gys: 0,
    touchW: 0, lookTX: 0, lookTY: 0, hold: 0, holdV: 0, facing, facingV: 0,
    g2: new Array(Q.N).fill(-1),
    tapSeq: 0,
    tapAt: -1,
    impactSeq: 0,
    impactAt: -1,
  };
}

function clamp(x: number, a: number, b: number) {
  'worklet';
  return x < a ? a : x > b ? b : x;
}
function sstep(a: number, b: number, x: number) {
  'worklet';
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** per-pose loop layer, applied on top of the pose's base vector `v` (in place) */
function animatePose(i: number, v: number[], tau: number, t: number, inp: RigInput) {
  'worklet';
  const S = Math.sin;
  const TAU = Math.PI * 2;
  switch (i) {
    case 0: // idle
      v[BODY_R] += 1.2 * S(t * 0.8);
      break;
    case 1: {
      // wave: 3 waves, short rest
      const wp = tau % 1.75;
      const env = wp < 1.05 ? Math.pow(S((Math.PI * wp) / 1.05), 0.5) : 0;
      const osc = S((TAU * wp) / 0.35);
      v[AR + 1] += 20 * osc * env;
      v[AR + 2] += 16 * S((TAU * wp) / 0.35 - 0.9) * env;
      v[BODY_R] += 1.3 * osc * env;
      v[BLY] -= 0.8 * env;
      v[BRY] -= 0.8 * env;
      break;
    }
    case 2: // talk: gesture arm + bob (mouth handled by the speech layer)
      v[AL] += 8 * S(t * 1.6);
      v[AL + 1] += 12 * S(t * 1.6 + 0.7);
      v[AL + 2] += 10 * S(t * 2.1);
      break;
    case 3: // listen
      v[BODY_Y] += 0.8 * S(t * 2.4);
      v[BODY_R] += 1 * S(t * 1.2);
      v[AR + 2] += 4 * S(t * 2);
      break;
    case 4: // think
      v[AR + 2] += 5 * S(t * 2.6);
      v[LOOK_X] += 0.1 * S(t * 0.8);
      v[BODY_R] += 1 * S(t * 1.1);
      break;
    case 5: {
      // walk cycle (~1.1 s)
      const ph = inp.walkPhase >= 0 ? inp.walkPhase * TAU : (t / 1.1) * TAU;
      const s = S(ph);
      const c = Math.cos(ph);
      v[LL] = -24 * s;
      v[LR] = 24 * s;
      v[LL + 1] = 5 * Math.pow(Math.max(0, c), 1.4);
      v[LR + 1] = 5 * Math.pow(Math.max(0, -c), 1.4);
      v[LL + 2] = 4;
      v[LR + 2] = -4;
      v[ROOT_Y] += 1.6 * s * s;
      v[BODY_Y] -= 1.4 * c * c;
      v[BODY_R] += 1.5 * s;
      // pendulum swing (same screen rotation for both arms reads best in 3/4 view)
      v[AL] = 16 + 18 * s;
      v[AR] = 16 - 18 * s;
      v[AL + 1] = -20;
      v[AR + 1] = -20;
      v[CAP_R] += 1.5 * S(ph * 2 + 0.6);
      break;
    }
    case 6: {
      // celebrate: crouch → jump (stretch) → squash landing, cap flies
      const u = (tau % 1.5) / 1.5;
      let y = 0;
      let sy = 1;
      let sx = 1;
      if (u < 0.16) {
        const k = sstep(0, 1, u / 0.16);
        sy = 1 - 0.1 * k;
        sx = 1 + 0.08 * k;
      } else if (u < 0.68) {
        const a = (u - 0.16) / 0.52;
        y = -36 * 4 * a * (1 - a);
        sy = 1 + 0.1 * (1 - 4 * a * (1 - a));
        sx = 1 / Math.sqrt(sy);
      } else {
        const b = (u - 0.68) / 0.32;
        const q = Math.exp(-b * 6) * Math.cos(b * 14);
        sy = 1 - 0.14 * q;
        sx = 1 + 0.12 * q;
      }
      const air = sstep(0.1, 0.22, u) * (1 - sstep(0.72, 0.9, u));
      v[ROOT_Y] = y;
      v[ROOT_SX] = sx;
      v[ROOT_SY] = sy;
      v[AL] = 10 + 122 * air;
      v[AR] = 10 + 122 * air;
      v[AL + 1] = -10 + 18 * air;
      v[AR + 1] = -10 + 18 * air;
      v[AL + 2] += 15 * S(tau * 18) * air;
      v[AR + 2] += 15 * S(tau * 18 + 1) * air;
      v[LL] = 16 * air;
      v[LR] = -16 * air;
      v[LL + 1] = 3 * air;
      v[LR + 1] = 3 * air;
      v[OPEN] = 0.7 + 0.3 * air;
      const cc = (u - 0.2) / 0.56;
      if (cc > 0 && cc < 1) {
        v[CAP_Y] = -20 * 4 * cc * (1 - cc);
        v[CAP_R] = -16 * S(Math.PI * cc);
        v[CAP_X] = -2 * S(Math.PI * cc);
      } else if (u >= 0.76) {
        const d = (u - 0.76) / 0.24;
        v[CAP_Y] = -2.5 * Math.exp(-d * 5) * Math.abs(S(d * 12));
        v[CAP_R] = 0;
        v[CAP_X] = 0;
      } else {
        v[CAP_Y] = 0;
        v[CAP_R] = 0;
        v[CAP_X] = 0;
      }
      break;
    }
    case 7: {
      // alert: startle hop + shake, darting eyes
      if (tau < 0.35) v[ROOT_Y] = -7 * S((Math.PI * tau) / 0.35);
      v[BODY_R] += 3.5 * S(tau * 42) * Math.exp(-tau * 5);
      const q = tau % 2.6;
      if (tau > 1) v[BODY_R] += 1.6 * S(q * 40) * Math.exp(-q * 7);
      v[EYE_S] += 0.02 * S(t * 7);
      v[LOOK_X] = 0.35 * S(Math.floor(t * 1.5) * 2.3);
      break;
    }
    case 8: {
      // point toward inp.pointAngle (0 = right, 90 = up)
      const a = (inp.pointAngle * Math.PI) / 180;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const p = Math.exp(-(tau % 1.6) / 0.12);
      if (ca >= -0.2) {
        v[AR] = clamp(inp.pointAngle + 90, 0, 178);
        v[AR + 5] = 1 + 0.08 * p;
        v[AR + 3] = 2 * p;
      } else {
        let sh = -inp.pointAngle - 90;
        while (sh > 180) sh -= 360;
        while (sh < -180) sh += 360;
        v[AL] = clamp(sh, 0, 178);
        v[AL + 1] = 0;
        v[AL + 2] = 0;
        v[AL + 5] = 1 + 0.08 * p;
        v[AL + 3] = 2 * p;
        v[HL] = 0;
        v[HL + 2] = 1;
        v[AR] = 27;
        v[AR + 1] = -36;
        v[AR + 2] = -8;
        v[HR + 2] = 0;
        v[HR] = 1;
      }
      v[LOOK_X] = 0.95 * ca;
      v[LOOK_Y] = -0.8 * sa;
      v[BODY_R] = 3 * ca;
      break;
    }
    case 9: {
      // confused: head tilt + periodic shrug
      const q = tau % 2.6;
      const p = q > 0.2 && q < 1.1 ? S((Math.PI * (q - 0.2)) / 0.9) : 0;
      v[AL + 4] -= 4 * p;
      v[AR + 4] -= 4 * p;
      v[AL] += 8 * p;
      v[AR] += 8 * p;
      v[AL + 1] += 10 * p;
      v[AR + 1] += 10 * p;
      v[BODY_R] += 2 * S(t * 1.2);
      v[BLY] -= 1 * p;
      break;
    }
    case 10: {
      // scan: magnifier sweeps, eyes follow, lens glints
      const s = S((TAU * tau) / 2.6);
      v[AR] = 80 + 20 * s;
      v[AR + 1] = 58 - 14 * s;
      v[LOOK_X] = 0.6 + 0.35 * s;
      v[LOOK_Y] = 0.05 - 0.35 * s;
      v[BODY_R] = 2 + 2 * s;
      break;
    }
    case 11: {
      // stop: palm push
      const q = tau % 2.2;
      v[AR + 5] += 0.22 * Math.exp(-tau * 7) * Math.cos(tau * 16) + 0.07 * Math.exp(-q * 8) * (tau > 1 ? 1 : 0);
      v[AR + 3] += 3 * Math.exp(-tau * 6);
      break;
    }
    case 12: {
      // sleepy: slow breath, droop, yawn every 7 s
      v[BODY_SY] += 0.02 * S((TAU * t) / 4.4);
      v[BODY_R] += 1.5 * S(t * 0.6);
      v[LID_L] += 0.08 * S(t * 0.9);
      v[LID_R] += 0.08 * S(t * 0.9);
      const y = tau % 7;
      const yb = y > 4.5 && y < 6.3 ? S((Math.PI * (y - 4.5)) / 1.8) : 0;
      v[MO] = 1.5 * yb;
      v[SMILE] *= 1 - yb;
      v[LID_L] += 0.3 * yb;
      v[LID_R] += 0.3 * yb;
      v[AL] += 25 * yb;
      v[AL + 1] += 40 * yb;
      v[BODY_SY] += 0.03 * yb;
      break;
    }
  }
}

/**
 * One solver step. Mutates `st`, returns [g1, g2Changed ? g2 : null].
 * `level` is the 0..1 audio level (ignored when inp.hasLevel = 0).
 */
export function step(st: RigState, inp: RigInput, nowS: number, dt: number, level: number): [number[], number[] | null] {
  'worklet';
  const S = Math.sin;
  const lite = inp.lite > 0;
  if (st.t <= 0.0001) for (let i = 0; i < st.start.length; i++) st.start[i] = nowS;
  st.t = nowS;
  const t = nowS;
  const P = POSES.length;
  if (inp.tapSeq !== st.tapSeq) {
    st.tapSeq = inp.tapSeq;
    st.tapAt = t;
  }
  if (inp.impactSeq !== st.impactSeq) {
    st.impactSeq = inp.impactSeq;
    st.impactAt = t;
  }
  // pose change → restart that pose's local clock
  if (inp.pose !== st.lastPose) {
    st.start[inp.pose] = t;
    st.lastPose = inp.pose;
  }
  // springy weights (critically damped, ω = 11)
  const om = 11;
  for (let i = 0; i < P; i++) {
    const target = i === inp.pose ? 1 : 0;
    const a = om * om * (target - st.w[i]) - 2 * om * st.wv[i];
    st.wv[i] += a * dt;
    st.w[i] += st.wv[i] * dt;
    if (st.w[i] < 0.0005 && target === 0 && Math.abs(st.wv[i]) < 0.001) {
      st.w[i] = 0;
      st.wv[i] = 0;
    }
  }
  // blend
  const v = new Array(N).fill(0);
  const tmp = new Array(N).fill(0);
  let wsum = 0;
  for (let i = 0; i < P; i++) {
    const w = st.w[i];
    if (w <= 0.0005) continue;
    const b = BASE[i];
    for (let k = 0; k < N; k++) tmp[k] = b[k];
    if (!lite) animatePose(i, tmp, t - st.start[i], t, inp);
    else if (i === 8) animatePose(i, tmp, 0, 0, inp); // point direction still applies
    else if (i === 6) {
      // lite celebrate: grounded, arms up, no jump/cap flight
      tmp[ROOT_Y] = 0; tmp[ROOT_SX] = 1; tmp[ROOT_SY] = 1; tmp[CAP_Y] = 0; tmp[CAP_R] = 0; tmp[CAP_X] = 0;
      tmp[LL] = 0; tmp[LR] = 0; tmp[LL + 1] = 0; tmp[LR + 1] = 0;
    }
    for (let k = 0; k < N; k++) v[k] += w * tmp[k];
    wsum += w;
  }
  if (wsum > 0) for (let k = 0; k < N; k++) v[k] /= wsum;
  const wTalk = st.w[2] / (wsum || 1);
  const wListen = st.w[3] / (wsum || 1);
  const wIdle = st.w[0] / (wsum || 1);

  // ── accessory hold (right hand) ──
  let canHold = 0;
  for (let i = 0; i < P; i++) canHold += CAN_HOLD[i] * st.w[i];
  canHold /= wsum || 1;
  const holdTarget = inp.prop > 0 ? canHold : 0;
  {
    const a = 120 * (holdTarget - st.hold) - 22 * st.holdV;
    st.holdV += a * dt;
    st.hold += st.holdV * dt;
  }
  const hold = clamp(st.hold, 0, 1.2);
  if (hold > 0.001) {
    const H = inp.prop === 2 ? HOLD_TORCH : HOLD_MAG;
    const hh = Math.min(1, hold);
    for (let k = 0; k < 6; k++) v[AR + k] = v[AR + k] * (1 - hh) + H[k] * hh;
    if (hh > 0.5) {
      v[HR] = 0; v[HR + 1] = 0; v[HR + 2] = 0; v[HR + 3] = 1;
    }
  }
  const mag = Math.max(v[MAG], inp.prop === 1 ? hold : 0);
  const torch = inp.prop === 2 ? hold : 0;

  // ── speech / level ──
  let lvl = 0;
  if (inp.hasLevel > 0) lvl = clamp(level, 0, 1);
  else if (inp.speaking > 0 || wTalk > 0.01) {
    // synthesized syllables with phrase pauses
    st.syl += dt;
    if (st.gap > 0) {
      st.gap -= dt;
      st.sylAmp = 0;
    } else if (st.syl >= st.sylDur) {
      st.syl = 0;
      st.sylDur = 0.1 + Math.random() * 0.12;
      st.sylAmp = 0.45 + Math.random() * 0.55;
      if (Math.random() < 0.1) st.gap = 0.15 + Math.random() * 0.3;
    }
    lvl = st.gap > 0 ? 0 : st.sylAmp * Math.pow(S((Math.PI * st.syl) / st.sylDur), 0.8);
  }
  const atk = lvl > st.env ? 1 - Math.exp(-dt / 0.03) : 1 - Math.exp(-dt / 0.07);
  st.env += (lvl - st.env) * atk;
  st.envSlow += (st.env - st.envSlow) * (1 - Math.exp(-dt / 0.4));
  const env = st.env;
  const speak = clamp(Math.max(wTalk, inp.speaking > 0 ? 1 : 0), 0, 1);
  if (speak > 0.001) {
    const open = 0.92 * Math.pow(env, 0.85);
    const shut = clamp(1 - env * 9, 0, 1);
    v[OPEN] = v[OPEN] * (1 - speak) + speak * open;
    v[WIDE] = v[WIDE] * (1 - speak) + speak * (0.86 + 0.22 * S(t * 9.1) * env + 0.08 * S(t * 4.3));
    v[SMILE] = v[SMILE] * (1 - speak) + speak * shut;
    v[FLAT] *= 1 - speak;
    v[WOB] *= 1 - speak;
    const peak = Math.max(0, env - st.envSlow);
    v[BLY] -= speak * (3.2 * peak + 0.6 * env);
    v[BRY] -= speak * (3.6 * peak + 0.6 * env);
  }
  if (!lite) {
    v[BODY_R] += wTalk * (1.2 * S(t * 2.1) + 1.8 * env * S(t * 5.3));
    v[BODY_Y] -= wTalk * 1.4 * env;
  }
  if (wListen > 0.001) {
    v[EYE_S] += wListen * 0.14 * env;
    v[BLY] -= wListen * 2.2 * env;
    v[BRY] -= wListen * 2.2 * env;
  }

  // ── breathing + micro sway (always, gentle) ──
  const br = S((Math.PI * 2 * t) / 3.4);
  v[BODY_SY] *= 1 + 0.013 * br;
  v[BODY_SX] *= 1 - 0.008 * br;
  if (!lite) {
    v[AL] += 1.3 * S(t * 1.7);
    v[AR] += 1.3 * S(t * 1.7 + 1.1);
    v[CAP_R] += wIdle * 0.9 * S(t * 1.3);
  }

  // ── blink (random 3–6 s, sometimes double) ──
  st.blinkIn -= dt;
  if (st.blinkIn <= 0 && st.blinkT < 0) {
    st.blinkT = 0;
    st.dbl = Math.random() < 0.2 ? 1 : 0;
    st.blinkIn = 3 + Math.random() * 3;
  }
  let blink = 0;
  if (st.blinkT >= 0) {
    st.blinkT += dt;
    const bt = st.blinkT;
    blink = bt < 0.06 ? bt / 0.06 : bt < 0.16 ? 1 - (bt - 0.06) / 0.1 : 0;
    if (bt >= 0.16) {
      if (st.dbl > 0) {
        st.dbl = 0;
        st.blinkT = -0.05; // tiny gap then blink again
      } else st.blinkT = -1;
    }
  } else if (st.blinkT > -1 && st.blinkT < 0) {
    st.blinkT += dt;
    if (st.blinkT >= 0) st.blinkT = 0;
  }

  // ── idle glance ──
  if (!lite) {
    st.glanceIn -= dt;
    if (st.glanceHold > 0) {
      st.glanceHold -= dt;
      if (st.glanceHold <= 0) {
        st.gx = 0;
        st.gy = 0;
      }
    } else if (st.glanceIn <= 0) {
      st.gx = (Math.random() * 2 - 1) * 0.75;
      st.gy = (Math.random() * 2 - 1) * 0.35 - 0.05;
      st.glanceHold = 0.6 + Math.random() * 0.9;
      st.glanceIn = 3.5 + Math.random() * 4;
    }
  }
  const sac = 1 - Math.exp(-dt / 0.05);
  st.gxs += (st.gx - st.gxs) * sac;
  st.gys += (st.gy - st.gys) * sac;
  const gw = wIdle + wTalk * 0.4;
  v[LOOK_X] += st.gxs * gw;
  v[LOOK_Y] += st.gys * gw;

  // ── touch: pupils follow the finger ──
  {
    const tgt = inp.touch > 0 ? 1 : 0;
    st.touchW += (tgt - st.touchW) * (1 - Math.exp(-dt / 0.08));
    if (inp.touch > 0) {
      const dx = (inp.tx - 110 - FACE_X) / 60;
      const dy = (inp.ty - 106) / 60;
      const m = Math.sqrt(dx * dx + dy * dy);
      const k = m > 1 ? 1 / m : 1;
      st.lookTX = dx * k * inp.facing;
      st.lookTY = dy * k;
    }
    v[LOOK_X] = v[LOOK_X] * (1 - st.touchW) + st.lookTX * st.touchW;
    v[LOOK_Y] = v[LOOK_Y] * (1 - st.touchW) + st.lookTY * st.touchW;
  }

  // ── tap giggle ──
  if (st.tapAt >= 0) {
    const g = t - st.tapAt;
    if (g >= 0 && g < 1.1) {
      const d = Math.exp(-g * 5);
      v[ROOT_SY] *= 1 - 0.09 * d * Math.cos(g * 22);
      v[ROOT_SX] *= 1 + 0.07 * d * Math.cos(g * 22);
      v[BODY_R] += 5 * d * S(g * 26);
      v[ROOT_Y] -= 6 * Math.max(0, S(Math.min(1, g / 0.3) * Math.PI));
      if (g < 0.7) v[HAPPY] = 1;
      if (g < 0.7) {
        v[OPEN] = Math.max(v[OPEN], 0.75);
        v[SMILE] = 0;
      }
      v[CAP_Y] -= 4 * Math.max(0, S(Math.min(1, g / 0.35) * Math.PI));
    }
  }
  // ── landing impact (drop-in) ──
  if (st.impactAt >= 0) {
    const g = t - st.impactAt;
    if (g >= 0 && g < 1.2) {
      const q = Math.exp(-g * 6) * Math.cos(g * 18);
      v[ROOT_SY] *= 1 - 0.2 * q;
      v[ROOT_SX] *= 1 + 0.16 * q;
      const c = clamp(g / 0.55, 0, 1);
      v[CAP_Y] -= 16 * 4 * c * (1 - c);
      v[CAP_R] += -18 * S(Math.PI * c);
      if (g > 0.08 && g < 0.5) v[HAPPY] = 1;
    }
  }

  // ── facing (springy turn through 0) ──
  {
    const a = 260 * (inp.facing - st.facing) - 30 * st.facingV;
    st.facingV += a * dt;
    st.facing += st.facingV * dt;
  }
  let fs = st.facing;
  if (Math.abs(fs) < 0.02) fs = fs < 0 ? -0.02 : 0.02;

  // ── outputs ──
  const g1 = new Array(O.N).fill(0);
  g1[O.rootY] = v[ROOT_Y];
  g1[O.rootR] = v[ROOT_R];
  g1[O.rootSX] = v[ROOT_SX] * fs;
  g1[O.rootSY] = v[ROOT_SY];
  g1[O.bodyY] = v[BODY_Y];
  g1[O.bodyR] = v[BODY_R];
  g1[O.bodySX] = v[BODY_SX];
  g1[O.bodySY] = v[BODY_SY];
  const lx = clamp(v[LOOK_X], -1.1, 1.1);
  const ly = clamp(v[LOOK_Y], -1.1, 1.1);
  g1[O.faceX] = FACE_X + lx * 4.5;
  g1[O.faceY] = ly * 2.6;
  g1[O.pupX] = lx * 3.2;
  g1[O.pupY] = ly * 3.4;
  g1[O.lidL] = LID_OPEN + (LID_SHUT - LID_OPEN) * clamp(Math.max(v[LID_L], blink), 0, 1);
  g1[O.lidR] = LID_OPEN + (LID_SHUT - LID_OPEN) * clamp(Math.max(v[LID_R], blink), 0, 1);
  g1[O.eyeS] = v[EYE_S];
  g1[O.bly] = v[BLY];
  g1[O.blr] = v[BLR];
  g1[O.bry] = v[BRY];
  g1[O.brr] = v[BRR];
  g1[O.open] = Math.max(0, v[OPEN]);
  g1[O.wide] = v[WIDE];
  g1[O.o] = Math.max(0, v[MO]);
  g1[O.capX] = v[CAP_X] + lx * 1.2;
  g1[O.capY] = v[CAP_Y];
  g1[O.capR] = v[CAP_R];
  for (let k = 0; k < 6; k++) {
    g1[O.al + k] = v[AL + k];
    g1[O.ar + k] = v[AR + k];
  }
  for (let k = 0; k < 3; k++) {
    g1[O.ll + k] = v[LL + k];
    g1[O.lr + k] = v[LR + k];
  }
  g1[O.dots] = clamp(v[DOTS], 0, 1);
  g1[O.zzz] = clamp(v[ZZZ], 0, 1);
  g1[O.glint] = lite ? 0.6 : Math.pow(Math.max(0, S((Math.PI * 2 * t) / 1.3)), 10);
  g1[O.shadow] = clamp(1 + v[ROOT_Y] / 70, 0.45, 1);
  g1[O.t] = lite ? 0 : t;
  g1[O.glow] = 0.85 + 0.15 * br + 0.3 * env * speak;

  // discrete state
  const g2 = new Array(Q.N).fill(0);
  g2[Q.happy] = v[HAPPY] > 0.5 ? 1 : 0;
  g2[Q.smile] = Math.round(clamp(v[SMILE], 0, 1) * 50) / 50;
  g2[Q.flat] = Math.round(clamp(v[FLAT], 0, 1) * 50) / 50;
  g2[Q.wob] = Math.round(clamp(v[WOB], 0, 1) * 50) / 50;
  let bl = 0;
  let br2 = 0;
  for (let k = 1; k < 4; k++) {
    if (v[HL + k] > v[HL + bl]) bl = k;
    if (v[HR + k] > v[HR + br2]) br2 = k;
  }
  g2[Q.hl + bl] = 1;
  g2[Q.hr + br2] = 1;
  g2[Q.front] = v[FRONT_R] > 0.5 ? 1 : 0;
  g2[Q.mag] = Math.round(clamp(mag, 0, 1.2) * 60) / 60;
  g2[Q.torch] = Math.round(clamp(torch, 0, 1.2) * 60) / 60;
  g2[Q.capShadow] = Math.round(clamp(1 + v[CAP_Y] / 5, 0, 1) * 30) / 30;
  let changed = false;
  for (let k = 0; k < Q.N; k++) {
    if (g2[k] !== st.g2[k]) {
      changed = true;
      st.g2[k] = g2[k];
    }
  }
  return [g1, changed ? g2 : null];
}
