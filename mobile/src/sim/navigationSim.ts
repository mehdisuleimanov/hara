import type { LatLng, Mode, RouteOption, Step } from '@/data/types';
import { LAYER, crossingsNearTrack } from '@/data/layer';
import { haversine, makeTrack, Track, toLatLngs } from '@/utils/geo';
import { isUnderground, legStations, type Station } from '@/features/map/geometry';

/** Real-world speeds (m/s) used for ETA; the simulation multiplies them. */
export const SPEED: Record<Mode, number> = { walk: 1.35, metro: 11, bus: 6, taxi: 8, scooter: 4.2, bike: 4.5 };

export type Hazard = {
  atM: number;
  lat: number;
  lon: number;
  /** 'unsignalized' zebra without lights | 'unmarked' crossing */
  kind: 'unsignalized' | 'unmarked';
  lanes: number;
  /** short label, e.g. "İşıqforsuz keçid · 4 zolaq" */
  text: string;
};

export type LegStops = { stations: Station[]; atM: number[] };

export type Plan = {
  track: Track;
  /** cumulative start distance of each leg */
  legStart: number[];
  legEnd: number[];
  legMode: Mode[];
  /** underground (metro tunnel) legs: never slide a walking puck over them */
  legUnder: boolean[];
  /** first track index of each leg */
  legIdx: number[];
  /** stations/stops of metro & bus legs with their along-track distance */
  stops: (LegStops | null)[];
  steps: Step[];
  hazards: Hazard[];
};

function alongRange(track: Track, lat: number, lon: number, from = 0, to = track.pts.length - 1) {
  let best = from;
  let bd = Infinity;
  for (let i = Math.max(0, from); i <= Math.min(to, track.pts.length - 1); i++) {
    const d = haversine(lat, lon, track.pts[i].latitude, track.pts[i].longitude);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return track.cum[best] ?? 0;
}

export function buildPlan(option: RouteOption, night: boolean): Plan {
  const pts: LatLng[] = [];
  const legIdx: number[] = [];
  for (const leg of option.legs) {
    legIdx.push(pts.length);
    const ll = toLatLngs(leg.c);
    for (const p of ll) pts.push(p);
  }
  const track = makeTrack(pts);
  const n = option.legs.length;
  const legStart = legIdx.map((i) => track.cum[Math.min(i, track.cum.length - 1)] ?? 0);
  const legEnd = legStart.map((_, i) => (i + 1 < n ? legStart[i + 1] : track.total));
  const legMode = option.legs.map((l) => l.mode);
  const legUnder = option.legs.map((l) => isUnderground(l));

  const stops = option.legs.map((l, li) => {
    if (l.mode !== 'metro' && l.mode !== 'bus') return null;
    const st = legStations(l, option);
    if (!st.length) return null;
    const from = legIdx[li];
    const to = li + 1 < n ? legIdx[li + 1] - 1 : track.pts.length - 1;
    const atM = st.map((s, k) => (k === 0 ? legStart[li] : k === st.length - 1 ? legEnd[li] : alongRange(track, s.lat, s.lon, from, to)));
    return { stations: st, atM };
  });

  const steps = [...option.steps].map((s) => ({ ...s, atM: alongRange(track, s.lat, s.lon) })).sort((a, b) => a.atM - b.atM);

  // Hazards: risky crossings right next to the walking parts (from the real safety layer).
  const walkPts: LatLng[] = [];
  option.legs.forEach((l) => {
    if (l.mode === 'walk' && !isUnderground(l) && !l.indoor) walkPts.push(...toLatLngs(l.c));
  });
  const hazards: Hazard[] = [];
  const collect = (radius: number) => {
    let near: number[] = [];
    try {
      near = crossingsNearTrack(walkPts, radius);
    } catch {
      near = [];
    }
    const candidates = near
      .map((i) => LAYER.crossings[i])
      .filter((c) => (night ? c[4] : c[3]) < 50 && (c[2] === 1 || c[2] === 2))
      .map((c) => ({ c, atM: alongRange(track, c[0], c[1]) }))
      .sort((a, b) => a.atM - b.atM);
    for (const h of candidates) {
      if (hazards.length >= 3) break;
      if (h.atM < 90 || h.atM > track.total - 25) continue;
      if (hazards.some((x) => Math.abs(x.atM - h.atM) < 220)) continue;
      const lanes = h.c[5];
      const kind = h.c[2] === 2 ? 'unmarked' : 'unsignalized';
      hazards.push({
        atM: h.atM,
        lat: h.c[0],
        lon: h.c[1],
        kind,
        lanes,
        text: `${kind === 'unmarked' ? 'Nişansız keçid' : 'İşıqforsuz keçid'}${lanes ? ' · ' + lanes + ' zolaq' : ''}`,
      });
    }
  };
  if (walkPts.length) {
    collect(60);
    if (!hazards.length) collect(90);
  }
  return { track, legStart, legEnd, legMode, legUnder, legIdx, stops, steps, hazards };
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
    const from = Math.max(plan.legStart[i], d);
    if (plan.legEnd[i] > from) sec += (plan.legEnd[i] - from) / SPEED[plan.legMode[i]];
  }
  return Math.max(0, Math.round(sec / 60));
}

/** Index of the last passed stop on a stops list (0 = boarding stop). */
export function stopIndex(stops: LegStops, d: number) {
  let k = 0;
  for (let i = 0; i < stops.atM.length; i++) if (d >= stops.atM[i] - 1) k = i;
  return k;
}

export const STEP_TEXT: Record<string, { text: string; icon: string }> = {
  left: { text: 'sola dön', icon: 'arrow-top-left-thick' },
  right: { text: 'sağa dön', icon: 'arrow-top-right-thick' },
  'slight-left': { text: 'bir az sola', icon: 'arrow-top-left' },
  'slight-right': { text: 'bir az sağa', icon: 'arrow-top-right' },
  straight: { text: 'düz get', icon: 'arrow-up-thick' },
  uturn: { text: 'geri dön', icon: 'arrow-u-down-left-bold' },
  depart: { text: 'yola başla', icon: 'arrow-up-thick' },
  arrive: { text: 'çatırsan', icon: 'flag-checkered' },
  board: { text: 'min', icon: 'subway-variant' },
  alight: { text: 'düş', icon: 'location-exit' },
};
