// Dev-time: extracts the extra REAL OpenStreetMap facts the Şəhər paneli needs from the
// cached OSM download (scripts/.cache, see fetch-osm.mjs) into a compact bundle:
//   - bus stops (highway=bus_stop)                     → pedestrian-demand model
//   - optional POIs (metro entrances, schools, universities, malls, markets) from Overpass
//   - street names near crossings and along major roads → readable "Top riskli keçidlər"
//   - OSM lighting tag coverage (lit=yes/no) by street length → data-gap insight
// Output: src/features/city/osm-city.json
// Usage (from mobile/): node scripts/build-city.mjs [--no-fetch]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'scripts/.cache');
const OWN_CACHE = path.join(ROOT, 'scripts/.city-cache');
const OUT = path.join(ROOT, 'src/features/city/osm-city.json');
const BBOX = { s: 40.33, w: 49.75, n: 40.48, e: 50.0 };
const UA = 'city-panel-dataprep/1.0';

const r4 = (v) => Math.round(v * 1e4) / 1e4;
const r5 = (v) => Math.round(v * 1e5) / 1e5;
function hav(aLat, aLon, bLat, bLon) {
  const R = 6371000, dLat = ((bLat - aLat) * Math.PI) / 180, dLon = ((bLon - aLon) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const nodes = new Map();
const ways = new Map();
for (const f of fs.readdirSync(CACHE).filter((f) => f.startsWith('tile-'))) {
  const j = JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8'));
  for (const el of j.elements) (el.type === 'node' ? nodes : ways).set(el.id, el);
}

const ROAD = new Set(['trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street', 'pedestrian']);
const MAJOR = new Set(['trunk', 'primary', 'secondary', 'tertiary']);
const nameOf = (t) =>
  (t?.['name:az'] || t?.name || '')
    .trim()
    .replace(/\s+küç\.?$/i, ' küçəsi')
    .replace(/\s+pr\.?$/i, ' prospekti')
    .replace(/\s+şos\.?$/i, ' şossesi');

// --- names
const names = [];
const nameIdx = new Map();
const idxOf = (n) => {
  if (!nameIdx.has(n)) {
    nameIdx.set(n, names.length);
    names.push(n);
  }
  return nameIdx.get(n);
};
const named = []; // [lat, lon, nameIdx]
const nodeName = new Map(); // crossing node id -> name (prefer the biggest road)
const RANK = { trunk: 0, primary: 1, secondary: 2, tertiary: 3, unclassified: 4, residential: 4, living_street: 5, pedestrian: 5 };

// --- lighting coverage by length
let totalM = 0, litYesM = 0, litNoM = 0;

for (const w of ways.values()) {
  const t = w.tags ?? {};
  const cls = String(t.highway ?? '').replace('_link', '');
  if (!ROAD.has(t.highway) || !w.geometry?.length) continue;
  let len = 0;
  for (let i = 1; i < w.geometry.length; i++) len += hav(w.geometry[i - 1].lat, w.geometry[i - 1].lon, w.geometry[i].lat, w.geometry[i].lon);
  totalM += len;
  if (t.lit === 'yes' || t.lit === '24/7' || t.lit === 'automatic') litYesM += len;
  else if (t.lit === 'no') litNoM += len;

  const n = nameOf(t);
  if (!n) continue;
  for (const nid of w.nodes ?? []) {
    const prev = nodeName.get(nid);
    if (!prev || RANK[cls] < prev.rank) nodeName.set(nid, { name: n, rank: RANK[cls] ?? 9 });
  }
  if (MAJOR.has(cls)) {
    // sample the named major road every ~200 m
    let last = null;
    for (const p of w.geometry) {
      if (!last || hav(last.lat, last.lon, p.lat, p.lon) > 200) {
        named.push([r4(p.lat), r4(p.lon), idxOf(n)]);
        last = p;
      }
    }
  }
}

// crossing nodes with the name of the street they sit on (keyed exactly like safety-layer.json: r5)
const crossingNames = {};
let crossingNamed = 0;
for (const nd of nodes.values()) {
  const t = nd.tags ?? {};
  if (!(t.highway === 'crossing' || t.crossing || t.highway === 'traffic_signals')) continue;
  const nn = nodeName.get(nd.id);
  if (!nn) continue;
  crossingNames[`${r5(nd.lat)},${r5(nd.lon)}`] = idxOf(nn.name);
  crossingNamed++;
}

// --- bus stops
const st = JSON.parse(fs.readFileSync(path.join(CACHE, 'stations.json'), 'utf8'));
const stops = [];
for (const el of st.elements) if (el.tags?.highway === 'bus_stop') stops.push(r4(el.lat), r4(el.lon));

// --- optional POIs (cached in scripts/.city-cache/poi.json)
const POI_FILE = path.join(OWN_CACHE, 'poi.json');
async function fetchPoi() {
  const b = `${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e}`;
  const q = `[out:json][timeout:90];
(
  node["railway"="subway_entrance"](${b});
  nwr["amenity"~"^(school|university|college)$"](${b});
  nwr["shop"="mall"](${b});
  nwr["amenity"="marketplace"](${b});
);
out center qt;`;
  for (const url of ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 100000);
      const res = await fetch(url, { method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA }, body: 'data=' + encodeURIComponent(q) });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`${res.status}`);
      const j = await res.json();
      fs.mkdirSync(OWN_CACHE, { recursive: true });
      fs.writeFileSync(POI_FILE, JSON.stringify(j));
      console.log(`poi: ${j.elements.length} elements from ${url}`);
      return j;
    } catch (e) {
      console.log(`poi: ${url} failed (${String(e).slice(0, 80)})`);
    }
  }
  return null;
}
let poiJson = fs.existsSync(POI_FILE) ? JSON.parse(fs.readFileSync(POI_FILE, 'utf8')) : null;
if (!poiJson && !process.argv.includes('--no-fetch')) poiJson = await fetchPoi();
// kind codes: 0 metro entrance, 1 school, 2 university/college, 3 mall, 4 marketplace
const poi = [];
const poiCounts = [0, 0, 0, 0, 0];
for (const el of poiJson?.elements ?? []) {
  const t = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
  if (lat == null) continue;
  const k = t.railway === 'subway_entrance' ? 0 : t.amenity === 'school' ? 1 : t.amenity === 'university' || t.amenity === 'college' ? 2 : t.shop === 'mall' ? 3 : t.amenity === 'marketplace' ? 4 : -1;
  if (k < 0) continue;
  poi.push(r4(lat), r4(lon), k);
  poiCounts[k]++;
}

const out = {
  v: 1,
  generated: new Date().toISOString(),
  source: 'OpenStreetMap contributors (ODbL)',
  names,
  crossingNames,
  named,
  stops,
  poi,
  poiCounts,
  lighting: { totalKm: Math.round(totalM / 100) / 10, litYesKm: Math.round(litYesM / 100) / 10, litNoKm: Math.round(litNoM / 100) / 10 },
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`names ${names.length}, named crossings ${crossingNamed}, road samples ${named.length}, bus stops ${stops.length / 2}, poi ${poi.length / 3} [${poiCounts}]`);
console.log(`lighting: ${out.lighting.litYesKm} km lit=yes, ${out.lighting.litNoKm} km lit=no of ${out.lighting.totalKm} km`);
console.log(`wrote ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
