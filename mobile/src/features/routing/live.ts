import type { Profile, RouteOption, TimeOfDay } from '@/data/types';
import { LAYER } from '@/data/layer';
import { ORIGIN } from '@/data/destinations';
import { log } from '@/utils/log';
import { capByModes, scoreWalk } from './scoring';
import { routeToCore, type FetchJson, type LiveDeps } from './liveCore';

/**
 * Live routing to ANY place (outside the 9-destination catalog).
 * FROZEN API. Geocode: Photon → Nominatim (Baku bbox, generic User-Agent); routes: FOSSGIS OSRM
 * foot + car; scores computed on-device from the real safety layer with the same weakest-link
 * model as the catalog (scoring.ts). Pure logic lives in liveCore.ts (Node-testable).
 * Timeouts: geocode 3 s, route 4 s. Never throws — null when the place can't be found or offline.
 */
export type LivePlace = { name: string; district?: string; lat: number; lon: number };

export type LiveRoute = {
  /** stable id usable as /results/live:<id> */
  id: string;
  place: LivePlace;
  /** 1–3 options, same shape as catalog routes (scores computed on-device) */
  options: RouteOption[];
  computedAt: number;
};

export type RouteToInput = { query: string } | { lat: number; lon: number; name?: string };

const fetchJson: FetchJson = async (url, timeoutMs, headers) => {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', ...(headers ?? {}) }, signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
};

let deps: LiveDeps | null = null;
function getDeps(): LiveDeps {
  if (!deps) deps = { fetchJson, layer: LAYER, stations: LAYER.stations, metroHops: LAYER.metroHops, scoreWalk, capByModes, origin: ORIGIN, log };
  return deps;
}

const byId = new Map<string, LiveRoute>();
const byQuery = new Map<string, LiveRoute>();
const CACHE_MS = 15 * 60 * 1000;

/** Returns null when the place can't be found or there is no network (caller answers gracefully). */
export async function routeTo(input: RouteToInput, opts: { profile?: Profile; time?: TimeOfDay } = {}): Promise<LiveRoute | null> {
  try {
    const key = JSON.stringify(['query' in input ? input.query.trim().toLowerCase() : [input.lat.toFixed(5), input.lon.toFixed(5)], opts.profile ?? '', opts.time ?? '']);
    const hit = byQuery.get(key);
    if (hit && Date.now() - hit.computedAt < CACHE_MS) return hit;
    const r = await routeToCore(input, opts, getDeps());
    if (!r) return null;
    byId.set(r.id, r);
    byQuery.set(key, r);
    return r;
  } catch (e) {
    log('live: routeTo', e);
    return null;
  }
}

/** Look up a computed live route by id (for the results screen). Accepts "live:<id>" too. */
export function liveRouteById(id: string): LiveRoute | null {
  const k = id.startsWith('live:') ? id.slice(5) : id;
  return byId.get(k) ?? null;
}
