/**
 * Şəhər paneli (B2G) — every number here is derived from REAL data, nothing is typed in:
 *  - LAYER (src/data/safety-layer.json): 3k+ OSM crossings with type + lanes and the
 *    day/night scores of the Bakı Təhlükəsizlik Qatı; ~20k OSM street segments with scores.
 *  - OSM (src/features/city/osm-city.json, scripts/build-city.mjs): OSM bus stops, metro
 *    entrances, schools, universities, malls, markets, street names and lighting-tag coverage.
 * Pedestrian demand is a MODEL (documented in demandAt), labelled as an estimate in the UI.
 * Pure functions, memoized per day/night mode.
 */
import { LAYER } from './layer';
import OSM from '@/features/city/osm-city.json';

export type Mode = 'day' | 'night';

/** Crossing type codes in safety-layer.json. */
export const T_SIGNALS = 0, T_ZEBRA = 1, T_UNMARKED = 2, T_UNDERGROUND = 3;
export const RED = 55; // score < 55 → red (theme.scoreColor)
export const GREEN = 75;
/** "multi-lane" = two or more lanes per direction. */
export const MULTI_LANE = 4;

const K_LON = Math.cos((40.4 * Math.PI) / 180);
export function distM(aLat: number, aLon: number, bLat: number, bLon: number) {
  const dy = (bLat - aLat) * 110540;
  const dx = (bLon - aLon) * 111320 * K_LON;
  return Math.sqrt(dx * dx + dy * dy);
}

const scoreOf = (c: readonly number[], mode: Mode) => (mode === 'night' ? c[4] : c[3]);

// ---------------------------------------------------------------- spatial grid helper
type Pt = { lat: number; lon: number; w: number; kind: number };
const CELL = 0.005; // ≈ 550 m × 420 m
function gridOf(pts: Pt[]) {
  const g = new Map<number, Pt[]>();
  for (const p of pts) {
    const k = Math.floor(p.lat / CELL) * 100000 + Math.floor(p.lon / CELL);
    const a = g.get(k);
    if (a) a.push(p);
    else g.set(k, [p]);
  }
  return g;
}
function near(g: Map<number, Pt[]>, lat: number, lon: number, rings = 1) {
  const i0 = Math.floor(lat / CELL), j0 = Math.floor(lon / CELL);
  const out: Pt[] = [];
  for (let di = -rings; di <= rings; di++)
    for (let dj = -rings; dj <= rings; dj++) {
      const a = g.get((i0 + di) * 100000 + (j0 + dj));
      if (a) for (const p of a) out.push(p);
    }
  return out;
}

// ---------------------------------------------------------------- pedestrian demand model
/**
 * Attractors = real OSM points. Weights are modelling assumptions (relative pull of a place):
 * metro station 1.0 · metro entrance 0.6 · university 0.7 · school 0.5 · mall 0.6 ·
 * marketplace 0.6 · bus stop 0.35.
 */
export const ATTRACTOR_KIND = ['Metro girişi', 'Məktəb', 'Universitet', 'Ticarət mərkəzi', 'Bazar', 'Avtobus dayanacağı', 'Metro stansiyası'];
const POI_W = [0.6, 0.5, 0.7, 0.6, 0.6];
let _attr: Pt[] | null = null;
let _attrGrid: Map<number, Pt[]> | null = null;
export function attractors(): Pt[] {
  if (_attr) return _attr;
  const a: Pt[] = [];
  const s = OSM.stops as number[];
  for (let i = 0; i < s.length; i += 2) a.push({ lat: s[i], lon: s[i + 1], w: 0.35, kind: 5 });
  const p = OSM.poi as number[];
  for (let i = 0; i < p.length; i += 3) a.push({ lat: p[i], lon: p[i + 1], w: POI_W[p[i + 2]] ?? 0.4, kind: p[i + 2] });
  for (const st of LAYER.stations) a.push({ lat: st.lat, lon: st.lon, w: 1, kind: 6 });
  _attr = a;
  return a;
}
function attrGrid() {
  if (!_attrGrid) _attrGrid = gridOf(attractors());
  return _attrGrid;
}

/** demand(p) = Σ w_a · e^(−d/180 m) over attractors within 500 m (distance-decay gravity model). */
export function demandAt(lat: number, lon: number) {
  let s = 0;
  for (const a of near(attrGrid(), lat, lon, 1)) {
    const d = distM(lat, lon, a.lat, a.lon);
    if (d <= 500) s += a.w * Math.exp(-d / 180);
  }
  return s;
}

/** Counts of real attractors within r metres (for explanations). */
export function attractorsNear(lat: number, lon: number, r = 300) {
  const counts = new Array(ATTRACTOR_KIND.length).fill(0) as number[];
  for (const a of near(attrGrid(), lat, lon, 1)) if (distM(lat, lon, a.lat, a.lon) <= r) counts[a.kind]++;
  return counts;
}

// ---------------------------------------------------------------- street names
const NAMES = OSM.names as string[];
const CROSS_NAMES = OSM.crossingNames as Record<string, number>;
let _namedGrid: Map<number, Pt[]> | null = null;
function namedGrid() {
  if (!_namedGrid) {
    const n = OSM.named as number[][];
    _namedGrid = gridOf(n.map((x) => ({ lat: x[0], lon: x[1], w: 0, kind: x[2] })));
  }
  return _namedGrid;
}
/** Street name for a point: exact OSM crossing node → nearest named major road (≤150 m) → nearest metro. */
export function placeName(lat: number, lon: number): string {
  const exact = CROSS_NAMES[`${lat},${lon}`];
  if (exact != null) return NAMES[exact];
  let best = -1, bestD = 150;
  for (const p of near(namedGrid(), lat, lon, 1)) {
    const d = distM(lat, lon, p.lat, p.lon);
    if (d < bestD) {
      bestD = d;
      best = p.kind;
    }
  }
  if (best >= 0) return NAMES[best];
  let st = '', sd = Infinity;
  for (const s of LAYER.stations) {
    const d = distM(lat, lon, s.lat, s.lon);
    if (d < sd) {
      sd = d;
      st = s.name;
    }
  }
  return st ? `${st} metrosu yaxınlığı` : 'Bakı';
}

// ---------------------------------------------------------------- segment lengths (cached)
let _segLen: Float64Array | null = null;
function segLengths() {
  if (_segLen) return _segLen;
  const segs = LAYER.segments;
  const out = new Float64Array(segs.length);
  for (let i = 0; i < segs.length; i++) {
    const c = segs[i].c;
    let L = 0;
    for (let j = 2; j < c.length; j += 2) L += distM(c[j - 2], c[j - 1], c[j], c[j + 1]);
    out[i] = L;
  }
  _segLen = out;
  return out;
}

// ---------------------------------------------------------------- KPIs
export type CityKpis = {
  mode: Mode;
  /** all crossings in the layer */
  crossings: number;
  /** zebra or unmarked crossings on roads with ≥4 lanes */
  unsignalizedMultiLane: number;
  /** % of street length (geometric, all classes) with a red score in this mode */
  riskyStreetPct: number;
  riskyStreetKm: number;
  totalStreetKm: number;
  /** street segments with a red score in this mode */
  redSegments: number;
  segments: number;
  /** crossing count by score band in this mode (at-grade + underground) */
  bands: { safe: number; mid: number; risky: number };
  /** [signals, zebra, unmarked, underground] */
  types: number[];
  /** OSM lighting tag coverage: % of street length with lit=yes */
  litTaggedPct: number;
  /** real OSM attractor counts */
  busStops: number;
  pois: number;
};

const kpiCache = new Map<Mode, CityKpis>();
export function cityKpis(mode: Mode): CityKpis {
  const hit = kpiCache.get(mode);
  if (hit) return hit;
  const cr = LAYER.crossings;
  const types = [0, 0, 0, 0];
  const bands = { safe: 0, mid: 0, risky: 0 };
  let unsigMulti = 0;
  for (const c of cr) {
    types[c[2]]++;
    if ((c[2] === T_ZEBRA || c[2] === T_UNMARKED) && c[5] >= MULTI_LANE) unsigMulti++;
    const v = scoreOf(c, mode);
    if (v >= GREEN) bands.safe++;
    else if (v >= RED) bands.mid++;
    else bands.risky++;
  }
  const len = segLengths();
  let total = 0, risky = 0, red = 0;
  LAYER.segments.forEach((s, i) => {
    const v = mode === 'night' ? s.n : s.d;
    total += len[i];
    if (v < RED) {
      risky += len[i];
      red++;
    }
  });
  const lit = OSM.lighting;
  const k: CityKpis = {
    mode,
    crossings: cr.length,
    unsignalizedMultiLane: unsigMulti,
    riskyStreetPct: total ? (risky / total) * 100 : 0,
    riskyStreetKm: risky / 1000,
    totalStreetKm: total / 1000,
    redSegments: red,
    segments: LAYER.segments.length,
    bands,
    types,
    litTaggedPct: lit.totalKm ? (lit.litYesKm / lit.totalKm) * 100 : 0,
    busStops: (OSM.stops as number[]).length / 2,
    pois: (OSM.poi as number[]).length / 3 + LAYER.stations.length,
  };
  kpiCache.set(mode, k);
  return k;
}

// ---------------------------------------------------------------- top risks + recommendations
export type Recommendation = { title: string; body: string; icon: string };
export type RiskSpot = {
  idx: number;
  lat: number;
  lon: number;
  type: number;
  lanes: number;
  day: number;
  night: number;
  score: number;
  name: string;
  /** modelled demand, 0..1 relative to the busiest crossing */
  demand: number;
  /** real OSM bus stops / metro within 300 m */
  stops: number;
  metro: number;
  rec: Recommendation;
};

let _demandMax = 0;
const demandCache = new Map<number, number>();
function crossingDemand(i: number) {
  let v = demandCache.get(i);
  if (v == null) {
    const c = LAYER.crossings[i];
    v = demandAt(c[0], c[1]);
    demandCache.set(i, v);
  }
  return v;
}
function demandScale() {
  if (_demandMax) return _demandMax;
  const vals = LAYER.crossings.map((_, i) => crossingDemand(i)).sort((a, b) => a - b);
  _demandMax = vals[Math.floor(vals.length * 0.98)] || 1; // 98th percentile = 1.0
  return _demandMax;
}

export function recommend(type: number, lanes: number, day: number, night: number, mode: Mode, stops: number): Recommendation {
  const drop = day - night;
  const nightNote = mode === 'night' && drop >= 10 ? ` Gecə risk gündüzdən ${drop} bal yüksəkdir.` : '';
  const flow = stops > 0 ? ` 300 m-də ${stops} dayanacaq piyada axını yaradır.` : '';
  if (type === T_UNMARKED && lanes >= MULTI_LANE)
    return { title: 'İşıqforlu zebra keçid tövsiyə olunur', body: `${lanes} zolaq nişansız keçilir.${flow}${nightNote}`, icon: 'traffic-light-outline' };
  if (type === T_UNMARKED)
    return { title: 'Zebra və sürət azaldan tövsiyə olunur', body: `Keçid nişanlanmayıb, sürücü piyadanı gec görür.${flow}${nightNote}`, icon: 'walk' };
  if (type === T_ZEBRA && lanes >= 6)
    return { title: 'İşıqfor və piyada adacığı tövsiyə olunur', body: `${lanes} zolaqlı yolda işıqforsuz zebra.${flow}${nightNote}`, icon: 'traffic-light-outline' };
  if (type === T_ZEBRA && lanes >= MULTI_LANE)
    return { title: 'Burada işıqfor tövsiyə olunur', body: `Çoxzolaqlı yolda işıqforsuz zebra: ikinci zolaqdakı sürücü piyadanı görmür.${flow}${nightNote}`, icon: 'traffic-light-outline' };
  if (type === T_ZEBRA)
    return { title: 'Yüksəldilmiş keçid və gecə işığı', body: `Sürəti keçiddə azaltmaq riski ən çox endirir.${flow}${nightNote}`, icon: 'lightbulb-on-outline' };
  return { title: 'Gecə işıqlandırması gücləndirilməli', body: `İşıqforlu keçiddir, amma qaranlıqda risk artır.${flow}${nightNote}`, icon: 'lightbulb-on-outline' };
}

const topCache = new Map<string, RiskSpot[]>();
/**
 * Riskiest at-grade crossings in this mode: lowest real score first, ties broken by more
 * lanes and higher modelled demand. Spots closer than 250 m to a higher-ranked one are
 * skipped so the list covers distinct places.
 */
export function topRisks(mode: Mode, n = 10): RiskSpot[] {
  const key = `${mode}:${n}`;
  const hit = topCache.get(key);
  if (hit) return hit;
  const scale = demandScale();
  const cr = LAYER.crossings;
  const idx: number[] = [];
  for (let i = 0; i < cr.length; i++) if (cr[i][2] !== T_UNDERGROUND) idx.push(i);
  idx.sort((a, b) => scoreOf(cr[a], mode) - scoreOf(cr[b], mode) || cr[b][5] - cr[a][5] || crossingDemand(b) - crossingDemand(a));
  const out: RiskSpot[] = [];
  for (const i of idx) {
    if (out.length >= n) break;
    const c = cr[i];
    if (out.some((o) => distM(o.lat, o.lon, c[0], c[1]) < 250)) continue;
    const near = attractorsNear(c[0], c[1], 300);
    const stops = near[5];
    out.push({
      idx: i,
      lat: c[0],
      lon: c[1],
      type: c[2],
      lanes: c[5],
      day: c[3],
      night: c[4],
      score: scoreOf(c, mode),
      name: placeName(c[0], c[1]),
      demand: Math.min(1, crossingDemand(i) / scale),
      stops,
      metro: near[0] + near[6],
      rec: recommend(c[2], c[5], c[3], c[4], mode, stops),
    });
  }
  topCache.set(key, out);
  return out;
}

// ---------------------------------------------------------------- demand heatmap
let _heat: { latitude: number; longitude: number; weight: number }[] | null = null;
/**
 * "Təxmini piyada axını": modelled demand at every UNSIGNALIZED at-grade crossing
 * (zebra + unmarked) — where pedestrian flow meets the least protection.
 */
export function demandHeat() {
  if (_heat) return _heat;
  const scale = demandScale();
  const out: { latitude: number; longitude: number; weight: number }[] = [];
  LAYER.crossings.forEach((c, i) => {
    if (c[2] !== T_ZEBRA && c[2] !== T_UNMARKED) return;
    const w = Math.min(1, crossingDemand(i) / scale);
    if (w > 0.04) out.push({ latitude: c[0], longitude: c[1], weight: w });
  });
  _heat = out;
  return out;
}

// ---------------------------------------------------------------- accessibility barriers
export type Barrier = { lat: number; lon: number; name: string; nearestAtGradeM: number | null };
let _barriers: Barrier[] | null = null;
/**
 * Underpasses with NO at-grade crossing (signal / zebra / unmarked) within 300 m:
 * the only way across is stairs or an escalator — no step-free option for wheelchairs
 * and strollers. Sorted by how far the nearest at-grade crossing is.
 */
export function accessBarriers(): Barrier[] {
  if (_barriers) return _barriers;
  const cr = LAYER.crossings;
  const atGrade: Pt[] = [];
  cr.forEach((c) => {
    if (c[2] !== T_UNDERGROUND) atGrade.push({ lat: c[0], lon: c[1], w: 0, kind: c[2] });
  });
  const g = gridOf(atGrade);
  const out: Barrier[] = [];
  const seen: Barrier[] = [];
  for (const c of cr) {
    if (c[2] !== T_UNDERGROUND) continue;
    let best = Infinity;
    for (const p of near(g, c[0], c[1], 2)) best = Math.min(best, distM(c[0], c[1], p.lat, p.lon));
    if (best <= 300) continue;
    if (seen.some((s) => distM(s.lat, s.lon, c[0], c[1]) < 120)) continue; // one entry per underpass cluster
    const b = { lat: c[0], lon: c[1], name: placeName(c[0], c[1]), nearestAtGradeM: Number.isFinite(best) && best < 1200 ? Math.round(best / 10) * 10 : null };
    seen.push(b);
    out.push(b);
  }
  out.sort((a, b) => (b.nearestAtGradeM ?? 9999) - (a.nearestAtGradeM ?? 9999));
  _barriers = out;
  return out;
}

export const CROSSING_LABEL = ['İşıqforlu', 'İşıqforsuz zebra', 'Nişansız', 'Yeraltı'];

/** Warm every cache (call after first paint). */
export function primeCity(mode: Mode) {
  cityKpis(mode);
  topRisks(mode);
  demandHeat();
  accessBarriers();
}
