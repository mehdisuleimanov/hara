import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { log } from './log';

/** Live Baku weather from Open-Meteo (no key). Cached 10 min; falls back to the store values. */
export type Weather = {
  windSpeed: number; // m/s
  windGust: number; // m/s
  windDir: number; // degrees
  tempC: number;
  precipitation: number; // mm
  isDay: boolean;
  source: 'live' | 'cache' | 'store';
  at: number;
};

const URL =
  'https://api.open-meteo.com/v1/forecast?latitude=40.3777&longitude=49.8920&current=temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m,is_day&wind_speed_unit=ms&timezone=Asia%2FBaku';

let cache: Weather | null = null;

export async function getWeather(timeoutMs = 3500): Promise<Weather> {
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return { ...cache, source: 'cache' };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(URL, { signal: ctrl.signal });
    const j = await res.json();
    const c = j?.current;
    if (!c) throw new Error('no current');
    cache = {
      windSpeed: Math.round(c.wind_speed_10m * 10) / 10,
      windGust: Math.round(c.wind_gusts_10m * 10) / 10,
      windDir: c.wind_direction_10m,
      tempC: Math.round(c.temperature_2m),
      precipitation: c.precipitation ?? 0,
      isDay: c.is_day === 1,
      source: 'live',
      at: Date.now(),
    };
    return cache;
  } catch (e) {
    log('[weather] fallback', String(e));
    const s = useAppStore.getState();
    return { windSpeed: s.windSpeed, windGust: s.windGust, windDir: 0, tempC: 14, precipitation: 0, isDay: true, source: 'store', at: Date.now() };
  } finally {
    clearTimeout(t);
  }
}

/** Hook: live weather (refreshes on mount). */
export function useWeather() {
  const [w, setW] = useState<Weather | null>(cache);
  useEffect(() => {
    let alive = true;
    getWeather().then((x) => alive && setW(x));
    return () => {
      alive = false;
    };
  }, []);
  return w;
}
