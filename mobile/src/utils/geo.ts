import type { LatLng } from '@/data/types';

export function toLatLngs(flat: number[]): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i < flat.length; i += 2) out.push({ latitude: flat[i], longitude: flat[i + 1] });
  return out;
}

export function haversine(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function bearing(aLat: number, aLon: number, bLat: number, bLon: number) {
  const φ1 = (aLat * Math.PI) / 180;
  const φ2 = (bLat * Math.PI) / 180;
  const Δλ = ((bLon - aLon) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Precomputed polyline with cumulative distances for along-route lookups. */
export type Track = { pts: LatLng[]; cum: number[]; total: number };

export function makeTrack(pts: LatLng[]): Track {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + haversine(pts[i - 1].latitude, pts[i - 1].longitude, pts[i].latitude, pts[i].longitude));
  }
  return { pts, cum, total: cum[cum.length - 1] ?? 0 };
}

export function pointAt(track: Track, d: number): { p: LatLng; heading: number; index: number } {
  const { pts, cum, total } = track;
  if (pts.length < 2) return { p: pts[0], heading: 0, index: 0 };
  const dist = Math.max(0, Math.min(total, d));
  let i = 1;
  while (i < cum.length - 1 && cum[i] < dist) i++;
  const a = pts[i - 1];
  const b = pts[i];
  const seg = cum[i] - cum[i - 1] || 1;
  const t = (dist - cum[i - 1]) / seg;
  return {
    p: { latitude: a.latitude + (b.latitude - a.latitude) * t, longitude: a.longitude + (b.longitude - a.longitude) * t },
    heading: bearing(a.latitude, a.longitude, b.latitude, b.longitude),
    index: i,
  };
}

export function regionFor(points: LatLng[], pad = 1.5) {
  let minLat = 90,
    maxLat = -90,
    minLon = 180,
    maxLon = -180;
  for (const p of points) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLon = Math.min(minLon, p.longitude);
    maxLon = Math.max(maxLon, p.longitude);
  }
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max(0.006, (maxLat - minLat) * pad),
    longitudeDelta: Math.max(0.006, (maxLon - minLon) * pad),
  };
}

export function fmtDist(m: number) {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

export function clockPlus(minutes: number) {
  const d = new Date(Date.now() + minutes * 60000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
