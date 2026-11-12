import { useEffect, useMemo, useRef, useState } from 'react';
import type { LatLng, Leg, RouteOption } from '@/data/types';
import { LAYER, crossingsNearTrack } from '@/data/layer';
import { haversine, toLatLngs } from '@/utils/geo';
import { prefs } from '@/store/prefs';

/** PERF: LatLng arrays are built once per leg geometry. */
const llCache = new WeakMap<number[], LatLng[]>();
export function legLatLngs(leg: Leg): LatLng[] {
  let v = llCache.get(leg.c);
  if (!v) {
    v = toLatLngs(leg.c);
    llCache.set(leg.c, v);
  }
  return v;
}

/** Metro tunnel legs: explicit flag from the data, else every metro leg is underground. */
export function isUnderground(leg: Leg) {
  return leg.underground ?? leg.mode === 'metro';
}

export function lineLength(pts: LatLng[]) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += haversine(pts[i - 1].latitude, pts[i - 1].longitude, pts[i].latitude, pts[i].longitude);
  return d;
}

export type Station = { name: string; lat: number; lon: number };

function nearestStation(p: LatLng, maxM: number): Station | null {
  let best: Station | null = null;
  let bd = maxM;
  for (const s of LAYER.stations) {
    const d = haversine(p.latitude, p.longitude, s.lat, s.lon);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

/**
 * Stations of a metro leg (board … alight). Uses `leg.stations` when the data has them;
 * otherwise snaps the leg's vertices to known stations (endpoints always included).
 */
export function legStations(leg: Leg, opt?: RouteOption): Station[] {
  if (leg.stations?.length) return leg.stations;
  if (leg.mode !== 'metro' && leg.mode !== 'bus') return [];
  const pts = legLatLngs(leg);
  if (!pts.length) return [];
  const out: Station[] = [];
  const named = (p: LatLng, fallback: string): Station => {
    const s = nearestStation(p, 350);
    return s ? { ...s, lat: p.latitude, lon: p.longitude } : { name: fallback, lat: p.latitude, lon: p.longitude };
  };
  const stepName = (type: 'board' | 'alight') => opt?.steps.find((s) => s.type === type && haversine(s.lat, s.lon, type === 'board' ? pts[0].latitude : pts[pts.length - 1].latitude, type === 'board' ? pts[0].longitude : pts[pts.length - 1].longitude) < 250)?.street;
  out.push(named(pts[0], stepName('board') ?? (leg.mode === 'bus' ? 'Dayanacaq' : 'Stansiya')));
  if (leg.mode === 'metro') {
    for (let i = 1; i < pts.length - 1; i++) {
      const s = nearestStation(pts[i], 160);
      if (s && !out.some((o) => o.name === s.name)) out.push({ ...s, lat: pts[i].latitude, lon: pts[i].longitude });
    }
  }
  if (pts.length > 1) {
    const last = named(pts[pts.length - 1], stepName('alight') ?? (leg.mode === 'bus' ? 'Dayanacaq' : 'Stansiya'));
    if (!out.some((o) => o.name === last.name)) out.push(last);
    else out.push({ ...last, name: stepName('alight') ?? last.name });
  }
  // board/alight names from the route steps win (they match the spoken instructions)
  const b = stepName('board');
  const a = stepName('alight');
  if (b) out[0] = { ...out[0], name: b };
  if (a && out.length > 1) out[out.length - 1] = { ...out[out.length - 1], name: a };
  return out;
}

/** All coordinates of a route (for camera fitting). */
export function routePoints(o: RouteOption): LatLng[] {
  return o.legs.flatMap((l) => legLatLngs(l));
}

/** Per-leg geometry + cumulative lengths for progressive drawing. */
export type LegGeo = { pts: LatLng[]; len: number; start: number };
export function legGeos(o: RouteOption): { legs: LegGeo[]; total: number } {
  let acc = 0;
  const legs = o.legs.map((l) => {
    const pts = legLatLngs(l);
    const len = Math.max(1, lineLength(pts));
    const g = { pts, len, start: acc };
    acc += len;
    return g;
  });
  return { legs, total: acc };
}

/** Fraction (0..1) of leg i that is drawn when the whole route is drawn to t. */
export function legFraction(g: { legs: LegGeo[]; total: number }, i: number, t: number) {
  const want = g.total * t;
  const l = g.legs[i];
  if (!l) return 0;
  if (want <= l.start) return 0;
  return Math.min(1, (want - l.start) / l.len);
}

/** Risky / signalized crossings next to the walking (surface) parts of a route. */
export function crossingsAlong(o: RouteOption, radiusM = 28, max = 40): number[] {
  const pts: LatLng[] = [];
  for (const l of o.legs) {
    if (isUnderground(l) || l.mode === 'taxi' || l.mode === 'bus') continue;
    const ll = legLatLngs(l);
    for (let i = 0; i < ll.length; i++) pts.push(ll[i]);
  }
  if (!pts.length) return [];
  try {
    return crossingsNearTrack(pts, radiusM).slice(0, max);
  } catch {
    return [];
  }
}

export function midpoint(pts: LatLng[]): LatLng | null {
  if (!pts.length) return null;
  const len = lineLength(pts);
  let want = len / 2;
  for (let i = 1; i < pts.length; i++) {
    const d = haversine(pts[i - 1].latitude, pts[i - 1].longitude, pts[i].latitude, pts[i].longitude);
    if (want <= d) {
      const f = d ? want / d : 0;
      return {
        latitude: pts[i - 1].latitude + (pts[i].latitude - pts[i - 1].latitude) * f,
        longitude: pts[i - 1].longitude + (pts[i].longitude - pts[i - 1].longitude) * f,
      };
    }
    want -= d;
  }
  return pts[pts.length - 1];
}

/**
 * 0→1 draw progress keyed by `key` (restarts when the key changes). JS-driven, throttled
 * to ~30 fps so only a few polylines re-render; instant in lite mode.
 */
export function useDrawProgress(key: string, opts: { duration?: number; delay?: number; enabled?: boolean } = {}) {
  const { duration = 1000, delay = 0, enabled = true } = opts;
  const skip = !enabled || prefs().liteFx;
  const [t, setT] = useState(skip ? 1 : 0);
  useEffect(() => {
    if (skip) {
      setT(1);
      return;
    }
    setT(0);
    let raf = 0;
    let last = 0;
    const t0 = setTimeout(() => {
      const start = Date.now();
      const step = () => {
        const now = Date.now();
        const p = Math.min(1, (now - start) / duration);
        if (now - last > 33 || p >= 1) {
          last = now;
          setT(1 - Math.pow(1 - p, 3));
        }
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(t0);
      cancelAnimationFrame(raf);
    };
  }, [key, skip, duration, delay]);
  return t;
}

/** Smoothly tween a coordinate (marker moves) — ~30 fps, spring-like overshoot. */
export function useTweenCoord(target: LatLng | null, duration = 750): LatLng | null {
  const [cur, setCurState] = useState<LatLng | null>(target);
  const curRef = useRef<LatLng | null>(target);
  const setCur = (v: LatLng | null) => {
    curRef.current = v;
    setCurState(v);
  };
  const key = target ? `${target.latitude.toFixed(6)},${target.longitude.toFixed(6)}` : '';
  useEffect(() => {
    if (!target) {
      setCur(null);
      return;
    }
    const from = curRef.current;
    if (!from || prefs().liteFx) {
      setCur(target);
      return;
    }
    const a: LatLng = from;
    const start = Date.now();
    let raf = 0;
    let last = 0;
    const step = () => {
      const now = Date.now();
      const p = Math.min(1, (now - start) / duration);
      // easeOutBack: lands with a soft overshoot (spring feel)
      const c1 = 1.4;
      const e = 1 + (c1 + 1) * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
      if (now - last > 33 || p >= 1) {
        last = now;
        setCur({ latitude: a.latitude + (target.latitude - a.latitude) * e, longitude: a.longitude + (target.longitude - a.longitude) * e });
      }
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, duration]);
  return cur;
}

/** Memoized LatLngs for a flat coordinate array. */
export function useLatLngs(flat: number[] | undefined | null) {
  return useMemo(() => (flat ? toLatLngs(flat) : []), [flat]);
}
