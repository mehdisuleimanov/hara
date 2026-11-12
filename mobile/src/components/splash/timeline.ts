// "hara" intro timeline — one source of truth for the app splash (Reanimated worklets)
// and the social video renderer (scripts/render-logo-motion.mjs, run by Node with type stripping).
// Keep this file dependency-free: no imports, erasable TypeScript only.
//
// Story: the "?" dot drops ("you are here"), the route draws out of it around the word,
// the arrow snaps and nudges forward, the letters hop in, then the 3D depth pops.
// All units are logo viewBox units (see logoLayers.ts) and milliseconds.

export const T = {
  dotStart: 250,
  dotLand: 700,
  dotSettle: 1050,
  routeStart: 650,
  routeEnd: 1900,
  lettersStart: 1150,
  letterStagger: 90,
  letterDur: 560,
  arrowStart: 1830,
  arrowEnd: 2180,
  nudgeStart: 2250,
  nudgeEnd: 2650,
  depthStart: 2100,
  depthEnd: 2550,
  shineStart: 2450,
  shineEnd: 3150,
  /** The logo is complete and still from here on. */
  end: 3250,
};

export function clamp01(x: number): number {
  'worklet';
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function prog(t: number, a: number, b: number): number {
  'worklet';
  return clamp01((t - a) / (b - a));
}

export function easeOutCubic(x: number): number {
  'worklet';
  const u = 1 - x;
  return 1 - u * u * u;
}

export function easeInOutCubic(x: number): number {
  'worklet';
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function easeInQuad(x: number): number {
  'worklet';
  return x * x;
}

/** Overshoots past 1 then settles (s = overshoot amount). */
export function easeOutBack(x: number, s: number): number {
  'worklet';
  const u = x - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
}

export type DotFrame = { ty: number; sx: number; sy: number; opacity: number };

/** Dot falls from above, squashes on landing, hops once and settles. Origin: dot bottom-centre. */
export function dotFrame(t: number): DotFrame {
  'worklet';
  if (t < T.dotStart) return { ty: -340, sx: 1, sy: 1, opacity: 0 };
  if (t < T.dotLand) {
    const p = prog(t, T.dotStart, T.dotLand);
    // falling: slightly stretched vertically
    return { ty: -340 * (1 - easeInQuad(p)), sx: 0.92, sy: 1.1, opacity: clamp01(p * 4) };
  }
  const p = prog(t, T.dotLand, T.dotSettle);
  const hop = p < 0.55 ? -46 * Math.sin((Math.PI * p) / 0.55) : 0;
  const squash = 0.3 * Math.exp(-5.5 * p) * Math.cos(11 * p);
  return { ty: hop, sx: 1 + squash * 0.85, sy: 1 - squash, opacity: 1 };
}

/** 0 → hidden, 1 → fully drawn. */
export function routeDraw(t: number): number {
  'worklet';
  return easeInOutCubic(prog(t, T.routeStart, T.routeEnd));
}

export type HeadFrame = { x: number; y: number; opacity: number };

/** Glowing "you" marker riding the front of the route while it draws. pts = ROUTE_PTS. */
export function routeHead(t: number, pts: [number, number][]): HeadFrame {
  'worklet';
  const u = routeDraw(t);
  const opacity = u > 0 && u < 1 ? Math.min(1, u * 12, (1 - u) * 7) : 0;
  const f = u * (pts.length - 1);
  const i = Math.min(pts.length - 2, Math.floor(f));
  const k = f - i;
  return {
    x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k,
    y: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k,
    opacity,
  };
}

export type ArrowFrame = { scale: number; opacity: number };

/**
 * Arrowhead snaps in with overshoot, then gives one "go" push. Scaled about the arrow neck
 * (ARROW_ORIGIN), so the push reads as a forward lunge without opening a seam at the neck.
 */
export function arrowFrame(t: number): ArrowFrame {
  'worklet';
  const p = prog(t, T.arrowStart, T.arrowEnd);
  if (p <= 0) return { scale: 0, opacity: 0 };
  const n = prog(t, T.nudgeStart, T.nudgeEnd);
  const push = n > 0 && n < 1 ? 0.14 * Math.sin(Math.PI * n) * (1 - 0.35 * n) : 0;
  return { scale: Math.max(0, easeOutBack(p, 2.4)) * (1 + push), opacity: 1 };
}

export type LetterFrame = { ty: number; scale: number; opacity: number };

/** Letter i (0..3) hops up from below. Origin: letter bottom-centre. */
export function letterFrame(t: number, i: number): LetterFrame {
  'worklet';
  const a = T.lettersStart + i * T.letterStagger;
  const p = prog(t, a, a + T.letterDur);
  if (p <= 0) return { ty: 70, scale: 0.55, opacity: 0 };
  const b = easeOutBack(p, 1.9);
  return { ty: 70 * (1 - b), scale: 0.55 + 0.45 * b, opacity: clamp01(p / 0.22) };
}

export type DepthFrame = { dx: number; dy: number; opacity: number };

/** 3D extrusion slides out from under the faces. */
export function depthFrame(t: number): DepthFrame {
  'worklet';
  const e = easeOutCubic(prog(t, T.depthStart, T.depthEnd));
  return { dx: -5 * (1 - e), dy: -12 * (1 - e), opacity: e * e };
}

export type ShineFrame = { x: number; opacity: number };

/** A soft diagonal light band sweeps once across the finished logo. */
export function shineFrame(t: number): ShineFrame {
  'worklet';
  const p = prog(t, T.shineStart, T.shineEnd);
  return { x: -260 + 1700 * easeInOutCubic(p), opacity: p > 0 && p < 1 ? Math.sin(Math.PI * p) : 0 };
}
