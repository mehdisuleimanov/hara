// Dev-time only: downloads raw OSM data for Baku from Overpass and caches it.
// Usage: node scripts/fetch-osm.mjs
//   tile-R-C.json  roads (class, lanes, maxspeed, lit, sidewalk), crossing + signal nodes, tunnel footways
//   stations.json  metro stations + bus stops
//   extras.json    schools/kindergartens, street lamps, crossing footways, footbridges, metro entrances
import fs from 'node:fs/promises';
import path from 'node:path';
import { overpass } from './lib/overpass.mjs';

const CACHE = path.resolve('scripts/.cache');

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

/** Safety-scoring extras: schools, street lamps, crossing footways, footbridges, metro entrances. */
function extrasQuery() {
  const b = `${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e}`;
  return `[out:json][timeout:180];
(
  nwr["amenity"~"^(school|kindergarten)$"](${b});
  node["highway"="street_lamp"](${b});
  way["footway"="crossing"](${b});
  way["highway"="footway"]["bridge"="yes"](${b});
  node["railway"="subway_entrance"](${b});
);
out tags geom center qt;`;
}

async function cached(file, label, query) {
  try {
    await fs.access(file);
    console.log(`  ${label}: cached`);
  } catch {
    const json = await overpass(query, label);
    await fs.writeFile(file, JSON.stringify(json));
  }
}

async function main() {
  await fs.mkdir(CACHE, { recursive: true });
  const dLat = (BBOX.n - BBOX.s) / ROWS;
  const dLon = (BBOX.e - BBOX.w) / COLS;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = {
        s: +(BBOX.s + r * dLat).toFixed(4),
        n: +(BBOX.s + (r + 1) * dLat).toFixed(4),
        w: +(BBOX.w + c * dLon).toFixed(4),
        e: +(BBOX.w + (c + 1) * dLon).toFixed(4),
      };
      await cached(path.join(CACHE, `tile-${r}-${c}.json`), `tile ${r}-${c}`, tileQuery(tile));
    }
  }
  await cached(path.join(CACHE, 'stations.json'), 'stations', stationsQuery());
  await cached(path.join(CACHE, 'extras.json'), 'extras', extrasQuery());
  console.log('done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
