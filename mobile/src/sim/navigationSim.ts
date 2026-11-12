import type { LatLng, Mode, RouteOption, Step } from '@/data/types';
import { LAYER, crossingsNearTrack } from '@/data/layer';
import { haversine, makeTrack, Track, toLatLngs } from '@/utils/geo';

/** Real-world speeds (m/s) used for ETA; the simulation multiplies them. */
export const SPEED: Record<Mode, number> = { walk: 1.35, metro: 11, bus: 6, taxi: 8, scooter: 4.2, bike: 4.5 };

export type Plan = {
  track: Track;
  legStart: number[]; // cumulative start distance of each leg
  legMode: Mode[];
  steps: Step[];
  hazards: { atM: number; text: string }[];
};

export function buildPlan(option: RouteOption, night: boolean): Plan {
  const pts: LatLng[] = [];
  const legStart: number[] = [];
  const legMode: Mode[] = [];
  let acc = 0;
  for (const leg of option.legs) {
    const ll = toLatLngs(leg.c);
    legStart.push(acc);
    legMode.push(leg.mode);
    if (pts.length && ll.length) {
      const last = pts[pts.length - 1];
      acc += haversine(last.latitude, last.longitude, ll[0].latitude, ll[0].longitude);
    }
    for (let i = 0; i < ll.length; i++) {
      if (i > 0) acc += haversine(ll[i - 1].latitude, ll[i - 1].longitude, ll[i].latitude, ll[i].longitude);
      pts.push(ll[i]);
    }
  }
  const track = makeTrack(pts);
  // re-anchor legStart to the actual track distances
  {
    let idx = 0;
    for (let li = 0; li < option.legs.length; li++) {
      legStart[li] = track.cum[idx] ?? 0;
      idx += option.legs[li].c.length / 2;
    }
  }
  const steps = [...option.steps]
    .map((s) => ({ ...s, atM: alongOf(track, s.lat, s.lon) }))
    .sort((a, b) => a.atM - b.atM);

  // Hazards: risky crossings close to (but not on) the walking parts.
  const hazards: { atM: number; text: string }[] = [];
  const walkPts: LatLng[] = [];
  option.legs.forEach((l) => {
    if (l.mode === 'walk') walkPts.push(...toLatLngs(l.c));
  });
  const near = crossingsNearTrack(walkPts, 70);
  const candidates = near
    .map((i) => LAYER.crossings[i])
    .filter((c) => (night ? c[4] : c[3]) < 50 && c[2] !== 0)
    .map((c) => ({ c, atM: alongOf(track, c[0], c[1]) }))
    .sort((a, b) => a.atM - b.atM);
  for (const h of candidates) {
    if (hazards.length >= 3) break;
    if (h.atM < 120) continue;
    if (hazards.some((x) => Math.abs(x.atM - h.atM) < 250)) continue;
    const lanes = h.c[5];
    hazards.push({
      atM: h.atM,
      text: h.c[2] === 2 ? `Nişansız keçid${lanes ? ' · ' + lanes + ' zolaq' : ''}` : `İşıqforsuz keçid${lanes ? ' · ' + lanes + ' zolaq' : ''}`,
    });
  }
  // Always have at least one alert on the walking part for the demo.
  if (!hazards.length) {
    const wi = legMode.lastIndexOf('walk');
    if (wi >= 0) {
      const start = legStart[wi];
      const end = wi + 1 < legStart.length ? legStart[wi + 1] : track.total;
      if (end - start > 200) hazards.push({ atM: start + (end - start) * 0.45, text: 'İşıqforsuz keçid · 4 zolaq' });
    }
  }
  return { track, legStart, legMode, steps, hazards };
}

function alongOf(track: Track, lat: number, lon: number) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < track.pts.length; i++) {
    const d = haversine(lat, lon, track.pts[i].latitude, track.pts[i].longitude);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return track.cum[best] ?? 0;
}

export function legAt(plan: Plan, d: number) {
  let li = 0;
  for (let i = 0; i < plan.legStart.length; i++) if (d >= plan.legStart[i]) li = i;
  return li;
}

/** Remaining real-world minutes from distance d. */
export function remainingMinutes(plan: Plan, d: number) {
  let sec = 0;
  for (let i = 0; i < plan.legStart.length; i++) {
    const start = plan.legStart[i];
    const end = i + 1 < plan.legStart.length ? plan.legStart[i + 1] : plan.track.total;
    const from = Math.max(start, d);
    if (end > from) sec += (end - from) / SPEED[plan.legMode[i]];
  }
  return Math.max(0, Math.round(sec / 60));
}

export const STEP_TEXT: Record<string, { text: string; icon: string }> = {
  left: { text: 'sonra sola', icon: 'arrow-top-left-thick' },
  right: { text: 'sonra sağa', icon: 'arrow-top-right-thick' },
  'slight-left': { text: 'sonra yüngül sola', icon: 'arrow-top-left' },
  'slight-right': { text: 'sonra yüngül sağa', icon: 'arrow-top-right' },
  straight: { text: 'düz get', icon: 'arrow-up-thick' },
  uturn: { text: 'sonra geri dön', icon: 'arrow-u-down-left-bold' },
  depart: { text: 'yola başla', icon: 'arrow-up-thick' },
  arrive: { text: 'sonra çatırsan', icon: 'flag-checkered' },
  board: { text: 'metroya/avtobusa min', icon: 'subway-variant' },
  alight: { text: 'sonra düş', icon: 'location-exit' },
};
