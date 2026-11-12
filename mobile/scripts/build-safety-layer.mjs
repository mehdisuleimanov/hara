// Dev-time only: turns cached OpenStreetMap data into the app's "Bakı Təhlükəsizlik Qatı"
// (src/data/safety-layer.json). Usage: node scripts/build-safety-layer.mjs
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// SCORING MODEL (iRAP-inspired, deterministic — every point comes from an OSM attribute)
// Scores are 0–100, higher = lower pedestrian risk. 75+ lower risk · 55–74 moderate · <55 high.
// It is a transparent rule-based prior in the spirit of iRAP Star Rating for pedestrians
// (crossing facility, lanes to cross, operating speed, sidewalk provision, street lighting,
// vulnerable users nearby). It is NOT a calibrated crash model; weights are documented below.
//
// Inputs per crossing (OSM): crossing facility (node tags + `footway=crossing` way tags +
// traffic-signal nodes ≤20 m on the same road), crossed road class / `lanes` / `maxspeed` /
// `lit`, refuge island (`crossing:island`), street lamps ≤30 m, bus stops ≤30 m, schools /
// kindergartens ≤150 m, distance to the nearest signalised / grade-separated crossing.
//
// Missing data is treated conservatively ("no data = risky"):
//   lanes missing   → class default rounded UP (trunk 6/3 one-way, primary 4/3, secondary 4/2,
//                     tertiary 2) and −2 "unverified"
//   maxspeed missing→ class default (trunk 70, primary/secondary 60, tertiary 50, residential 40)
//   lit missing     → night penalty sits between lit=yes and lit=no (unless a street lamp ≤30 m)
//   crossing type   → an untyped `highway=crossing` counts as UNMARKED
//   no public road  → crossing on a service road / parking aisle: 2 lanes, 30 km/h, unverified
//
// CROSSING  day = BASE[facility]
//                 − LANE_W[f] × max(0, lanes − 2)          exposure time in the carriageway
//                 − SPEED_W[f] × max(0, speed − 30)         WHO/iRAP: fatality risk climbs fast >30 km/h
//                 + ISLAND[f] (refuge island = two-stage crossing)
//                 − 4 bus stop ≤30 m (buses mask pedestrians)   [unsignalised only]
//                 − 4/5 school/kindergarten ≤150 m (children)    [unsignalised only]
//                 − 3 nearest signalised/grade-separated crossing >250 m on a ≥4-lane road
//                 − 2 lanes unverified
//           night = day − NIGHT[f][lit]
//   facility       BASE  LANE_W SPEED_W ISLAND  NIGHT lit=yes / unknown / no
//   grade-sep.      92     0      0       0          3     /   6     /  12   (personal security)
//   signals         88     1.5    0.15    2          3     /   6     /  14
//   zebra           74     5      0.45    6          6     /  12     /  22
//   unmarked        64     6      0.55    5          8     /  14     /  24
//
// SEGMENT (walking along a road)
//   base = 90 sidewalk mapped · 50 sidewalk=no on ≥40 km/h roads (72 on low-speed streets) ·
//          unknown: 94 pedestrian street, 88 living street, 82 residential/unclassified, 80 other
//   day  = base − 0.25 × max(0, speed − 30) − 2 × max(0, lanes − 2)
//   night= day − (lit=yes or lamp ≤25 m: 3 · lit=no: 25 · unknown: 8 trunk/primary, 10 secondary/
//          tertiary, 16 residential & smaller)
// All scores clamped to [5, 97]. Route-level (weakest-link) scoring lives in
// src/features/routing/scoring.ts and is shared by the build scripts and on-device live routing.
// ─────────────────────────────────────────────────────────────────────────────────────────────
//
// Output tuples (src/data/layer.ts):
//   crossings: [lat, lon, type, day, night, lanes, roadBearingDeg, nameIdx]
//              type 0 signals · 1 zebra · 2 unmarked · 3 grade-separated (underpass/footbridge)
//   segments:  { k: class 0 trunk … 5 pedestrian, d, n, c: flat [lat,lon,…] }
//   names:     street names referenced by crossings[7] (−1 = unnamed)
import fs from 'node:fs/promises';
import path from 'node:path';
import { F, DEFAULT_SPEED, T_SIGNALS, T_ZEBRA, T_UNMARKED, T_GRADE, crossingScore } from './lib/irap.mjs';

const CACHE = path.resolve('scripts/.cache');
const OUT = path.resolve('src/data/safety-layer.json');

const CLASS_CODE = {
  trunk: 0, trunk_link: 0, primary: 1, primary_link: 1, secondary: 2, secondary_link: 2,
  tertiary: 3, tertiary_link: 3, unclassified: 4, residential: 4, living_street: 5, pedestrian: 5,
};
const CLASS_RANK = { trunk: 9, trunk_link: 8, primary: 7, primary_link: 6, secondary: 5, secondary_link: 4, tertiary: 3, tertiary_link: 3, unclassified: 2, residential: 2, living_street: 1, pedestrian: 0 };


const r5 = (v) => Math.round(v * 1e5) / 1e5;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const toRad = (d) => (d * Math.PI) / 180;

function hav(aLat, aLon, bLat, bLon) {
  const R = 6371000, dLat = toRad(bLat - aLat), dLon = toRad(bLon - aLon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
/** bearing a→b in degrees folded to [0,180) (road axis, direction-less) */
function axis(aLat, aLon, bLat, bLon) {
  const dy = bLat - aLat, dx = (bLon - aLon) * Math.cos(toRad(aLat));
  let b = (Math.atan2(dx, dy) * 180) / Math.PI;
  b = ((b % 180) + 180) % 180;
  return Math.round(b);
}

/** point grid for radius queries */
function pointIndex(items, cell = 0.001) {
  const g = new Map();
  for (const it of items) {
    const k = `${Math.floor(it.lat / cell)}:${Math.floor(it.lon / cell)}`;
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(it);
  }
  return {
    near(lat, lon, r) {
      const span = Math.ceil(r / (cell * 85000));
      const ci = Math.floor(lat / cell), cj = Math.floor(lon / cell);
      const out = [];
      for (let i = -span; i <= span; i++) for (let j = -span; j <= span; j++)
        for (const it of g.get(`${ci + i}:${cj + j}`) ?? []) {
          const d = hav(lat, lon, it.lat, it.lon);
          if (d <= r) out.push({ it, d });
        }
      return out.sort((a, b) => a.d - b.d);
    },
  };
}

// Douglas-Peucker in local meters
function simplify(pts, tol) {
  if (pts.length <= 2) return pts;
  const lat0 = toRad(pts[0].lat);
  const xy = pts.map((p) => [p.lon * 111320 * Math.cos(lat0), p.lat * 110540]);
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0, idx = -1;
    const [ax, ay] = xy[a], [bx, by] = xy[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * xy[i][0] - dx * xy[i][1] + bx * ay - by * ax) / len;
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/** distance from p to segment a-b in meters + projected point */
function distToSeg(lat, lon, a, b) {
  const k = Math.cos(toRad(lat));
  const ax = (a.lon - lon) * 111320 * k, ay = (a.lat - lat) * 110540;
  const bx = (b.lon - lon) * 111320 * k, by = (b.lat - lat) * 110540;
  const dx = bx - ax, dy = by - ay;
  const L = dx * dx + dy * dy || 1e-9;
  const t = clamp(-(ax * dx + ay * dy) / L, 0, 1);
  return Math.hypot(ax + t * dx, ay + t * dy);
}

const isOneway = (t) => t?.oneway === 'yes' || t?.oneway === '1' || t?.junction === 'roundabout';
function roadLanes(t, cls) {
  const l = parseInt(t?.lanes, 10);
  if (Number.isFinite(l) && l > 0) return { lanes: l, verified: true };
  const ow = isOneway(t);
  const def = { trunk: ow ? 3 : 6, trunk_link: ow ? 2 : 3, primary: ow ? 3 : 4, primary_link: 2, secondary: ow ? 2 : 4, secondary_link: 2 }[cls] ?? 2;
  return { lanes: def, verified: false };
}
function roadSpeed(t, cls) {
  const m = parseInt(t?.maxspeed, 10);
  return Number.isFinite(m) && m > 0 ? m : DEFAULT_SPEED[cls] ?? 50;
}
const SIDEWALK_YES = new Set(['both', 'left', 'right', 'yes', 'separate']);
function sidewalkOf(t) {
  const v = t?.sidewalk ?? t?.['sidewalk:both'];
  if (v) return v === 'no' || v === 'none' ? 'no' : SIDEWALK_YES.has(v) ? 'yes' : 'unknown';
  if (SIDEWALK_YES.has(t?.['sidewalk:left']) || SIDEWALK_YES.has(t?.['sidewalk:right'])) return 'yes';
  if (t?.['sidewalk:left'] === 'no' && t?.['sidewalk:right'] === 'no') return 'no';
  return 'unknown';
}

async function main() {
  const files = (await fs.readdir(CACHE)).filter((f) => f.startsWith('tile-'));
  const nodes = new Map();
  const ways = new Map();
  for (const f of files) {
    const json = JSON.parse(await fs.readFile(path.join(CACHE, f), 'utf8'));
    for (const el of json.elements) {
      if (el.type === 'node') nodes.set(el.id, el);
      else if (el.type === 'way') ways.set(el.id, el);
    }
  }
  const extras = JSON.parse(await fs.readFile(path.join(CACHE, 'extras.json'), 'utf8')).elements;
  const sJson = JSON.parse(await fs.readFile(path.join(CACHE, 'stations.json'), 'utf8'));
  console.log(`raw: ${nodes.size} nodes, ${ways.size} ways from ${files.length} tiles, ${extras.length} extras`);

  const pos = (e) => (e.center ? { lat: e.center.lat, lon: e.center.lon } : e.lat != null ? { lat: e.lat, lon: e.lon } : null);
  const lamps = pointIndex(extras.filter((e) => e.tags?.highway === 'street_lamp').map(pos));
  const schools = pointIndex(extras.filter((e) => /^(school|kindergarten)$/.test(e.tags?.amenity ?? '')).map(pos).filter(Boolean));
  const busStops = pointIndex(sJson.elements.filter((e) => e.tags?.highway === 'bus_stop').map(pos));
  const crossingWays = extras.filter((e) => e.type === 'way' && e.tags?.footway === 'crossing' && e.center);
  const footbridges = extras.filter((e) => e.type === 'way' && e.tags?.bridge === 'yes' && e.tags?.highway === 'footway' && e.center);

  // ---- road ways: per-node membership + segment index for nearest-road lookups
  const names = [];
  const nameIdx = new Map();
  const nameOf = (t) => {
    const n = t?.['name:az'] ?? t?.name;
    if (!n) return -1;
    if (!nameIdx.has(n)) { nameIdx.set(n, names.length); names.push(n); }
    return nameIdx.get(n);
  };
  const roadInfo = (w) => {
    const cls = w.tags.highway;
    const { lanes, verified } = roadLanes(w.tags, cls);
    return { w, cls, lanes, lanesVerified: verified, speed: roadSpeed(w.tags, cls), lit: w.tags.lit === 'yes' ? 'yes' : w.tags.lit === 'no' ? 'no' : 'unknown', name: nameOf(w.tags) };
  };
  const nodeRoads = new Map();
  const roadSegs = []; // {a,b,info}
  const segments = [];
  const tunnels = [];
  for (const w of ways.values()) {
    const cls = w.tags?.highway;
    if (cls === 'footway') {
      if (w.geometry?.length) tunnels.push(w);
      continue;
    }
    if (!(cls in CLASS_CODE) || !w.geometry?.length) continue;
    const info = roadInfo(w);
    if (cls !== 'pedestrian' && cls !== 'living_street') {
      (w.nodes ?? []).forEach((nid, i) => {
        if (!nodeRoads.has(nid)) nodeRoads.set(nid, []);
        nodeRoads.get(nid).push({ info, i });
      });
      for (let i = 1; i < w.geometry.length; i++) roadSegs.push({ a: w.geometry[i - 1], b: w.geometry[i], info });
    }

    // ---- segment score (walking along)
    const sw = sidewalkOf(w.tags);
    let base;
    if (sw === 'yes') base = 90;
    else if (sw === 'no') base = info.speed >= 40 ? 50 : 72;
    else base = cls === 'pedestrian' ? 94 : cls === 'living_street' ? 88 : cls === 'residential' || cls === 'unclassified' ? 82 : 80;
    const day = clamp(base - 0.25 * Math.max(0, info.speed - 30) - 2 * Math.max(0, info.lanes - 2), 5, 97);
    const mid = w.geometry[Math.floor(w.geometry.length / 2)];
    let lit = info.lit;
    if (lit === 'unknown' && lamps.near(mid.lat, mid.lon, 25).length) lit = 'yes';
    const major = cls.startsWith('trunk') || cls.startsWith('primary');
    const minor = cls.startsWith('secondary') || cls.startsWith('tertiary');
    const nightPen = lit === 'yes' ? 3 : lit === 'no' ? 25 : major ? 8 : minor ? 10 : 16;
    const simp = simplify(w.geometry, 4);
    const c = [];
    for (const p of simp) c.push(r5(p.lat), r5(p.lon));
    segments.push({ k: CLASS_CODE[cls], d: Math.round(day), n: Math.round(clamp(day - nightPen, 5, 97)), c });
  }
  // grid over road segments
  const RS_CELL = 0.002;
  const rsGrid = new Map();
  roadSegs.forEach((s, i) => {
    const i0 = Math.floor(Math.min(s.a.lat, s.b.lat) / RS_CELL), i1 = Math.floor(Math.max(s.a.lat, s.b.lat) / RS_CELL);
    const j0 = Math.floor(Math.min(s.a.lon, s.b.lon) / RS_CELL), j1 = Math.floor(Math.max(s.a.lon, s.b.lon) / RS_CELL);
    for (let a = i0; a <= i1; a++) for (let b = j0; b <= j1; b++) {
      const k = `${a}:${b}`;
      if (!rsGrid.has(k)) rsGrid.set(k, []);
      rsGrid.get(k).push(i);
    }
  });
  /** most exposed road within r meters of a point (for crossings not on a road node) */
  const nearestRoad = (lat, lon, r = 14) => {
    const ci = Math.floor(lat / RS_CELL), cj = Math.floor(lon / RS_CELL);
    let best = null;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++)
      for (const i of rsGrid.get(`${ci + a}:${cj + b}`) ?? []) {
        const s = roadSegs[i];
        const d = distToSeg(lat, lon, s.a, s.b);
        if (d > r) continue;
        const rank = CLASS_RANK[s.info.cls] * 10 + s.info.lanes - d / 10;
        if (!best || rank > best.rank) best = { s, d, rank };
      }
    return best && { info: best.s.info, bearing: axis(best.s.a.lat, best.s.a.lon, best.s.b.lat, best.s.b.lon) };
  };
  /** most exposed road through an OSM node */
  const roadAtNode = (n) => {
    const list = nodeRoads.get(n.id);
    if (!list?.length) return nearestRoad(n.lat, n.lon);
    list.sort((x, y) => CLASS_RANK[y.info.cls] - CLASS_RANK[x.info.cls] || y.info.lanes - x.info.lanes);
    const { info, i } = list[0];
    const g = info.w.geometry;
    const a = g[Math.max(0, i - 1)], b = g[Math.min(g.length - 1, i + 1)];
    return { info, bearing: axis(a.lat, a.lon, b.lat, b.lon) };
  };

  // ---- traffic signals (per node, with the road they sit on)
  const signalPts = pointIndex([...nodes.values()].filter((n) => n.tags?.highway === 'traffic_signals').map((n) => ({ lat: n.lat, lon: n.lon, id: n.id })));

  // ---- candidate crossings: OSM crossing nodes, upgraded/extended by `footway=crossing` ways
  const cand = [];
  for (const n of nodes.values()) {
    const t = n.tags ?? {};
    const isCrossing = t.highway === 'crossing' || (t.crossing && t.highway !== 'traffic_signals') || (t.highway === 'traffic_signals' && t.crossing);
    if (!isCrossing || t.crossing === 'no') continue;
    cand.push({ lat: n.lat, lon: n.lon, tags: { ...t }, node: n });
  }
  const candIdx = pointIndex(cand);
  let upgraded = 0, added = 0;
  for (const cw of crossingWays) {
    const t = cw.tags;
    if (t.tunnel === 'yes' || t.bridge === 'yes' || t.layer === '-1') continue; // grade separated, handled below
    const hit = candIdx.near(cw.center.lat, cw.center.lon, 14)[0]?.it;
    if (hit) {
      // fill missing facility info from the crossing way
      for (const k of ['crossing', 'crossing:signals', 'crossing:markings', 'crossing:island', 'crossing_ref', 'lit']) if (t[k] && !hit.tags[k]) { hit.tags[k] = t[k]; upgraded++; }
    } else {
      cand.push({ lat: cw.center.lat, lon: cw.center.lon, tags: { ...t }, node: null });
      added++;
    }
  }

  const crossings = [];
  const facility = (c, road) => {
    const t = c.tags;
    if (t.crossing === 'traffic_signals' || t.highway === 'traffic_signals' || t['crossing:signals'] === 'yes' || ['pelican', 'toucan', 'puffin', 'pegasus'].includes(t.crossing_ref)) return T_SIGNALS;
    // a vehicle signal ≤20 m on the same road controls the crossing too
    for (const { it, d } of signalPts.near(c.lat, c.lon, 20)) {
      const rs = nodeRoads.get(it.id);
      if (!road || !rs || rs.some((x) => x.info.w.id === road.info.w.id) || d < 12) return T_SIGNALS;
    }
    if (['marked', 'zebra', 'uncontrolled'].includes(t.crossing) || t.crossing_ref === 'zebra' || (t['crossing:markings'] && t['crossing:markings'] !== 'no')) return T_ZEBRA;
    return T_UNMARKED;
  };

  const pre = cand.map((c) => {
    const road = c.node ? roadAtNode(c.node) : nearestRoad(c.lat, c.lon);
    return { c, road, type: facility(c, road) };
  });
  // grade-separated crossings: tunnel footways / footbridges that pass a road of class ≤ tertiary
  const grade = [];
  const gradeSrc = [
    ...tunnels.map((w) => ({ lat: w.geometry[Math.floor(w.geometry.length / 2)].lat, lon: w.geometry[Math.floor(w.geometry.length / 2)].lon, lit: w.tags?.lit })),
    ...footbridges.map((w) => ({ lat: w.center.lat, lon: w.center.lon, lit: w.tags?.lit })),
  ];
  for (const g of gradeSrc) {
    const road = nearestRoad(g.lat, g.lon, 30);
    if (!road || CLASS_RANK[road.info.cls] < 3) continue;
    if (grade.some((x) => hav(x.lat, x.lon, g.lat, g.lon) < 35)) continue;
    grade.push({ ...g, road });
  }
  const safeIdx = pointIndex([
    ...pre.filter((p) => p.type === T_SIGNALS).map((p) => ({ lat: p.c.lat, lon: p.c.lon })),
    ...grade.map((g) => ({ lat: g.lat, lon: g.lon })),
  ]);

  const stat = { lanesDefault: 0, litUnknown: 0, school: 0, bus: 0, isolated: 0, island: 0 };
  for (const { c, road, type } of pre) {
    const t = c.tags;
    const info = road?.info;
    // no public road (trunk…residential) within 14 m → the crossing sits on a service road /
    // parking aisle / driveway (not in the road extract): 2 lanes, 30 km/h, unverified
    const lanes = info?.lanes ?? 2;
    const lanesVerified = info?.lanesVerified ?? false;
    const speed = info?.speed ?? 30;
    let lit = t.lit === 'yes' || info?.lit === 'yes' ? 'yes' : t.lit === 'no' || info?.lit === 'no' ? 'no' : 'unknown';
    if (lit === 'unknown' && lamps.near(c.lat, c.lon, 30).length) lit = 'yes';
    const island = t['crossing:island'] === 'yes';
    const bus = type !== T_SIGNALS && busStops.near(c.lat, c.lon, 30).length > 0;
    const school = type !== T_SIGNALS && schools.near(c.lat, c.lon, 150).length > 0;
    const isolated = type !== T_SIGNALS && lanes >= 4 && !safeIdx.near(c.lat, c.lon, 250).length;
    if (bus) stat.bus++;
    if (school) stat.school++;
    if (isolated) stat.isolated++;
    if (!lanesVerified) stat.lanesDefault++;
    if (lit === 'unknown') stat.litUnknown++;
    if (island) stat.island++;
    const { day, night } = crossingScore({ type, lanes, speed, lit, island, bus, school, isolated, lanesVerified });
    crossings.push([r5(c.lat), r5(c.lon), type, day, night, lanes, road?.bearing ?? -1, info?.name ?? -1]);
  }
  for (const g of grade) {
    const lit = g.lit === 'yes' ? 'yes' : g.lit === 'no' ? 'no' : 'unknown';
    const { day, night } = crossingScore({ type: T_GRADE, lit });
    crossings.push([r5(g.lat), r5(g.lon), T_GRADE, day, night, g.road.info.lanes, g.road.bearing, g.road.info.name]);
  }

  // metro stations
  const stations = [];
  const seen = new Set();
  for (const el of sJson.elements) {
    const t = el.tags ?? {};
    if (!(t.station === 'subway' || t.subway === 'yes')) continue;
    const name = t['name:az'] ?? t.name;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    stations.push({ name, lat: r5(el.lat), lon: r5(el.lon) });
  }

  const counts = [0, 0, 0, 0];
  for (const c of crossings) counts[c[2]]++;
  const band = (i) => {
    const b = [0, 0, 0];
    for (const c of crossings) b[c[i] >= 75 ? 0 : c[i] >= 55 ? 1 : 2]++;
    return `≥75 ${b[0]} · 55–74 ${b[1]} · <55 ${b[2]}`;
  };
  const out = { v: 2, generated: new Date().toISOString(), model: 'hara-irap-lite-1', crossings, segments, stations, names };
  await fs.writeFile(OUT, JSON.stringify(out));
  const size = (await fs.stat(OUT)).size;
  console.log(`crossings: ${crossings.length} (signals ${counts[0]}, zebra ${counts[1]}, unmarked ${counts[2]}, grade-separated ${counts[3]}); footway=crossing: +${added} new, ${upgraded} tags filled`);
  console.log(`  day:   ${band(3)}\n  night: ${band(4)}`);
  console.log(`  evidence: lanes defaulted ${stat.lanesDefault}, lit unknown ${stat.litUnknown}, bus stop ${stat.bus}, school ${stat.school}, isolated ${stat.isolated}, island ${stat.island}`);
  console.log(`segments: ${segments.length}, stations: ${stations.length}, names: ${names.length}`);
  console.log(`wrote ${OUT} (${(size / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
