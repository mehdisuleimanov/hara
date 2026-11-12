// Dev-time only: exercises the live-routing core (src/features/routing/liveCore.ts) from Node with
// the real safety layer, real Photon/Nominatim geocoding and FOSSGIS OSRM — same code as the app.
// Usage: node scripts/test-live.mjs ["Fəvvarələr meydanı"] [night]
import fs from 'node:fs/promises';
import path from 'node:path';
import { routeToCore } from '../src/features/routing/liveCore.ts';
import { scoreWalk, capByModes } from '../src/features/routing/scoring.ts';
import { ORIGIN } from '../src/data/destinations.ts';

const layer = JSON.parse(await fs.readFile(path.resolve('src/data/safety-layer.json'), 'utf8'));
const fetchJson = async (url, timeoutMs, headers) => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', ...(headers ?? {}) }, signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
};
const query = process.argv[2] ?? 'Fəvvarələr meydanı';
const time = process.argv[3] === 'night' ? 'night' : 'day';
const t0 = Date.now();
const r = await routeToCore({ query }, { time }, { fetchJson, layer, stations: layer.stations, metroHops: layer.metroHops, scoreWalk, capByModes, origin: ORIGIN, log: (...a) => console.log('  log:', ...a.map(String)) });
console.log(`"${query}" (${time}) → ${Date.now() - t0} ms`);
if (!r) {
  console.log('null');
  process.exit(1);
}
console.log(`place: ${r.place.name} · ${r.place.district ?? ''} (${r.place.lat}, ${r.place.lon}) id=${r.id}`);
for (const o of r.options) {
  console.log(`  ${o.kind.padEnd(8)} ${String(o.durationMin).padStart(3)} dəq · ${o.price.padEnd(7)} · bal ${o.scoreDay}/${o.scoreNight} · ${o.legs.map((l) => `${l.mode}${l.underground ? '(u)' : ''}:${l.distanceM}m`).join(' ')}`);
  console.log(`           ${o.reasons.join(' | ')}${o.warning ? ' ! ' + o.warning : ''}`);
}
