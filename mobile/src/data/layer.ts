import raw from './safety-layer.json';

/** [lat, lon, type, scoreDay, scoreNight, lanes]; type: 0 signals, 1 zebra, 2 unmarked, 3 underground */
export type CrossingT = [number, number, number, number, number, number];
/** k: road class 0 trunk .. 5 pedestrian; d/n: day/night score; c: flat coords */
export type SegmentT = { k: number; d: number; n: number; c: number[] };

type Layer = { crossings: CrossingT[]; segments: SegmentT[]; stations: { name: string; lat: number; lon: number }[] };
export const LAYER = raw as unknown as Layer;

export const CROSSING_TYPE = ['İşıqforlu keçid', 'İşıqforsuz zebra', 'Nişansız keçid', 'Yeraltı keçid'];

const CELL = 0.01;
const cellKey = (i: number, j: number) => i * 100000 + j;
let segGrid: Map<number, number[]> | null = null;
let crGrid: Map<number, number[]> | null = null;

function build() {
  segGrid = new Map();
  crGrid = new Map();
  LAYER.segments.forEach((s, idx) => {
    let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
    for (let i = 0; i < s.c.length; i += 2) {
      minLat = Math.min(minLat, s.c[i]);
      maxLat = Math.max(maxLat, s.c[i]);
      minLon = Math.min(minLon, s.c[i + 1]);
      maxLon = Math.max(maxLon, s.c[i + 1]);
    }
    for (let i = Math.floor(minLat / CELL); i <= Math.floor(maxLat / CELL); i++)
      for (let j = Math.floor(minLon / CELL); j <= Math.floor(maxLon / CELL); j++) {
        const k = cellKey(i, j);
        const arr = segGrid!.get(k);
        if (arr) arr.push(idx);
        else segGrid!.set(k, [idx]);
      }
  });
  LAYER.crossings.forEach((c, idx) => {
    const k = cellKey(Math.floor(c[0] / CELL), Math.floor(c[1] / CELL));
    const arr = crGrid!.get(k);
    if (arr) arr.push(idx);
    else crGrid!.set(k, [idx]);
  });
}

export type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

function cellsIn(r: Region) {
  const s = r.latitude - r.latitudeDelta / 2, n = r.latitude + r.latitudeDelta / 2;
  const w = r.longitude - r.longitudeDelta / 2, e = r.longitude + r.longitudeDelta / 2;
  const keys: number[] = [];
  for (let i = Math.floor(s / CELL); i <= Math.floor(n / CELL); i++)
    for (let j = Math.floor(w / CELL); j <= Math.floor(e / CELL); j++) keys.push(cellKey(i, j));
  return { keys, s, n, w, e };
}

export function visible(r: Region, night: boolean, opts: { maxSeg?: number; maxCross?: number } = {}) {
  if (!segGrid) build();
  const zoomedOut = r.latitudeDelta > 0.035;
  const { keys, s, n, w, e } = cellsIn(r);
  const segSet = new Set<number>();
  const crs: number[] = [];
  for (const k of keys) {
    for (const idx of segGrid!.get(k) ?? []) segSet.add(idx);
    for (const idx of crGrid!.get(k) ?? []) {
      const c = LAYER.crossings[idx];
      if (c[0] >= s && c[0] <= n && c[1] >= w && c[1] <= e) crs.push(idx);
    }
  }
  const sc = (i: number) => (night ? LAYER.segments[i].n : LAYER.segments[i].d);
  let segs = [...segSet];
  if (zoomedOut) segs = segs.filter((i) => LAYER.segments[i].k <= 1);
  // major roads first, then the riskiest
  segs.sort((a, b) => LAYER.segments[a].k - LAYER.segments[b].k || sc(a) - sc(b));
  segs = segs.slice(0, opts.maxSeg ?? (zoomedOut ? 380 : 420));

  const cs = (i: number) => (night ? LAYER.crossings[i][4] : LAYER.crossings[i][3]);
  let cross: number[] = [];
  let heat: { latitude: number; longitude: number; weight: number }[] = [];
  if (zoomedOut) {
    heat = crs
      .filter((i) => cs(i) < 55)
      .map((i) => ({ latitude: LAYER.crossings[i][0], longitude: LAYER.crossings[i][1], weight: (60 - cs(i)) / 60 }));
  } else {
    crs.sort((a, b) => cs(a) - cs(b));
    cross = crs.slice(0, opts.maxCross ?? 320);
  }
  let safe = 0, mid = 0, risky = 0;
  for (const i of crs) {
    const v = cs(i);
    if (v >= 75) safe++;
    else if (v >= 55) mid++;
    else risky++;
  }
  return { segs, cross, heat, zoomedOut, counts: { safe, mid, risky } };
}

export function nearestCrossing(lat: number, lon: number, candidates: number[], maxM = 40) {
  let best = -1, bestD = Infinity;
  const k = Math.cos((lat * Math.PI) / 180);
  for (const i of candidates) {
    const c = LAYER.crossings[i];
    const dy = (c[0] - lat) * 110540, dx = (c[1] - lon) * 111320 * k;
    const d = Math.hypot(dx, dy);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return bestD <= maxM ? best : -1;
}

export function crossingsNearTrack(pts: { latitude: number; longitude: number }[], radiusM: number) {
  if (!segGrid) build();
  const out = new Set<number>();
  for (let p = 0; p < pts.length; p += 1) {
    const { latitude: lat, longitude: lon } = pts[p];
    const i0 = Math.floor(lat / CELL), j0 = Math.floor(lon / CELL);
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++)
        for (const idx of crGrid!.get(cellKey(i0 + di, j0 + dj)) ?? []) {
          const c = LAYER.crossings[idx];
          const dy = (c[0] - lat) * 110540, dx = (c[1] - lon) * 111320 * Math.cos((lat * Math.PI) / 180);
          if (Math.hypot(dx, dy) <= radiusM) out.add(idx);
        }
  }
  return [...out];
}
