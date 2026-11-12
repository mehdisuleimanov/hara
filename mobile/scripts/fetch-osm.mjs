// Dev-time only: downloads raw OSM data for Baku from Overpass and caches it.
// Usage: node scripts/fetch-osm.mjs
import fs from 'node:fs/promises';
import path from 'node:path';

const CACHE = path.resolve('scripts/.cache');
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const UA = 'hara-hackathon-demo-dataprep/1.0';

// Baku urban area, split into a 3x3 grid so each query stays small.
const BBOX = { s: 40.33, w: 49.75, n: 40.48, e: 50.0 };
const ROWS = 3;
const COLS = 3;

const ROAD_CLASSES =
  'trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|residential|unclassified|living_street|pedestrian';

function tileQuery({ s, w, n, e }) {
  const b = `${s},${w},${n},${e}`;
  return `[out:json][timeout:180];
(
  node["highway"="crossing"](${b});
  node["highway"="traffic_signals"](${b});
  node["crossing"](${b});
  way["highway"~"^(${ROAD_CLASSES})$"](${b});
  way["highway"="footway"]["tunnel"](${b});
  way["highway"="footway"]["layer"="-1"](${b});
);
out body geom qt;`;
}

function stationsQuery() {
  const b = `${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e}`;
  return `[out:json][timeout:120];
(
  node["station"="subway"](${b});
  node["railway"="station"]["subway"="yes"](${b});
  node["public_transport"="station"]["subway"="yes"](${b});
  node["highway"="bus_stop"](${b});
);
out body qt;`;
}

async function overpass(query, label) {
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    const url = ENDPOINTS[attempt % ENDPOINTS.length];
    try {
      const t0 = Date.now();
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: 'data=' + encodeURIComponent(query),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = await res.json();
      console.log(`  ${label}: ${json.elements.length} elements (${((Date.now() - t0) / 1000).toFixed(1)}s, ${url})`);
      return json;
    } catch (err) {
      lastErr = err;
      console.warn(`  ${label}: attempt ${attempt + 1} failed (${err.message}), retrying...`);
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function main() {
  await fs.mkdir(CACHE, { recursive: true });
  const dLat = (BBOX.n - BBOX.s) / ROWS;
  const dLon = (BBOX.e - BBOX.w) / COLS;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const file = path.join(CACHE, `tile-${r}-${c}.json`);
      try {
        await fs.access(file);
        console.log(`  tile ${r}-${c}: cached`);
        continue;
      } catch {}
      const tile = {
        s: +(BBOX.s + r * dLat).toFixed(4),
        n: +(BBOX.s + (r + 1) * dLat).toFixed(4),
        w: +(BBOX.w + c * dLon).toFixed(4),
        e: +(BBOX.w + (c + 1) * dLon).toFixed(4),
      };
      const json = await overpass(tileQuery(tile), `tile ${r}-${c}`);
      await fs.writeFile(file, JSON.stringify(json));
    }
  }
  const sFile = path.join(CACHE, 'stations.json');
  try {
    await fs.access(sFile);
    console.log('  stations: cached');
  } catch {
    const json = await overpass(stationsQuery(), 'stations');
    await fs.writeFile(sFile, JSON.stringify(json));
  }
  console.log('done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
