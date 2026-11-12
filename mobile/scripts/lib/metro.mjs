// Dev-time only: Baku Metro tunnel graph from scripts/.cache/metro.json (see fetch-metro.mjs).
// Stations are snapped to track nodes (≤250 m), consecutive stations are joined with a
// multi-source Dijkstra over the railway=subway ways; a path is accepted only when it is
// ≤1.6× the straight station-to-station line, otherwise that hop falls back to a straight line.
import fs from 'node:fs/promises';
import path from 'node:path';

const FILE = path.resolve('scripts/.cache/metro.json');

/** Baku Metro line orders (canonical names; matched to OSM station names with normName). */
export const RED = ['İçərişəhər', 'Sahil', '28 May', 'Gənclik', 'Nəriman Nərimanov', 'Ulduz', 'Koroğlu', 'Qara Qarayev', 'Neftçilər', 'Xalqlar Dostluğu', 'Əhmədli', 'Həzi Aslanov'];
export const GREEN = ['Xətai', 'Cəfər Cabbarlı', 'Nizami', 'Elmlər Akademiyası', 'İnşaatçılar', '20 Yanvar', 'Memar Əcəmi', 'Nəsimi', 'Azadlıq prospekti', 'Dərnəgül'];
export const normName = (s) => s.toLowerCase().replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/i̇/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/[^a-z0-9]/g, '');
export function findStation(stations, name) {
  const n = normName(name);
  return stations.find((s) => normName(s.name) === n) ?? stations.find((s) => normName(s.name).includes(n) || n.includes(normName(s.name)));
}
const SNAP_M = 250;
const MAX_RATIO = 1.6;

function hav(aLat, aLon, bLat, bLon) {
  const R = 6371000, toR = Math.PI / 180, dLat = (bLat - aLat) * toR, dLon = (bLon - aLon) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toR) * Math.cos(bLat * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Tiny binary heap keyed by distance. */
class Heap {
  constructor() { this.a = []; }
  push(d, v) {
    const a = this.a; a.push([d, v]);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

export async function loadMetroGraph() {
  let json;
  try {
    json = JSON.parse(await fs.readFile(FILE, 'utf8'));
  } catch {
    return null; // fetch-metro not run / Overpass down → callers fall back to straight station hops
  }
  const pos = new Map();
  const adj = new Map();
  const link = (a, b, d) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a).push([b, d]);
  };
  for (const w of json.elements) {
    if (w.type !== 'way' || !w.geometry || !w.nodes) continue;
    if (w.tags?.railway !== 'subway' && w.tags?.railway !== 'rail') continue;
    w.nodes.forEach((id, i) => pos.set(id, [w.geometry[i].lat, w.geometry[i].lon]));
    for (let i = 1; i < w.nodes.length; i++) {
      const a = w.geometry[i - 1], b = w.geometry[i];
      const d = hav(a.lat, a.lon, b.lat, b.lon);
      link(w.nodes[i - 1], w.nodes[i], d);
      link(w.nodes[i], w.nodes[i - 1], d);
    }
  }
  const ids = [...pos.keys()];
  const near = (lat, lon) => ids.map((id) => [id, hav(lat, lon, ...pos.get(id))]).filter(([, d]) => d <= SNAP_M);

  /** shortest track between two stations, or null */
  function hop(a, b) {
    const src = near(a.lat, a.lon), dst = new Map(near(b.lat, b.lon));
    if (!src.length || !dst.size) return null;
    const dist = new Map(), prev = new Map(), h = new Heap();
    for (const [id, d] of src) { dist.set(id, d); h.push(d, id); }
    let best = null;
    while (h.size) {
      const [d, u] = h.pop();
      if (d > (dist.get(u) ?? Infinity)) continue;
      if (best && d >= best.total) break;
      if (dst.has(u)) {
        const total = d + dst.get(u);
        if (!best || total < best.total) best = { total, node: u };
      }
      for (const [v, w] of adj.get(u) ?? []) {
        const nd = d + w;
        if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); prev.set(v, u); h.push(nd, v); }
      }
    }
    if (!best) return null;
    const chain = [];
    for (let u = best.node; u != null; u = prev.get(u)) chain.push(pos.get(u));
    chain.reverse();
    const straight = hav(a.lat, a.lon, b.lat, b.lon);
    if (best.total > MAX_RATIO * Math.max(straight, 1)) return null;
    return { pts: [[a.lat, a.lon], ...chain, [b.lat, b.lon]], length: best.total };
  }

  /** Track through consecutive stations; reports how many hops used real tunnel geometry. */
  function track(stations) {
    const pts = [[stations[0].lat, stations[0].lon]];
    let real = 0, fallback = 0;
    for (let i = 1; i < stations.length; i++) {
      const h = hop(stations[i - 1], stations[i]);
      if (h) { pts.push(...h.pts.slice(1)); real++; }
      else { pts.push([stations[i].lat, stations[i].lon]); fallback++; }
    }
    return { pts, real, fallback };
  }
  return { track, hop, nodes: pos.size };
}
