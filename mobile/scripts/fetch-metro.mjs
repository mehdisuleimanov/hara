// Dev-time only: downloads Baku Metro tunnel geometry (railway=subway ways, route=subway
// relations, stations, entrances) from Overpass and caches it in scripts/.cache/metro.json.
// build-routes.mjs snaps stations onto this graph and runs Dijkstra between consecutive
// stations so metro legs follow the real tunnels instead of straight lines.
// Usage: node scripts/fetch-metro.mjs [--force]
import fs from 'node:fs/promises';
import path from 'node:path';
import { overpass } from './lib/overpass.mjs';

const CACHE = path.resolve('scripts/.cache');
const FILE = path.join(CACHE, 'metro.json');
const B = '40.33,49.72,40.48,50.0';

const QUERY = `[out:json][timeout:180];
(
  way["railway"="subway"](${B});
  way["railway"="rail"]["tunnel"="yes"]["service"!~"."](${B});
  relation["route"="subway"](${B});
  node["railway"="station"]["station"="subway"](${B});
  node["station"="subway"](${B});
  node["public_transport"="stop_position"]["subway"="yes"](${B});
  node["railway"="subway_entrance"](${B});
);
out body geom qt;`;

async function main() {
  await fs.mkdir(CACHE, { recursive: true });
  if (!process.argv.includes('--force')) {
    try {
      const j = JSON.parse(await fs.readFile(FILE, 'utf8'));
      console.log(`metro: cached (${j.elements.length} elements)`);
      return;
    } catch {}
  }
  const json = await overpass(QUERY, 'metro');
  const ways = json.elements.filter((e) => e.type === 'way').length;
  if (!ways) throw new Error('metro: no subway ways returned');
  await fs.writeFile(FILE, JSON.stringify(json));
  console.log(`metro: wrote ${FILE} (${ways} ways)`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
