// Dev-time only: turns cached OSM data into the app's "Bakı Təhlükəsizlik Qatı".
// Scores are PROTOTYPE rules (iRAP-inspired attributes), not a validated model.
// Usage: node scripts/build-safety-layer.mjs
import fs from 'node:fs/promises';
import path from 'node:path';

const CACHE = path.resolve('scripts/.cache');
const OUT = path.resolve('src/data/safety-layer.json');

const CLASS_CODE = {
  trunk: 0, trunk_link: 0, primary: 1, primary_link: 1, secondary: 2, secondary_link: 2,
  tertiary: 3, tertiary_link: 3, unclassified: 4, residential: 4, living_street: 5, pedestrian: 5,
};
const CLASS_BASE = {
  trunk: 38, trunk_link: 42, primary: 52, primary_link: 55, secondary: 62, secondary_link: 64,
  tertiary: 70, tertiary_link: 70, unclassified: 72, residential: 80, living_street: 88, pedestrian: 92,
};
// crossing type codes used by the app
export const T_SIGNALS = 0, T_ZEBRA = 1, T_UNMARKED = 2, T_UNDERGROUND = 3;

const r5 = (v) => Math.round(v * 1e5) / 1e5;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const jit = (id) => {
  const x = Math.sin(Number(String(id).slice(-9)) * 12.9898) * 43758.5453;
  return x - Math.floor(x); // 0..1 deterministic per OSM id
};

function lanesOf(tags, cls) {
  const l = parseInt(tags?.lanes, 10);
  if (Number.isFinite(l) && l > 0) return l;
  // missing data -> conservative default by road class
  if (cls === 'trunk' || cls === 'primary') return 4;
  if (cls === 'secondary') return 3;
  return 2;
}

function hav(aLat, aLon, bLat, bLon) {
  const R = 6371000, dLat = ((bLat - aLat) * Math.PI) / 180, dLon = ((bLon - aLon) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Douglas-Peucker in local meters
function simplify(pts, tol) {
  if (pts.length <= 2) return pts;
  const lat0 = (pts[0].lat * Math.PI) / 180;
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
  console.log(`raw: ${nodes.size} nodes, ${ways.size} ways from ${files.length} tiles`);

  // road info per node (for crossing lanes / class / lighting)
  const nodeRoad = new Map();
  const segments = [];
  const underground = [];
  for (const w of ways.values()) {
    const cls = w.tags?.highway;
    if (cls === 'footway') {
      if (w.geometry?.length) {
        const mid = w.geometry[Math.floor(w.geometry.length / 2)];
        underground.push({ id: w.id, lat: mid.lat, lon: mid.lon });
      }
      continue;
    }
    if (!(cls in CLASS_BASE) || !w.geometry?.length) continue;
    const lanes = lanesOf(w.tags, cls);
    const lit = w.tags?.lit;
    if (cls !== 'pedestrian') {
      for (const nid of w.nodes ?? []) {
        const prev = nodeRoad.get(nid);
        if (!prev || lanes > prev.lanes || CLASS_BASE[cls] < CLASS_BASE[prev.cls]) nodeRoad.set(nid, { cls, lanes, lit });
      }
    }
    // segment score
    let day = CLASS_BASE[cls];
    if (lanes >= 6) day -= 12; else if (lanes >= 4) day -= 6;
    const ms = parseInt(w.tags?.maxspeed, 10);
    if (ms >= 60) day -= 6;
    const sw = w.tags?.sidewalk ?? w.tags?.['sidewalk:both'];
    if (sw === 'no' || sw === 'none') day -= 14;
    else if (sw) day += 4;
    else day -= 2; // missing data counts against
    day = clamp(Math.round(day + (jit(w.id) - 0.5) * 8), 15, 96);
    const nightPenalty = lit === 'yes' ? 3 : lit === 'no' ? 26 : cls === 'residential' || cls === 'unclassified' ? 16 : 9;
    const night = clamp(day - nightPenalty, 8, 96);
    const simp = simplify(w.geometry, 4);
    const c = [];
    for (const p of simp) c.push(r5(p.lat), r5(p.lon));
    segments.push({ k: CLASS_CODE[cls], d: day, n: night, c });
  }

  // traffic-signal nodes (to upgrade nearby crossings)
  const signalNodes = [...nodes.values()].filter((n) => n.tags?.highway === 'traffic_signals');
  const sigGrid = new Map();
  const key = (lat, lon) => `${Math.floor(lat * 2000)}:${Math.floor(lon * 2000)}`; // ~55m cells
  for (const s of signalNodes) {
    const k = key(s.lat, s.lon);
    if (!sigGrid.has(k)) sigGrid.set(k, []);
    sigGrid.get(k).push(s);
  }
  const nearSignal = (lat, lon) => {
    const ci = Math.floor(lat * 2000), cj = Math.floor(lon * 2000);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      for (const s of sigGrid.get(`${ci + i}:${cj + j}`) ?? []) if (hav(lat, lon, s.lat, s.lon) < 25) return true;
    }
    return false;
  };

  const crossings = [];
  for (const n of nodes.values()) {
    const t = n.tags ?? {};
    const isCrossing = t.highway === 'crossing' || (t.crossing && t.highway !== 'traffic_signals') || (t.highway === 'traffic_signals' && t.crossing);
    if (!isCrossing) continue;
    if (t.crossing === 'no') continue;
    const road = nodeRoad.get(n.id);
    const cls = road?.cls ?? 'residential';
    const lanes = road?.lanes ?? 2;
    const lit = road?.lit;
    let type;
    if (t.crossing === 'traffic_signals' || t.highway === 'traffic_signals' || t['crossing:signals'] === 'yes' || ['pelican', 'toucan', 'puffin'].includes(t.crossing_ref) || nearSignal(n.lat, n.lon)) type = T_SIGNALS;
    else if (['marked', 'zebra', 'uncontrolled'].includes(t.crossing) || t.crossing_ref === 'zebra' || t['crossing:markings']) type = T_ZEBRA;
    else type = T_UNMARKED;

    const j = jit(n.id);
    const lanePen = lanes >= 6 ? 22 : lanes >= 4 ? 12 : lanes === 3 ? 6 : 0;
    const classPen = cls === 'trunk' || cls === 'primary' ? 8 : 0;
    let day, night;
    if (type === T_SIGNALS) {
      day = 82 + j * 12 - (lanes >= 6 ? 4 : 0);
      night = day - (lit === 'no' ? 14 : lit === 'yes' ? 3 : 7);
    } else if (type === T_ZEBRA) {
      day = clamp(72 - lanePen - classPen - j * 10, 26, 72);
      night = day - (lit === 'yes' ? 6 : lit === 'no' ? 22 : 14);
    } else {
      day = clamp(44 - lanePen * 0.6 - classPen - j * 14, 12, 46);
      night = day - 12;
    }
    crossings.push([r5(n.lat), r5(n.lon), type, Math.round(day), Math.round(clamp(night, 6, 96)), lanes]);
  }
  for (const u of underground) {
    const j = jit(u.id);
    const day = 74 + j * 8;
    crossings.push([r5(u.lat), r5(u.lon), T_UNDERGROUND, Math.round(day), Math.round(day - 8), 0]);
  }

  // metro stations
  const sJson = JSON.parse(await fs.readFile(path.join(CACHE, 'stations.json'), 'utf8'));
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
  const out = { v: 1, generated: new Date().toISOString(), crossings, segments, stations };
  await fs.writeFile(OUT, JSON.stringify(out));
  const size = (await fs.stat(OUT)).size;
  console.log(`crossings: ${crossings.length} (signals ${counts[0]}, zebra ${counts[1]}, unmarked ${counts[2]}, underground ${counts[3]})`);
  console.log(`segments: ${segments.length}, stations: ${stations.length}`);
  console.log(`wrote ${OUT} (${(size / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
