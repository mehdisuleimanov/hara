// Dev-time only: pre-bakes the catalog routes (28 May m. → 9 destinations) with real street
// geometry (FOSSGIS OSRM car/foot/bike), real metro tunnel geometry (OSM railway=subway, see
// fetch-metro.mjs), real bus lines (OSM route=bus relations, fetch-bus.mjs) and scores every
// option with the shared weakest-link model (src/features/routing/scoring.ts) against the
// safety layer (run build-safety-layer.mjs first). Output: src/data/routes.json
// Usage: node scripts/build-routes.mjs   then   node scripts/check-routes.mjs
//
// Tariffs / timing (documented assumptions, not live data):
//   walk  = OSRM foot duration × 1.1 (signal waits)            · 0 ₼ · 0 g CO₂
//   metro = 3 min wait + 2.2 min per hop (+3 min transfer)      · 0,60 ₼ · 20 g CO₂/km
//   bus   = OSRM car duration × 1.9 + 6 min wait                · 0,60 ₼ · 70 g CO₂/km
//   taxi  = OSRM car duration × 1.3 + 3 min pickup              · 2.4 + 0.85 ₼/km (±1 ₼) · 170 g CO₂/km
// Station exits: walks start/end at the OSM railway=subway_entrance that gives the lowest-risk
// walk (station → exit is underground, not scored); taxi pickups at the exit/curb with the
// shortest total time.
//
// "Son 50 metr" (lastMeters): the taxi drop-off is where OSRM car routing actually stops for the
// destination entrance (OSM entrance node). The car stops at its RIGHT curb; if the entrance is on
// the left of the direction of travel across a multi-lane road, the passenger must cross it. We
// measure the lanes (OSM), the risky direct line, the safest alternative via the nearest
// signalised / grade-separated crossing on that road, and a better drop-off on the entrance side.
import fs from 'node:fs/promises';
import path from 'node:path';
import { ORIGIN, DESTINATIONS } from '../src/data/destinations.ts';
import { scoreWalk } from '../src/features/routing/scoring.ts';
import { osrm } from './lib/osrm.mjs';
import { loadMetroGraph } from './lib/metro.mjs';
import { crossingScore, T_UNMARKED, DEFAULT_SPEED } from './lib/irap.mjs';

const CACHE = path.resolve('scripts/.cache');
const LAYER_FILE = path.resolve('src/data/safety-layer.json');
const OUT = path.resolve('src/data/routes.json');

const RED = ['İçərişəhər', 'Sahil', '28 May', 'Gənclik', 'Nəriman Nərimanov', 'Ulduz', 'Koroğlu', 'Qara Qarayev', 'Neftçilər', 'Xalqlar Dostluğu', 'Əhmədli', 'Həzi Aslanov'];
const GREEN = ['Xətai', 'Cəfər Cabbarlı', 'Nizami', 'Elmlər Akademiyası', 'İnşaatçılar', '20 Yanvar', 'Memar Əcəmi', 'Nəsimi', 'Azadlıq prospekti', 'Dərnəgül'];

/** building centroids (previous pins) — OSRM car to these finds hotel/mall driveways for betterDrop */
const BUILDING = {
  hilton: [40.37211, 49.84959],
  genclik: [40.39986, 49.8528],
};

const WALK_M_PER_MIN = 75;
const r5 = (v) => Math.round(v * 1e5) / 1e5;
const r1 = (v) => Math.round(v * 10) / 10;
const toRad = (d) => (d * Math.PI) / 180;
const norm = (s) => s.toLowerCase().replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/i̇/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/[^a-z0-9]/g, '');

function hav(aLat, aLon, bLat, bLon) {
  const R = 6371000, dLat = toRad(bLat - aLat), dLon = toRad(bLon - aLon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const d2 = (a, b) => hav(a[0], a[1], b[0], b[1]);
const lineLen = (pts) => pts.reduce((s, p, i) => (i ? s + d2(pts[i - 1], p) : 0), 0);
const flat = (pts) => pts.flatMap(([a, b]) => [r5(a), r5(b)]);
const samePts = (a, b) => a.length === b.length && a.every((p, i) => d2(p, b[i]) < 1);

// local planar frame (meters) around a reference latitude
const xy = (p, ref) => [(p[1] - ref[1]) * 111320 * Math.cos(toRad(ref[0])), (p[0] - ref[0]) * 110540];
const ll = (v, ref) => [ref[0] + v[1] / 110540, ref[1] + v[0] / (111320 * Math.cos(toRad(ref[0])))];

/** at least `min` points: interpolate straight runs (walk legs must animate smoothly) */
function densifyPts(pts, min = 3) {
  if (pts.length >= min) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const out = [];
  for (let i = 0; i < min; i++) out.push([a[0] + ((b[0] - a[0]) * i) / (min - 1), a[1] + ((b[1] - a[1]) * i) / (min - 1)]);
  return out;
}

/** remove out-and-back spurs / loops: returning to an earlier point means the detour was useless */
export function despur(pts) {
  const out = [];
  for (const p of pts) {
    if (out.length && d2(out[out.length - 1], p) < 0.5) continue;
    out.push(p);
    let acc = 0;
    for (let k = out.length - 2; k >= Math.max(0, out.length - 120); k--) {
      acc += d2(out[k], out[k + 1]);
      if (acc > 400) break;
      if (k <= out.length - 3 && acc > 6 && d2(out[k], p) < 3) {
        out.length = k + 1;
        break;
      }
    }
  }
  return out;
}

const STEP_MAP = (m) => {
  const t = m.type, mod = m.modifier ?? '';
  if (t === 'depart') return 'depart';
  if (t === 'arrive') return 'arrive';
  if (mod.includes('uturn')) return 'uturn';
  if (mod === 'slight left') return 'slight-left';
  if (mod === 'slight right') return 'slight-right';
  if (mod.includes('left')) return 'left';
  if (mod.includes('right')) return 'right';
  return 'straight';
};

/** OSRM route → {pts:[[lat,lon]], steps, distance, duration} (geometry de-spurred) */
function fromOsrm(route) {
  const pts = despur(route.geometry.coordinates.map(([lon, lat]) => [lat, lon]));
  const steps = [];
  let acc = 0;
  for (const leg of route.legs) {
    for (const s of leg.steps) {
      const type = STEP_MAP(s.maneuver);
      if ((type !== 'straight' || s.name) && !(type === 'arrive' && leg !== route.legs[route.legs.length - 1])) {
        steps.push({ lat: s.maneuver.location[1], lon: s.maneuver.location[0], type, street: s.name || undefined, dist: acc });
      }
      acc += s.distance;
    }
  }
  return { pts, steps, distance: lineLen(pts), duration: route.duration };
}

function genitive(street) {
  const s = street.trim();
  if (/prospekti$/i.test(s)) return s.replace(/prospekti$/i, 'prospektinin');
  if (/küçəsi$/i.test(s)) return s.replace(/küçəsi$/i, 'küçəsinin');
  if (/meydanı$/i.test(s)) return s.replace(/meydanı$/i, 'meydanının');
  if (/yolu$/i.test(s)) return s.replace(/yolu$/i, 'yolunun');
  if (/şossesi$/i.test(s)) return s.replace(/şossesi$/i, 'şossesinin');
  if (/bulvarı$/i.test(s)) return s.replace(/bulvarı$/i, 'bulvarının');
  return s;
}

// ───────────────────────────────────────── OSM roads (for last-meters geometry)
async function loadRoads() {
  const files = (await fs.readdir(CACHE)).filter((f) => f.startsWith('tile-'));
  const roads = [];
  const seen = new Set();
  const CLS = /^(trunk|primary|secondary|tertiary|unclassified|residential)(_link)?$/;
  for (const f of files) {
    const j = JSON.parse(await fs.readFile(path.join(CACHE, f), 'utf8'));
    for (const w of j.elements) {
      if (w.type !== 'way' || seen.has(w.id) || !CLS.test(w.tags?.highway ?? '') || !w.geometry) continue;
      seen.add(w.id);
      const t = w.tags;
      const oneway = t.oneway === 'yes' || t.oneway === '1' || t.junction === 'roundabout';
      const l = parseInt(t.lanes, 10);
      const cls = t.highway;
      const lanesDefault = { trunk: oneway ? 3 : 6, primary: oneway ? 3 : 4, secondary: oneway ? 2 : 4 }[cls] ?? 2;
      roads.push({
        id: w.id, cls, oneway,
        name: t['name:az'] ?? t.name ?? '',
        lanes: Number.isFinite(l) && l > 0 ? l : lanesDefault,
        lanesVerified: Number.isFinite(l) && l > 0,
        speed: parseInt(t.maxspeed, 10) || DEFAULT_SPEED[cls] || 50,
        lit: t.lit === 'yes' ? 'yes' : t.lit === 'no' ? 'no' : 'unknown',
        g: w.geometry.map((p) => [p.lat, p.lon]),
      });
    }
  }
  return roads;
}

function projOnPolyline(p, g) {
  let best = { d: Infinity, q: null, i: 0, t: 0 };
  for (let i = 1; i < g.length; i++) {
    const a = xy(g[i - 1], p), b = xy(g[i], p);
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / L));
    const q = [a[0] + t * dx, a[1] + t * dy];
    const d = Math.hypot(q[0], q[1]);
    if (d < best.d) best = { d, q: ll(q, p), i, t };
  }
  return best;
}

/** proper segment intersection in a local frame */
function segCross(p1, p2, q1, q2) {
  const ref = p1;
  const [a, b, c, d] = [xy(p1, ref), xy(p2, ref), xy(q1, ref), xy(q2, ref)];
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}
/** roads with ≥2 lanes (or any trunk/primary) that a straight walk a→b would cross */
function roadsCrossed(roads, a, b, exceptId = null) {
  const out = [];
  for (const r of roads) {
    if (r.id === exceptId) continue;
    if (!(r.lanes >= 2 || /^(trunk|primary)/.test(r.cls))) continue;
    if (Math.min(d2(r.g[0], a), d2(r.g[r.g.length - 1], a)) > 3000) continue;
    for (let i = 1; i < r.g.length; i++) if (segCross(a, b, r.g[i - 1], r.g[i])) { out.push(r); break; }
  }
  return out;
}

async function main() {
  const layer = JSON.parse(await fs.readFile(LAYER_FILE, 'utf8'));
  const roads = await loadRoads();
  const metro = await loadMetroGraph();
  console.log(`layer: ${layer.crossings.length} crossings · roads ${roads.length} · metro graph ${metro ? metro.nodes + ' nodes' : 'MISSING (straight station hops)'}`);

  const score = (walks, extra = []) => {
    if (!extra.length) return scoreWalk(layer, walks);
    // virtual crossings (e.g. a drop-off on the far side of a road with no facility) join the weakest-link set
    const base = layer.crossings.length;
    const l2 = { crossings: [...layer.crossings, ...extra], segments: layer.segments };
    const s = scoreWalk(l2, walks);
    return { ...s, crossed: s.crossed.filter((i) => i < base) };
  };

  // ── stations
  const stIdx = new Map(layer.stations.map((s) => [norm(s.name), s]));
  const station = (name) => {
    const n = norm(name);
    const hit = stIdx.get(n) ?? [...stIdx.entries()].find(([k]) => k.includes(n) || n.includes(k))?.[1];
    if (!hit) throw new Error('station not found: ' + name);
    return { name, lat: hit.lat, lon: hit.lon };
  };
  const lineOf = (name) => (RED.includes(name) ? RED : GREEN.includes(name) ? GREEN : null);
  const allMetro = [...RED, ...GREEN].filter((n) => {
    try { station(n); return true; } catch { return false; }
  });
  let metroReal = 0, metroFallback = 0;
  let exits = [];
  try {
    const mj = JSON.parse(await fs.readFile(path.join(CACHE, 'metro.json'), 'utf8'));
    exits = mj.elements.filter((e) => e.type === 'node' && e.tags?.railway === 'subway_entrance').map((e) => ({ p: [e.lat, e.lon], name: e.tags['name:az'] ?? e.tags.name }));
  } catch {}
  const exitsNear = (p, r) => exits.filter((e) => d2(e.p, p) <= r);
  /** best station exit for walking to `dest` (lowest-risk walk, then shortest) */
  async function bestExit(stationPt, dest) {
    const cand = exitsNear(stationPt, 300).sort((a, b) => d2(a.p, dest) - d2(b.p, dest)).slice(0, 3);
    let best = null;
    for (const e of cand) {
      try {
        const r = fromOsrm((await osrm('foot', [e.p, dest])).routes[0]);
        const sc = score([flat(r.pts)]);
        const key = sc.night * 1000 - r.distance;
        if (!best || key > best.key) best = { ...e, key };
      } catch {}
    }
    return best;
  }
  const indoorLeg = (a, b, label) => ({ mode: 'walk', indoor: true, pts: densifyPts([a, b], 3), label, distanceM: d2(a, b) * 1.3, durationMin: (d2(a, b) * 1.3) / 60 + 0.5, steps: [] });

  /** metro legs (+ underground transfer walk) from one station to another */
  function metroLegs(fromName, toName) {
    const seg = (line, a, b) => {
      const i = line.indexOf(a), j = line.indexOf(b);
      return i <= j ? line.slice(i, j + 1) : line.slice(j, i + 1).reverse();
    };
    const lf = lineOf(fromName), lt = lineOf(toName);
    const parts = lf === lt
      ? [seg(lf, fromName, toName)]
      : [seg(lf, fromName, lf === RED ? '28 May' : 'Cəfər Cabbarlı'), seg(lt, lt === RED ? '28 May' : 'Cəfər Cabbarlı', toName)];
    const legs = [];
    let hops = 0;
    for (const names of parts) {
      if (names.length < 2) continue;
      const sts = names.map(station);
      const tr = metro ? metro.track(sts) : { pts: sts.map((s) => [s.lat, s.lon]), real: 0, fallback: sts.length - 1 };
      metroReal += tr.real;
      metroFallback += tr.fallback;
      hops += sts.length - 1;
      const pts = tr.pts;
      const dist = lineLen(pts);
      if (legs.length) {
        // underground transfer passage between the two platforms
        const prev = legs[legs.length - 1];
        const a = prev.pts[prev.pts.length - 1];
        legs.push({ mode: 'walk', indoor: true, pts: densifyPts([a, pts[0]], 3), label: `Keçid · ${sts[0].name}`, distanceM: d2(a, pts[0]) + 60, durationMin: 3, steps: [] });
      }
      legs.push({
        mode: 'metro', pts, underground: true,
        stations: sts.map((s) => ({ name: s.name, lat: r5(s.lat), lon: r5(s.lon) })),
        label: `Metro · ${sts.length - 1} dayanacaq`,
        distanceM: dist,
        durationMin: 3 + (sts.length - 1) * 2.2,
        steps: [
          { lat: pts[0][0], lon: pts[0][1], type: 'board', street: sts[0].name, dist: 0 },
          { lat: pts[pts.length - 1][0], lon: pts[pts.length - 1][1], type: 'alight', street: sts[sts.length - 1].name, dist },
        ],
      });
    }
    return { legs, hops, transfer: lf !== lt };
  }

  // ── best walk: OSRM alternatives + detours via signalised / grade-separated crossings
  async function walkCandidates(from, to) {
    const res = await osrm('foot', [from, to], { alternatives: 3 });
    const cands = res.routes.map(fromOsrm).map((r) => ({ ...r, via: null }));
    const direct = cands.reduce((a, b) => (a.distance <= b.distance ? a : b));
    // safe crossings 0–300 m off the direct line, inside its extent
    const near = [];
    for (let i = 0; i < layer.crossings.length; i++) {
      const c = layer.crossings[i];
      if (c[2] !== 0 && c[2] !== 3) continue;
      const p = [c[0], c[1]];
      if (d2(p, from) < 40 || d2(p, to) < 40) continue;
      const pr = projOnPolyline(p, direct.pts);
      if (pr.d > 300) continue;
      const detour = d2(from, p) + d2(p, to) - d2(from, to);
      if (detour > 0.6 * direct.distance) continue;
      near.push({ p, detour, off: pr.d });
    }
    near.sort((a, b) => a.detour - b.detour);
    const picked = [];
    for (const n of near) {
      if (picked.some((q) => d2(q.p, n.p) < 60)) continue;
      picked.push(n);
      if (picked.length >= 6) break;
    }
    for (const n of picked) {
      try {
        const r = fromOsrm((await osrm('foot', [from, n.p, to], { continueStraight: true })).routes[0]);
        if (r.distance <= 1.35 * direct.distance) cands.push({ ...r, via: n.p, off: n.off });
      } catch {}
    }
    for (const c of cands) c.s = score([flat(c.pts)]);
    return { cands, direct };
  }
  const better = (a, b) => b.s.night - a.s.night || b.s.day - a.s.day || a.s.unsignalized - b.s.unsignalized || b.s.signals - a.s.signals || a.distance - b.distance;
  /** short foot connector; OSRM foot sometimes snaps into station/forecourt footways and detours */
  async function footConnector(a, b) {
    const straight = d2(a, b);
    try {
      const w = fromOsrm((await osrm('foot', [a, b])).routes[0]);
      if (!(straight <= 120 && w.distance > 2 * straight + 40)) return { pts: w.pts, distance: w.distance, durationMin: (w.duration / 60) * 1.1, steps: w.steps };
    } catch {}
    return { pts: densifyPts([a, b], 3), distance: straight, durationMin: straight / WALK_M_PER_MIN, steps: [] };
  }

  // ── bus lines (real OSM route=bus relations)
  let busRels = [];
  try {
    const bj = JSON.parse(await fs.readFile(path.join(CACHE, 'bus.json'), 'utf8'));
    const npos = new Map(bj.elements.filter((e) => e.type === 'node').map((n) => [n.id, [n.lat, n.lon]]));
    busRels = bj.elements.filter((e) => e.type === 'relation').map((r) => ({
      ref: r.tags.ref ?? r.tags.name,
      stops: r.members.filter((m) => m.type === 'node' && /platform|stop/.test(m.role) && npos.has(m.ref)).map((m) => npos.get(m.ref)),
    }));
  } catch {}
  function busTrip(from, to) {
    let best = null;
    for (const r of busRels) {
      for (let i = 0; i < r.stops.length; i++) {
        const w1 = d2(from, r.stops[i]);
        if (w1 > 450) continue;
        for (let j = i + 2; j < r.stops.length; j++) {
          const w2 = d2(r.stops[j], to);
          if (w2 > 600) continue;
          const cost = w1 + w2 + (j - i) * 30;
          if (!best || cost < best.cost) best = { cost, ref: r.ref, a: r.stops[i], b: r.stops[j], n: j - i };
        }
      }
    }
    return best;
  }

  // ── leg / option assembly
  function snapEnds(legs, start, end) {
    const first = legs[0];
    if (d2(first.pts[0], start) > 8) {
      if (first.mode === 'walk') first.pts = [start, ...first.pts];
      else legs.unshift({ mode: 'walk', indoor: first.mode === 'metro', pts: densifyPts([start, first.pts[0]], 3), distanceM: d2(start, first.pts[0]), durationMin: d2(start, first.pts[0]) / WALK_M_PER_MIN + (first.mode === 'metro' ? 1 : 0), steps: [], label: first.mode === 'metro' ? 'Stansiyaya giriş' : undefined });
    }
    for (let i = 1; i < legs.length; i++) {
      const a = legs[i - 1].pts[legs[i - 1].pts.length - 1], b = legs[i].pts[0];
      if (d2(a, b) <= 8) continue;
      if (legs[i].mode === 'walk') legs[i].pts = [a, ...legs[i].pts];
      else legs[i - 1].pts = [...legs[i - 1].pts, b];
    }
    const last = legs[legs.length - 1];
    const tail = last.pts[last.pts.length - 1];
    if (d2(tail, end) > 8) {
      if (last.mode === 'walk') last.pts = [...last.pts, end];
      else legs.push({ mode: 'walk', pts: densifyPts([tail, end], 3), distanceM: d2(tail, end), durationMin: d2(tail, end) / WALK_M_PER_MIN, steps: [] });
    }
    for (const l of legs) {
      if (l.mode === 'walk') {
        l.pts = densifyPts(despur(l.pts), 3);
        l.distanceM = Math.max(l.distanceM ?? 0, lineLen(l.pts));
      }
    }
    return legs;
  }

  function assemble({ destId, kind, legs, price, s, reasons, warning, lastMeters }) {
    const steps = [];
    let acc = 0;
    legs.forEach((leg, li) => {
      for (const st of leg.steps ?? []) steps.push({ lat: r5(st.lat), lon: r5(st.lon), type: st.type, street: st.street, atM: Math.round(acc + st.dist), leg: li });
      acc += leg.distanceM;
    });
    const lastLeg = legs[legs.length - 1];
    const end = lastLeg.pts[lastLeg.pts.length - 1];
    if (!steps.some((x) => x.type === 'arrive')) steps.push({ lat: r5(end[0]), lon: r5(end[1]), type: 'arrive', atM: Math.round(acc), leg: legs.length - 1 });
    const co2 = legs.reduce((sum, l) => sum + (l.mode === 'metro' ? 20 : l.mode === 'bus' ? 70 : l.mode === 'taxi' ? 170 : 0) * (l.distanceM / 1000), 0);
    const o = {
      id: `${destId}-${kind}`,
      destId,
      kind,
      legs: legs.map((l) => {
        const out = { mode: l.mode, c: flat(l.pts), distanceM: Math.round(l.distanceM), durationMin: r1(l.durationMin) };
        if (l.label) out.label = l.label;
        if (l.underground) out.underground = true;
        if (l.stations) out.stations = l.stations;
        return out;
      }),
      durationMin: Math.round(legs.reduce((sum, l) => sum + l.durationMin, 0)),
      distanceM: Math.round(legs.reduce((sum, l) => sum + l.distanceM, 0)),
      price,
      co2g: Math.round(co2),
      scoreDay: s.day,
      scoreNight: s.night,
      avoided: 0,
      unsignalized: s.unsignalized,
      reasons,
      steps,
    };
    if (warning) o.warning = warning;
    if (lastMeters) o.lastMeters = lastMeters;
    o._s = s;
    return o;
  }
  const walkScore = (legs, extra) => score(legs.filter((l) => l.mode === 'walk' && !l.indoor).map((l) => flat(l.pts)), extra);
  const crossingWords = (s) => {
    const parts = [];
    if (s.signals) parts.push(`${s.signals} işıqforlu/yeraltı keçid`);
    parts.push(s.unsignalized ? `${s.unsignalized} işıqforsuz keçid` : 'işıqforsuz keçid yoxdur');
    return parts.join(', ');
  };
  const round10 = (m) => Math.max(10, Math.round(m / 10) * 10);

  // ── "Son 50 metr"
  async function lastMetersFor(destId, entrance, car, carJson) {
    const pts = car.pts;
    const snapped = pts[pts.length - 1];
    let k = pts.length - 2;
    while (k > 0 && d2(pts[k], snapped) < 6) k--;
    const prev = pts[k];
    const dir = xy(snapped, prev);
    const dl = Math.hypot(dir[0], dir[1]) || 1;
    const u = [dir[0] / dl, dir[1] / dl]; // travel direction (east, north)
    const right = [u[1], -u[0]];
    const e = xy(entrance, snapped);
    const side = u[0] * e[1] - u[1] * e[0] > 0 ? 'left' : 'right';
    const wpName = carJson.waypoints[carJson.waypoints.length - 1].name || '';
    // road under the drop-off
    let road = null, rd = Infinity;
    for (const r of roads) {
      const pr = projOnPolyline(snapped, r.g);
      const bonus = wpName && r.name === wpName ? -6 : 0;
      if (pr.d + bonus < rd && pr.d < 20) { rd = pr.d + bonus; road = r; }
    }
    if (!road) return null;
    const street = road.name || wpName || 'yol';
    const halfW = (road.lanes * 3.25) / 2;
    const curb = ll([right[0] * halfW, right[1] * halfW], snapped);
    const direct = d2(curb, entrance);
    // multi-lane only: >=3 lanes to cross (one-way carriageway) or >=4 (two-way road)
    const wrongSide = side === 'left' && (road.oneway ? road.lanes >= 3 : road.lanes >= 4) && direct > 8;
    if (!wrongSide) return { wrongSide: false, curb, street, road };

    // same-road polyline (all ways with this name near the drop), ordered along the travel axis
    const along = (p) => { const v = xy(p, snapped); return v[0] * u[0] + v[1] * u[1]; };
    const across = (p) => { const v = xy(p, snapped); return v[0] * right[0] + v[1] * right[1]; };
    const sameRoad = roads.filter((r) => r.name === road.name && r.g.some((p) => d2(p, snapped) < 450));
    const axisPts = [];
    for (const r of sameRoad) for (const p of r.g) if (Math.abs(across(p)) < 30 && Math.abs(along(p)) < 420) axisPts.push(p);
    axisPts.push(snapped);
    axisPts.sort((a, b) => along(a) - along(b));
    const offsetAt = (p, sgn, extra = 2) => {
      // local road direction from neighbours in axisPts
      const t = along(p);
      let i = axisPts.findIndex((q) => along(q) >= t);
      if (i < 0) i = axisPts.length - 1;
      const a = axisPts[Math.max(0, i - 1)], b = axisPts[Math.min(axisPts.length - 1, i)];
      let v = xy(b, a);
      let L = Math.hypot(v[0], v[1]);
      if (L < 1) { v = u; L = 1; }
      const dd = [v[0] / L, v[1] / L];
      const rn = [dd[1], -dd[0]];
      const w = sgn * (halfW + extra);
      // project p onto the axis line first
      const pa = xy(p, a);
      const s = pa[0] * dd[0] + pa[1] * dd[1];
      const onAxis = ll([dd[0] * s, dd[1] * s], a);
      return ll([rn[0] * w, rn[1] * w], onAxis);
    };
    const walkSide = (t0, t1, sgn) => {
      const lo = Math.min(t0, t1), hi = Math.max(t0, t1);
      const mids = axisPts.filter((p) => along(p) > lo + 3 && along(p) < hi - 3);
      if (t1 < t0) mids.reverse();
      return mids.map((p) => offsetAt(p, sgn));
    };
    // crossing facility already on the direct line?
    const onLine = [];
    for (const c of layer.crossings) {
      const pr = projOnPolyline([c[0], c[1]], [curb, entrance]);
      if (pr.d < 12) onLine.push(c);
    }
    const directSafe = onLine.find((c) => c[2] === 0 || c[2] === 3);
    const directMarked = onLine.find((c) => c[2] === 1);

    // safe alternatives: signalised / grade-separated crossings on this road within 350 m
    const cands = [];
    for (const c of layer.crossings) {
      if (c[2] !== 0 && c[2] !== 3) continue;
      const p = [c[0], c[1]];
      if (d2(p, snapped) > 350) continue;
      if (Math.abs(across(p)) > (c[2] === 3 ? 28 : 18)) continue;
      const t = along(p);
      const pathPts = [curb, ...walkSide(0, t, +1), offsetAt(p, +1), offsetAt(p, -1), ...walkSide(t, along(entrance), -1), entrance];
      cands.push({ c, t, pts: pathPts, len: lineLen(pathPts) });
    }
    cands.sort((a, b) => a.len - b.len);
    const best = directSafe ? null : cands[0];
    const directC = densifyPts([curb, entrance], 3);
    const safePts = best ? best.pts : directC;
    const extraM = best ? Math.max(0, Math.round(best.len - direct)) : 0;

    // better drop-off on the entrance side: OSRM car to the building / curb-approach, plus
    // geometric curb projections on nearby roads where the entrance is on the car's right
    const drops = [];
    const tryDrop = (p, label) => {
      if (d2(p, entrance) > 220) return;
      if (roadsCrossed(roads, p, entrance).length) return;
      drops.push({ p, label, d: d2(p, entrance) });
    };
    for (const target of [BUILDING[destId], entrance].filter(Boolean)) {
      try {
        const j = await osrm('car', [[ORIGIN.lat, ORIGIN.lon], target], { approaches: ['unrestricted', 'curb'] });
        const r = fromOsrm(j.routes[0]);
        const end = r.pts[r.pts.length - 1];
        const named = [...r.steps].reverse().find((s) => s.street)?.street;
        const wp = j.waypoints[j.waypoints.length - 1].name;
        tryDrop(end, wp ? `${wp}, giriş tərəfi` : `Həyət girişi · ${named ?? street}`);
      } catch {}
    }
    for (const r of roads) {
      if (r.id === road.id) continue;
      const pr = projOnPolyline(entrance, r.g);
      if (pr.d > 160 || !pr.q) continue;
      const a = r.g[pr.i - 1], b = r.g[pr.i];
      const v = xy(b, a), L = Math.hypot(v[0], v[1]) || 1;
      let dd = [v[0] / L, v[1] / L];
      const ev = xy(entrance, pr.q);
      const leftOf = dd[0] * ev[1] - dd[1] * ev[0] > 0;
      if (leftOf) {
        if (r.oneway) continue; // one-way: the curb on the entrance side is not where the car stops
        dd = [-dd[0], -dd[1]];
      }
      const rn = [dd[1], -dd[0]];
      const w = (r.lanes * 3.25) / 2;
      const c2 = ll([rn[0] * w, rn[1] * w], pr.q);
      tryDrop(c2, `${r.name || 'yol'}, giriş tərəfi`);
    }
    drops.sort((a, b) => a.d - b.d);
    const betterDrop = drops[0] ? { lat: r5(drops[0].p[0]), lon: r5(drops[0].p[1]), label: drops[0].label } : undefined;

    // virtual crossing for the direct line (no facility = unmarked, scored with the layer's rule)
    const vs = directSafe
      ? null
      : crossingScore({ type: directMarked ? 1 : T_UNMARKED, lanes: road.lanes, speed: road.speed, lit: road.lit, lanesVerified: road.lanesVerified });
    const mid = [(curb[0] + entrance[0]) / 2, (curb[1] + entrance[1]) / 2];
    const virtual = vs ? [r5(mid[0]), r5(mid[1]), directMarked ? 1 : 2, vs.day, vs.night, road.lanes, -1, -1] : null;

    const facWord = directSafe ? 'işıqforlu keçid' : directMarked ? 'işıqforsuz zebra' : 'işıqforsuz, keçid yoxdur';
    let note = `Taksi səni ${genitive(street)} qarşı tərəfində düşürür: ${road.lanes} zolaq, ${facWord}.`;
    if (best) {
      const kind = best.c[2] === 3 ? 'Yeraltı keçid' : 'İşıqforlu keçid';
      // standing on the curb facing the road, the car's direction of travel is to your right
      note += ` ${kind} ${round10(Math.abs(best.t))} m ${best.t >= 0 ? 'sağdadır' : 'soldadır'}.`;
    }
    const lm = {
      drop: { lat: r5(curb[0]), lon: r5(curb[1]) },
      street,
      lanes: road.lanes,
      wrongSide: true,
      directC: flat(directC),
      safeC: flat(safePts),
      crossing: best ? { lat: best.c[0], lon: best.c[1], type: best.c[2] } : directSafe ? { lat: directSafe[0], lon: directSafe[1], type: directSafe[2] } : null,
      extraM,
      extraMin: extraM ? Math.max(1, Math.round(extraM / WALK_M_PER_MIN)) : 0,
      note,
    };
    if (betterDrop) lm.betterDrop = betterDrop;
    return { wrongSide: true, curb, street, road, lm, virtual, directPts: directC, directScore: vs };
  }

  // ───────────────────────────────────────── per destination
  const origin = [ORIGIN.lat, ORIGIN.lon];
  const options = {};
  const destCoords = {};
  const lmLog = [];
  for (const d of DESTINATIONS) {
    const destId = d.id;
    const dest = [d.lat, d.lon];
    destCoords[destId] = { lat: d.lat, lon: d.lon };
    process.stdout.write(`${destId}: `);
    const direct = Math.round(d2(origin, dest));

    // ---------- SAFEST (metro + best walk, or best walk)
    const near = allMetro
      .map((n) => ({ n, s: station(n), dist: d2(dest, [station(n).lat, station(n).lon]) }))
      .sort((a, b) => a.dist - b.dist)[0];
    let safest;
    let cheapestWalk = null;
    if (near && near.dist < 950 && !['28 May', 'Cəfər Cabbarlı'].includes(near.n)) {
      const m = metroLegs('28 May', near.n);
      const legs = [...m.legs];
      const stationPt = legs[legs.length - 1].pts[legs[legs.length - 1].pts.length - 1];
      let w = null;
      if (d2(stationPt, dest) > 40) {
        const ex = await bestExit(stationPt, dest);
        const from = ex ? ex.p : stationPt;
        if (ex) legs.push(indoorLeg(stationPt, ex.p, `Çıxış · ${ex.name ?? near.n}`));
        if (d2(from, dest) > 15) {
          const { cands } = await walkCandidates(from, dest);
          w = cands.sort(better)[0];
          legs.push({ mode: 'walk', pts: w.pts, distanceM: w.distance, durationMin: (w.duration / 60) * 1.1, steps: w.steps });
        }
      }
      snapEnds(legs, origin, dest);
      const s = walkScore(legs);
      const walkM = legs.filter((l) => l.mode === 'walk' && !l.indoor).reduce((a, l) => a + l.distanceM, 0);
      safest = assemble({
        destId, kind: 'safest', legs, price: '0,60 ₼', s,
        reasons: [
          `Metro: ${m.hops} dayanacaq${m.transfer ? ', 1 keçid' : ''}`,
          walkM >= 40 ? `Cəmi ${round10(walkM)} m piyada` : 'Stansiyadan birbaşa çıxış',
          crossingWords(s),
        ],
      });
      safest._metro = near.n;
    } else {
      const { cands, direct: dw } = await walkCandidates(origin, dest);
      cheapestWalk = dw;
      const sorted = [...cands].sort(better);
      let w = sorted[0];
      // never present the same line twice: prefer an equally good alternative that differs
      if (samePts(w.pts, dw.pts)) w = sorted.find((c) => !samePts(c.pts, dw.pts) && c.s.night >= dw.s.night) ?? w;
      const legs = snapEnds([{ mode: 'walk', pts: w.pts, distanceM: w.distance, durationMin: (w.duration / 60) * 1.1, steps: w.steps }], origin, dest);
      const s = walkScore(legs);
      safest = assemble({
        destId, kind: 'safest', legs, price: '0 ₼', s,
        reasons: [crossingWords(s), w.via ? 'İşıqforlu keçiddən keçir' : 'Ən az riskli piyada xətti', `${round10(lineLen(w.pts))} m piyada`],
      });
    }

    // ---------- CHEAPEST
    let cheapest;
    if (direct <= 2600) {
      const dw = cheapestWalk ?? (await walkCandidates(origin, dest)).direct;
      const legs = snapEnds([{ mode: 'walk', pts: dw.pts, distanceM: dw.distance, durationMin: dw.duration / 60, steps: dw.steps }], origin, dest);
      const s = walkScore(legs);
      cheapest = assemble({
        destId, kind: 'cheapest', legs, price: '0 ₼', s,
        reasons: ['Pulsuz, birbaşa piyada', `${round10(dw.distance)} m`],
        warning: s.unsignalized ? `${s.unsignalized} işıqforsuz keçid${s.riskyNight ? ' · gecə riskli' : ''}` : undefined,
      });
    } else {
      const bt = busTrip(origin, dest);
      if (!bt && direct <= 4000) {
        const dw = (await walkCandidates(origin, dest)).direct;
        const legs = snapEnds([{ mode: 'walk', pts: dw.pts, distanceM: dw.distance, durationMin: dw.duration / 60, steps: dw.steps }], origin, dest);
        const s = walkScore(legs);
        cheapest = assemble({
          destId, kind: 'cheapest', legs, price: '0 ₼', s,
          reasons: ['Pulsuz, birbaşa piyada', `${round10(dw.distance)} m`],
          warning: s.unsignalized ? `${s.unsignalized} işıqforsuz keçid${s.riskyNight ? ' · gecə riskli' : ''}` : undefined,
        });
      } else if (bt) {
        const w1 = fromOsrm((await osrm('foot', [origin, bt.a])).routes[0]);
        const bus = fromOsrm((await osrm('car', [bt.a, bt.b])).routes[0]);
        const w2 = fromOsrm((await osrm('foot', [bt.b, dest])).routes[0]);
        const legs = snapEnds([
          { mode: 'walk', pts: w1.pts, distanceM: w1.distance, durationMin: w1.duration / 60, steps: w1.steps },
          { mode: 'bus', pts: bus.pts, label: `Avtobus ${bt.ref}`, distanceM: bus.distance, durationMin: (bus.duration / 60) * 1.9 + 6,
            steps: [{ lat: bt.a[0], lon: bt.a[1], type: 'board', street: `Avtobus ${bt.ref}`, dist: 0 }, { lat: bt.b[0], lon: bt.b[1], type: 'alight', street: 'Dayanacaq', dist: bus.distance }] },
          { mode: 'walk', pts: w2.pts, distanceM: w2.distance, durationMin: w2.duration / 60, steps: w2.steps },
        ], origin, dest);
        const s = walkScore(legs);
        cheapest = assemble({
          destId, kind: 'cheapest', legs, price: '0,60 ₼', s,
          reasons: [`Avtobus ${bt.ref} · ${bt.n} dayanacaq`, `${round10(w1.distance + w2.distance)} m piyada`],
          warning: `${s.unsignalized ? s.unsignalized + ' işıqforsuz keçid · ' : ''}gözləmə 8–12 dəq`,
        });
      } else {
        // no single bus line: the cheapest real option is the metro trip itself, walked the shortest way
        const m = metroLegs('28 May', near.n);
        const legs = [...m.legs];
        const st = legs[legs.length - 1].pts.at(-1);
        const dw = (await walkCandidates(st, dest)).direct;
        legs.push({ mode: 'walk', pts: dw.pts, distanceM: dw.distance, durationMin: dw.duration / 60, steps: dw.steps });
        snapEnds(legs, origin, dest);
        const s = walkScore(legs);
        cheapest = assemble({ destId, kind: 'cheapest', legs, price: '0,60 ₼', s, reasons: [`Metro: ${m.hops} dayanacaq`, 'Ən qısa piyada hissə'] });
      }
    }

    // ---------- FASTEST (taxi)
    // pickup: from the origin pin or one of its station exits, whichever gives the shortest total time
    let pick = null;
    for (const st of [{ p: origin, name: null }, ...exitsNear(origin, 150)]) {
      const cj = await osrm('car', [st.p, dest]);
      const cr = fromOsrm(cj.routes[0]);
      const pu = cr.pts[0];
      let w = null;
      if (d2(st.p, pu) > 8) w = await footConnector(st.p, pu);
      const cost = (w ? w.distance / WALK_M_PER_MIN : 0) + (st.name ? d2(origin, st.p) / 60 : 0) + (cr.duration / 60) * 1.3;
      if (!pick || cost < pick.cost) pick = { cost, st, carJson: cj, car: cr, w };
    }
    const { carJson, car } = pick;
    const km = car.distance / 1000;
    const lo = Math.max(3, Math.round(2.4 + km * 0.85));
    const legs = [];
    if (pick.st.name) legs.push(indoorLeg(origin, pick.st.p, `Çıxış · ${pick.st.name}`));
    if (pick.w) legs.push({ mode: 'walk', pts: pick.w.pts, distanceM: pick.w.distance, durationMin: pick.w.durationMin, steps: pick.w.steps.filter((x) => x.type !== 'arrive') });
    legs.push({ mode: 'taxi', pts: car.pts, label: 'Taksi · təxmini', distanceM: car.distance, durationMin: (car.duration / 60) * 1.3 + 3, steps: car.steps.filter((x) => x.type !== 'arrive') });
    const lmr = await lastMetersFor(destId, dest, car, carJson);
    let extra = [];
    let lastMeters;
    if (lmr?.wrongSide) {
      // the taxi stops at its right curb: the default last walk is the direct line across the road
      legs[legs.length - 1].pts = [...car.pts, lmr.curb];
      legs.push({ mode: 'walk', pts: lmr.directPts, distanceM: d2(lmr.directPts[0], dest), durationMin: d2(lmr.directPts[0], dest) / WALK_M_PER_MIN + 0.5, steps: [{ lat: lmr.curb[0], lon: lmr.curb[1], type: 'depart', street: lmr.street, dist: 0 }] });
      if (lmr.virtual) extra = [lmr.virtual];
      lastMeters = lmr.lm;
      lmLog.push(`${destId}: ${lmr.lm.note} (+${lmr.lm.extraM} m${lmr.lm.betterDrop ? `, better drop: ${lmr.lm.betterDrop.label} ${Math.round(d2([lmr.lm.betterDrop.lat, lmr.lm.betterDrop.lon], dest))} m` : ''})`);
    } else {
      const tail = car.pts[car.pts.length - 1];
      if (d2(tail, dest) > 8) {
        const w = await footConnector(tail, dest);
        legs.push({ mode: 'walk', pts: w.pts, distanceM: w.distance, durationMin: w.durationMin, steps: w.steps });
      }
    }
    snapEnds(legs, origin, dest);
    const fs_ = walkScore(legs, extra);
    const fastest = assemble({
      destId, kind: 'fastest', legs, price: `${lo}–${lo + 2} ₼`, s: fs_,
      reasons: ['Qapıdan qapıya ən az piyada', 'Qiymət tarif modeli ilə təxminidir'],
      warning: lastMeters
        ? `Qarşı tərəfdə düşürür · ${lastMeters.lanes} zolaq`
        : fs_.unsignalized
          ? `${fs_.unsignalized} işıqforsuz keçid piyada hissədə`
          : undefined,
      lastMeters,
    });

    const all = [safest, cheapest, fastest];
    safest.avoided = Math.max(0, Math.max(cheapest._s.riskyNight, fastest._s.riskyNight + (lastMeters ? 1 : 0)) - safest._s.riskyNight);
    const meta = safest._metro;
    for (const o of all) { delete o._s; delete o._metro; }
    options[destId] = all;
    console.log(`direct ${direct}m · safest ${safest.durationMin}′ ${safest.scoreDay}/${safest.scoreNight}${meta ? ' via ' + meta : ''} · cheapest ${cheapest.durationMin}′ ${cheapest.scoreDay}/${cheapest.scoreNight} · fastest ${fastest.durationMin}′ ${fastest.scoreDay}/${fastest.scoreNight}${lastMeters ? ' · LAST50' : ''}`);
  }
  for (const l of lmLog) console.log('  ' + l);

  // ---------- SCOOTER: seafront (headwind) vs calm inner streets
  const sFrom = [40.36619, 49.83947];
  const sTo = [40.37565, 49.85969];
  const seaR = fromOsrm((await osrm('bike', [sFrom, [40.3693, 49.8512], sTo], { continueStraight: true })).routes[0]);
  const calmR = fromOsrm((await osrm('bike', [sFrom, [40.3741, 49.8424], [40.3772, 49.8521], sTo], { continueStraight: true })).routes[0]);
  const scooter = {
    from: { lat: sFrom[0], lon: sFrom[1], name: 'Dənizkənarı Bulvar' },
    to: { lat: sTo[0], lon: sTo[1], name: 'Port Baku' },
    seafront: { c: flat(seaR.pts), distanceM: Math.round(seaR.distance), durationMin: Math.round((seaR.distance / 1000 / 14) * 60) },
    calm: { c: flat(calmR.pts), distanceM: Math.round(calmR.distance), durationMin: Math.round((calmR.distance / 1000 / 15) * 60) },
  };
  console.log(`scooter: seafront ${scooter.seafront.distanceM}m, calm ${scooter.calm.distanceM}m`);

  // ---------- ACCESSIBLE: Nizami m. -> Hilton (step-free)
  const niz = station('Nizami');
  const sah = station('Sahil');
  const hil = DESTINATIONS.find((x) => x.id === 'hilton');
  const aHome = [r5(niz.lat + 0.0012), r5(niz.lon - 0.0016)];
  const a1 = fromOsrm((await osrm('foot', [aHome, [niz.lat, niz.lon]])).routes[0]);
  const am = metroLegs('Nizami', 'Sahil');
  const a2 = fromOsrm((await osrm('foot', [[sah.lat, sah.lon], [hil.lat, hil.lon]])).routes[0]);
  const aLegs = snapEnds([
    { mode: 'walk', pts: a1.pts, distanceM: a1.distance, durationMin: 0, steps: [] },
    ...am.legs,
    { mode: 'walk', pts: a2.pts, distanceM: a2.distance, durationMin: 0, steps: [] },
  ], aHome, [hil.lat, hil.lon]);
  const accessible = {
    from: { lat: aHome[0], lon: aHome[1] },
    legs: aLegs.map((l) => {
      const o = { mode: l.mode, c: flat(l.pts), distanceM: Math.round(l.distanceM) };
      if (l.underground) o.underground = true;
      if (l.stations) o.stations = l.stations;
      if (l.label) o.label = l.label;
      return o;
    }),
    stations: am.legs.filter((l) => l.stations).flatMap((l, i) => l.stations.map((s) => s.name).slice(i ? 1 : 0)),
  };

  // ---------- FAMILY: Murad's school route, Nənə's walk home (Nərimanov)
  const home = [40.40118, 49.86352];
  const school = [40.40483, 49.87021];
  const market = [40.39581, 49.85622];
  const fm = fromOsrm((await osrm('foot', [home, school])).routes[0]);
  const fn = fromOsrm((await osrm('foot', [market, home])).routes[0]);
  const family = {
    home: { lat: home[0], lon: home[1] },
    school: { lat: school[0], lon: school[1] },
    murad: { c: flat(fm.pts), distanceM: Math.round(fm.distance) },
    nene: { c: flat(fn.pts), distanceM: Math.round(fn.distance) },
  };

  const out = {
    v: 2,
    generated: new Date().toISOString(),
    model: 'hara-irap-lite-1',
    origin: { lat: ORIGIN.lat, lon: ORIGIN.lon, name: ORIGIN.name },
    destCoords,
    options,
    scooter,
    accessible,
    family,
  };
  await fs.writeFile(OUT, JSON.stringify(out));
  console.log(`metro hops: ${metroReal} on real tunnel geometry, ${metroFallback} straight fallback`);
  console.log(`wrote ${OUT} (${((await fs.stat(OUT)).size / 1024).toFixed(0)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
