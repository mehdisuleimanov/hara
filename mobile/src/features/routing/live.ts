import type { Profile, RouteOption, TimeOfDay } from '@/data/types';

/**
 * Live routing to ANY place (outside the 9-destination catalog).
 * FROZEN API — implemented by lane B (geocode Photon/Nominatim in a Baku bbox,
 * FOSSGIS OSRM foot routing, on-device safety scoring from the real layer).
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

/** Returns null when the place can't be found or there is no network (caller answers gracefully). */
export async function routeTo(_input: RouteToInput, _opts: { profile?: Profile; time?: TimeOfDay } = {}): Promise<LiveRoute | null> {
  return null;
}

/** Look up a computed live route by id (for the results screen). */
export function liveRouteById(_id: string): LiveRoute | null {
  return null;
}
