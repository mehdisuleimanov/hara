import { LAYER, CROSSING_TYPE } from '@/data/layer';
import { DESTINATIONS, ORIGIN } from '@/data/destinations';
import type { Report } from '@/data/types';
import type { Weather } from '@/utils/weather';

export const USER_NAME = 'Aysel';

/** Time-of-day greeting (sən form). */
export function greeting(h = new Date().getHours()) {
  if (h >= 5 && h < 12) return 'Sabahın xeyir';
  if (h >= 12 && h < 17) return 'Günortan xeyir';
  if (h >= 17 && h < 24) return 'Axşamın xeyir';
  return 'Gecən sakit keçsin';
}

/** What Əhməd says on the home screen — grounded in live weather + time of day. */
export function ahmedLine(w: Weather | null, night: boolean) {
  const wind = w?.windSpeed ?? null;
  if (w && w.precipitation > 0.2) return 'Yağış yağır. Səkiləri sürüşkən olmayan, örtülü yolları seçərəm.';
  if (wind != null && wind >= 8) {
    const v = String(wind).replace('.', ',');
    return night
      ? `Külək ${v} m/s-dir, hava da qaranlıqdır. Sahil boyu yox, işıqlı küçələrlə aparım.`
      : `Külək ${v} m/s-dir. Sahil boyu yox, binaların arası ilə aparım.`;
  }
  if (night) return 'Gecədir. Hara getsən, işıqlı küçələr və işıqforlu keçidlərlə aparım.';
  return 'Hara getsən, ən az riskli yolu tapım. Səslə de, ya da yaz.';
}

const R_EARTH = 6371000;
export function distM(aLat: number, aLon: number, bLat: number, bLon: number) {
  const k = Math.PI / 180;
  const dLat = (bLat - aLat) * k;
  const dLon = (bLon - aLon) * k;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * k) * Math.cos(bLat * k) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(s));
}

/** Reports within `radiusM` of the user. */
export function nearbyReports(reports: Report[], radiusM = 2000) {
  return reports.filter((r) => distM(ORIGIN.lat, ORIGIN.lon, r.lat, r.lon) <= radiusM);
}

const STATION_NAME: Record<string, string> = {
  'Metro elmlər': 'Elmlər Akademiyası m.',
  '20 Yanvar st.': '20 Yanvar m.',
  'Azadlıq prospekti': 'Azadlıq pr. m.',
};

function landmarks() {
  const out: { name: string; lat: number; lon: number }[] = [];
  for (const s of LAYER.stations) {
    if (/^Y\d|deposu|çıxış/i.test(s.name)) continue;
    out.push({ name: STATION_NAME[s.name] ?? `${s.name} m.`, lat: s.lat, lon: s.lon });
  }
  for (const d of DESTINATIONS) if (d.id !== 'ev' && d.id !== 'nizami') out.push({ name: d.short, lat: d.lat, lon: d.lon });
  return out;
}

export type RiskSpot = { lat: number; lon: number; type: string; lanes: number; score: number; near: string; distM: number };

/**
 * The riskiest crossings around the user from the real safety layer (night scores),
 * spaced apart so the list names three different places.
 */
export function riskiestCrossings(n = 3, night = true, radiusM = 3000): { spots: RiskSpot[]; total: number } {
  const cs = LAYER.crossings;
  const lm = landmarks();
  const cand: { c: (typeof cs)[number]; d: number }[] = [];
  for (const c of cs) {
    const d = distM(ORIGIN.lat, ORIGIN.lon, c[0], c[1]);
    if (d <= radiusM) cand.push({ c, d });
  }
  const sc = (c: (typeof cs)[number]) => (night ? c[4] : c[3]);
  cand.sort((a, b) => sc(a.c) - sc(b.c) || (b.c[5] ?? 0) - (a.c[5] ?? 0));
  const spots: RiskSpot[] = [];
  const usedNear = new Set<string>();
  for (const { c, d } of cand) {
    if (spots.length >= n) break;
    if (spots.some((s) => distM(s.lat, s.lon, c[0], c[1]) < 350)) continue;
    let best = lm[0];
    let bestD = Infinity;
    for (const l of lm) {
      const dd = distM(l.lat, l.lon, c[0], c[1]);
      if (dd < bestD) {
        bestD = dd;
        best = l;
      }
    }
    if (!best || usedNear.has(best.name)) continue;
    usedNear.add(best.name);
    spots.push({
      lat: c[0],
      lon: c[1],
      type: CROSSING_TYPE[c[2]] ?? 'Keçid',
      lanes: c[5] ?? 0,
      score: Math.round(sc(c)),
      near: `${best.name} yaxınlığı`,
      distM: d,
    });
  }
  return { spots, total: cs.length };
}
