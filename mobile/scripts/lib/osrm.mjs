// Dev-time only: cached FOSSGIS OSRM client (routing.openstreetmap.de: routed-car / routed-foot / routed-bike).
// Responses are cached in scripts/.cache/osrm-<md5(url)>.json so builds are reproducible offline.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const CACHE = path.resolve('scripts/.cache');
const UA = 'Hara/1.0 (dataprep)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {'car'|'foot'|'bike'} profile
 * @param {[number, number][]} pts [lat, lon] waypoints
 * @param {{alternatives?: number, continueStraight?: boolean, approaches?: string[], radiuses?: (number|null)[]}} [o]
 */
export async function osrm(profile, pts, o = {}) {
  if (typeof o === 'number') o = { alternatives: o };
  const coords = pts.map(([lat, lon]) => `${lon},${lat}`).join(';');
  let url = `https://routing.openstreetmap.de/routed-${profile}/route/v1/driving/${coords}?alternatives=${o.alternatives ?? 0}&steps=true&geometries=geojson&overview=full`;
  if (o.continueStraight) url += '&continue_straight=true';
  if (o.approaches) url += `&approaches=${o.approaches.join(';')}`;
  if (o.radiuses) url += `&radiuses=${o.radiuses.map((r) => (r == null ? 'unlimited' : r)).join(';')}`;
  const file = path.join(CACHE, 'osrm-' + crypto.createHash('md5').update(url).digest('hex').slice(0, 12) + '.json');
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}
  for (let a = 0; a < 5; a++) {
    try {
      await sleep(1100);
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(String(res.status));
      const j = await res.json();
      if (j.code !== 'Ok') throw new Error(j.code);
      await fs.writeFile(file, JSON.stringify(j));
      return j;
    } catch (e) {
      console.log(`  osrm ${profile} retry ${a + 1}: ${e.message}`);
      await sleep(3000 * (a + 1));
    }
  }
  throw new Error('OSRM failed: ' + url);
}
