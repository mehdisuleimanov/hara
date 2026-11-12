/**
 * Route-level pedestrian safety score (weakest-link), shared by the build scripts
 * (scripts/build-routes.mjs imports this file directly via Node's type stripping) and
 * on-device live routing (live.ts). Pure TypeScript: no React Native imports, erasable
 * syntax only (no enums / namespaces / parameter properties).
 *
 * Per-crossing and per-segment scores come from the safety layer (scripts/build-safety-layer.mjs
 * documents that iRAP-inspired attribute model). Here we only aggregate along a walk:
 *
 *   crossed  = layer crossings within 12 m of the walk (20 m for grade-separated) whose road axis
 *              is at ≥35° to the walking direction — walking ALONG a road past its crossings
 *              does not count; crossings without a known axis count (conservative)
 *   S        = length-weighted mean segment score of the streets walked
 *              (stretches matching no mapped road: footpath prior 84 day / 66 night)
 *   W        = weakest link = min(crossed crossing scores, any walked segment < 55 for ≥40 m)
 *   score    = W ? 0.6·W + 0.4·S : S
 *              − 3 per additional high-risk (<55) crossing, max −12
 *   no walk  = 92 day / 90 night (metro stations are lit and staffed)
 * Clamped to [5, 97]. Day and night are computed independently from the layer's d/n values.
 *
 * Option-level caps (capByModes): the walk score says nothing about time spent in road traffic,
 * so trips with a road-vehicle leg are capped — taxi 78 day / 70 night (car-occupant road risk,
 * kerbside boarding), bus 86 / 74 (waiting at stops). Metro adds no cap.
 */
import type { CrossingT, SegmentT } from '../../data/layer';

export type LayerData = { crossings: CrossingT[]; segments: SegmentT[] };

export type WalkScore = {
  day: number;
  night: number;
  /** indices into layer.crossings that the walk actually crosses, in walking order */
  crossed: number[];
  signals: number;
  /** zebra + unmarked crossings */
  unsignalized: number;
  /** crossings scoring < 55 (day / night) */
  riskyDay: number;
  riskyNight: number;
  /** weakest crossing (index into layer.crossings), night-time */
  weakest: number;
  walkM: number;
};

export const SCORE_MODEL = {
  crossR: 12,
  gradeR: 20,
  minAngle: 35,
  footpath: { day: 84, night: 66 },
  noWalk: { day: 92, night: 90 },
  wWeak: 0.6,
  wMean: 0.4,
  riskyBelow: 55,
  repeatPenalty: 3,
  repeatCap: 12,
};

export const MODE_CAP: Record<string, { day: number; night: number }> = {
  taxi: { day: 78, night: 70 },
  bus: { day: 86, night: 74 },
};

/** Apply road-vehicle caps for the modes used by an option; keeps night ≤ day. */
export function capByModes<T extends { day: number; night: number }>(s: T, modes: string[]): T {
  let day = s.day, night = s.night;
  for (const m of modes) {
    const c = MODE_CAP[m];
    if (!c) continue;
    day = Math.min(day, c.day);
    night = Math.min(night, c.night);
  }
  return { ...s, day, night: Math.min(night, day) };
}

const toRad = (d: number) => (d * Math.PI) / 180;
const M_LAT = 110540;
const M_LON = 111320;

type Edge = { s: number; aLat: number; aLon: number; bLat: number; bLon: number };
type Index = { cross: Map<string, number[]>; edges: Map<string, Edge[]> };
const CC = 0.001;
const EC = 0.002;
const cache = new WeakMap<object, Index>();

function indexOf(layer: LayerData): Index {
  let ix = cache.get(layer.crossings);
  if (ix) return ix;
  const cross = new Map<string, number[]>();
  layer.crossings.forEach((c, i) => {
    const k = `${Math.floor(c[0] / CC)}:${Math.floor(c[1] / CC)}`;
    const a = cross.get(k);
    if (a) a.push(i);
    else cross.set(k, [i]);
  });
  const edges = new Map<string, Edge[]>();
  layer.segments.forEach((seg, s) => {
    if (seg.k > 4) return; // pedestrian / living streets: footpath prior is close enough and keeps the index small
    const c = seg.c;
    for (let i = 2; i < c.length; i += 2) {
      const e: Edge = { s, aLat: c[i - 2], aLon: c[i - 1], bLat: c[i], bLon: c[i + 1] };
      const i0 = Math.floor(Math.min(e.aLat, e.bLat) / EC), i1 = Math.floor(Math.max(e.aLat, e.bLat) / EC);
      const j0 = Math.floor(Math.min(e.aLon, e.bLon) / EC), j1 = Math.floor(Math.max(e.aLon, e.bLon) / EC);
      for (let a = i0; a <= i1; a++)
        for (let b = j0; b <= j1; b++) {
          const k = `${a}:${b}`;
          const arr = edges.get(k);
          if (arr) arr.push(e);
          else edges.set(k, [e]);
        }
    }
  });
  ix = { cross, edges };
  cache.set(layer.crossings, ix);
  return ix;
}

export function distM(aLat: number, aLon: number, bLat: number, bLon: number) {
  const k = Math.cos(toRad((aLat + bLat) / 2));
  return Math.hypot((bLat - aLat) * M_LAT, (bLon - aLon) * M_LON * k);
}

function segDist(lat: number, lon: number, e: Edge) {
  const k = Math.cos(toRad(lat));
  const ax = (e.aLon - lon) * M_LON * k, ay = (e.aLat - lat) * M_LAT;
  const bx = (e.bLon - lon) * M_LON * k, by = (e.bLat - lat) * M_LAT;
  const dx = bx - ax, dy = by - ay;
  const L = dx * dx + dy * dy || 1e-9;
  const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** Resample a flat [lat,lon,...] track every ~stepM meters. */
export function densify(c: number[], stepM = 5): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < c.length; i += 2) {
    if (i === 0) {
      out.push([c[0], c[1]]);
      continue;
    }
    const aLat = c[i - 2], aLon = c[i - 1], bLat = c[i], bLon = c[i + 1];
    const n = Math.max(1, Math.ceil(distM(aLat, aLon, bLat, bLon) / stepM));
    for (let s = 1; s <= n; s++) out.push([aLat + ((bLat - aLat) * s) / n, aLon + ((bLon - aLon) * s) / n]);
  }
  return out;
}

function axisDeg(aLat: number, aLon: number, bLat: number, bLon: number) {
  const dy = bLat - aLat, dx = (bLon - aLon) * Math.cos(toRad(aLat));
  const b = (Math.atan2(dx, dy) * 180) / Math.PI;
  return ((b % 180) + 180) % 180;
}

/**
 * Score the walking parts of a trip. `walks` = flat [lat,lon,...] tracks of the legs a person
 * walks (in-vehicle legs are not pedestrian exposure and are excluded by the caller).
 */
export function scoreWalk(layer: LayerData, walks: number[][]): WalkScore {
  const M = SCORE_MODEL;
  const ix = indexOf(layer);
  let walkM = 0;
  const crossedOrder: { i: number; at: number; d: number }[] = [];
  const segLen = new Map<number, number>();
  let sumD = 0, sumN = 0, sumL = 0;

  let offset = 0;
  for (const c of walks) {
    if (!c || c.length < 4) continue;
    const pts = densify(c, 5);
    const best = new Map<number, { d: number; at: number }>();
    for (let p = 0; p < pts.length; p++) {
      const [lat, lon] = pts[p];
      const stepLen = p ? distM(pts[p - 1][0], pts[p - 1][1], lat, lon) : 0;
      walkM += stepLen;
      // crossings near this sample
      const ci = Math.floor(lat / CC), cj = Math.floor(lon / CC);
      for (let a = -1; a <= 1; a++)
        for (let b = -1; b <= 1; b++)
          for (const idx of ix.cross.get(`${ci + a}:${cj + b}`) ?? []) {
            const cr = layer.crossings[idx];
            const d = distM(lat, lon, cr[0], cr[1]);
            const r = cr[2] === 3 ? M.gradeR : M.crossR;
            if (d > r) continue;
            const prev = best.get(idx);
            if (!prev || d < prev.d) best.set(idx, { d, at: p });
          }
      // nearest mapped road for the along-street score
      if (stepLen > 0) {
        const ei = Math.floor(lat / EC), ej = Math.floor(lon / EC);
        let bestE: Edge | null = null, bestD = 15;
        for (let a = -1; a <= 1; a++)
          for (let b = -1; b <= 1; b++)
            for (const e of ix.edges.get(`${ei + a}:${ej + b}`) ?? []) {
              const d = segDist(lat, lon, e);
              if (d < bestD) {
                bestD = d;
                bestE = e;
              }
            }
        if (bestE) {
          const sg = layer.segments[bestE.s];
          sumD += sg.d * stepLen;
          sumN += sg.n * stepLen;
          segLen.set(bestE.s, (segLen.get(bestE.s) ?? 0) + stepLen);
        } else {
          sumD += M.footpath.day * stepLen;
          sumN += M.footpath.night * stepLen;
        }
        sumL += stepLen;
      }
    }
    // keep crossings whose road axis is transverse to the walking direction
    for (const [idx, { at }] of best) {
      const cr = layer.crossings[idx];
      const roadAxis = cr[6];
      let crossed = true;
      if (roadAxis != null && roadAxis >= 0) {
        const a = pts[Math.max(0, at - 2)], b = pts[Math.min(pts.length - 1, at + 2)];
        if (distM(a[0], a[1], b[0], b[1]) > 2) {
          let diff = Math.abs(axisDeg(a[0], a[1], b[0], b[1]) - roadAxis) % 180;
          if (diff > 90) diff = 180 - diff;
          crossed = diff >= M.minAngle;
        }
      }
      if (crossed) crossedOrder.push({ i: idx, at: offset + at, d: best.get(idx)!.d });
    }
    offset += pts.length;
  }

  // one physical road is crossed once: at junctions OSM often maps a crossing node per arm/side,
  // so crossings of the same street (same name, similar axis) within 30 m collapse to the closest
  const kept = crossedOrder.filter((x) => {
    const cx = layer.crossings[x.i];
    return !crossedOrder.some((y) => {
      if (y === x) return false;
      const cy = layer.crossings[y.i];
      if (distM(cx[0], cx[1], cy[0], cy[1]) > 30) return false;
      if ((cx[7] ?? -1) !== (cy[7] ?? -1)) return false;
      const ax = cx[6] ?? -1, ay = cy[6] ?? -1;
      if (ax >= 0 && ay >= 0) {
        let diff = Math.abs(ax - ay) % 180;
        if (diff > 90) diff = 180 - diff;
        if (diff > 25) return false;
      }
      return y.d < x.d || (y.d === x.d && y.i < x.i);
    });
  });
  kept.sort((a, b) => a.at - b.at);
  const crossed = kept.map((x) => x.i);
  const signals = crossed.filter((i) => layer.crossings[i][2] === 0 || layer.crossings[i][2] === 3).length;
  const unsignalized = crossed.length - signals;
  const riskyDay = crossed.filter((i) => layer.crossings[i][3] < M.riskyBelow).length;
  const riskyNight = crossed.filter((i) => layer.crossings[i][4] < M.riskyBelow).length;

  if (walkM < 30) {
    return { day: M.noWalk.day, night: M.noWalk.night, crossed, signals, unsignalized, riskyDay, riskyNight, weakest: -1, walkM: Math.round(walkM) };
  }
  const meanD = sumL ? sumD / sumL : M.footpath.day;
  const meanN = sumL ? sumN / sumL : M.footpath.night;
  const weakSeg = (night: boolean) => {
    let w = Infinity;
    for (const [s, len] of segLen) {
      const v = night ? layer.segments[s].n : layer.segments[s].d;
      if (len >= 40 && v < M.riskyBelow) w = Math.min(w, v);
    }
    return w;
  };
  let weakest = -1;
  for (const i of crossed) if (weakest < 0 || layer.crossings[i][4] < layer.crossings[weakest][4]) weakest = i;
  const agg = (night: boolean, mean: number, risky: number) => {
    let w = weakSeg(night);
    for (const i of crossed) w = Math.min(w, night ? layer.crossings[i][4] : layer.crossings[i][3]);
    const base = Number.isFinite(w) ? M.wWeak * w + M.wMean * mean : mean;
    const pen = Math.min(M.repeatCap, M.repeatPenalty * Math.max(0, risky - 1));
    return Math.round(Math.max(5, Math.min(97, base - pen)));
  };
  const day = agg(false, meanD, riskyDay);
  const night = Math.min(day, agg(true, meanN, riskyNight));
  return { day, night, crossed, signals, unsignalized, riskyDay, riskyNight, weakest, walkM: Math.round(walkM) };
}
