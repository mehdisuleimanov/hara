import { useEffect, useMemo, useState } from 'react';
import { prefs } from '@/store/prefs';

export type LatLng = { latitude: number; longitude: number };

function dist(a: LatLng, b: LatLng) {
  const dx = (b.longitude - a.longitude) * Math.cos(((a.latitude + b.latitude) / 2) * (Math.PI / 180));
  const dy = b.latitude - a.latitude;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Cut a polyline at fraction t (0..1) of its length, interpolating the tip. */
export function sliceByFraction(coords: LatLng[], t: number): LatLng[] {
  if (coords.length < 2 || t >= 1) return coords;
  if (t <= 0) return coords.slice(0, 1);
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const d = dist(coords[i - 1], coords[i]);
    seg.push(d);
    total += d;
  }
  let want = total * t;
  const out: LatLng[] = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const d = seg[i - 1];
    if (want > d) {
      out.push(coords[i]);
      want -= d;
    } else {
      const f = d === 0 ? 0 : want / d;
      const a = coords[i - 1];
      const b = coords[i];
      out.push({ latitude: a.latitude + (b.latitude - a.latitude) * f, longitude: a.longitude + (b.longitude - a.longitude) * f });
      break;
    }
  }
  return out;
}

/**
 * Animated "drawing" of a route for react-native-maps <Polyline coordinates={...} />.
 * Throttled to ~30 fps; returns the full line immediately in lite mode or when disabled.
 */
export function useRouteDraw(coords: LatLng[], opts: { duration?: number; delay?: number; enabled?: boolean } = {}) {
  const { duration = 900, delay = 0, enabled = true } = opts;
  const key = useMemo(() => `${coords.length}:${coords[0]?.latitude}:${coords[coords.length - 1]?.longitude}`, [coords]);
  const skip = !enabled || prefs().liteFx || coords.length < 2;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, skip, duration, delay]);
  return useMemo(() => sliceByFraction(coords, t), [coords, t]);
}
