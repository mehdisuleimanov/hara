// Dev-time only: Baku bus route relations (route=bus) with their stop/platform nodes, cached in
// scripts/.cache/bus.json. build-routes.mjs uses it to name a REAL line that serves both stops.
// Usage: node scripts/fetch-bus.mjs [--force]
import fs from 'node:fs/promises';
import path from 'node:path';
import { overpass } from './lib/overpass.mjs';

const FILE = path.resolve('scripts/.cache/bus.json');
const B = '40.33,49.75,40.48,50.0';
const QUERY = `[out:json][timeout:180];
relation["route"="bus"](${B})->.r;
.r out body;
node(r.r);
out skel qt;`;

async function main() {
  if (!process.argv.includes('--force')) {
    try {
      const j = JSON.parse(await fs.readFile(FILE, 'utf8'));
      console.log(`bus: cached (${j.elements.length} elements)`);
      return;
    } catch {}
  }
  const json = await overpass(QUERY, 'bus');
  await fs.writeFile(FILE, JSON.stringify(json));
  console.log(`bus: wrote ${FILE} (${json.elements.filter((e) => e.type === 'relation').length} relations)`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
