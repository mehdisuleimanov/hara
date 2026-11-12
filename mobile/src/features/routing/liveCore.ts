/**
 * Live routing core (pure, dependency-injected: no React Native / Expo / path-alias imports, so a
 * plain Node harness can run it). live.ts wires it to fetch, the safety layer and the scorer.
 *
 *  geocode  Photon (komoot) biased to Baku → Nominatim fallback (Baku viewbox, bounded=1,
 *           generic User-Agent, no personal data). Only results inside the Baku bbox count.
 *  route    FOSSGIS OSRM (routing.openstreetmap.de) foot + car from the origin pin.
 *  options  safest  = lowest-risk of {OSRM foot alternatives, metro + best walk}
 *           cheapest= shortest walk (≤3 km) or metro trip (0,60 ₼)
 *           fastest = taxi (OSRM car) + foot connectors
 *  scores   scoreWalk() — the same weakest-link model as the catalog (scoring.ts).
 *  tariffs  walk = OSRM foot × 1.1 · metro 3 min wait + 2.2 min/hop (+3 transfer), 0,60 ₼ ·
 *           taxi = OSRM car × 1.3 + 3 min pickup, 2.4 + 0.85 ₼/km (±1 ₼) ·
 *           CO₂ g/km: metro 20, taxi 170.
 */
import type { Leg, Profile, RouteOption, Step, StepType, TimeOfDay } from '../../data/types';
import type { LayerData, WalkScore } from './scoring';

export type LivePlace = { name: string; district?: string; lat: number; lon: number };
export type LiveRoute = { id: string; place: LivePlace; options: RouteOption[]; computedAt: number };
export type RouteToInput = { query: string } | { lat: number; lon: number; name?: string };

export type FetchJson = (url: string, timeoutMs: number, headers?: Record<string, string>) => Promise<unknown>;

export type LiveDeps = {
  fetchJson: FetchJson;
  layer: LayerData;
  stations: { name: string; lat: number; lon: number }[];
  scoreWalk: (layer: LayerData, walks: number[][]) => WalkScore;
  origin: { lat: number; lon: number; name: string };
  log?: (...a: unknown[]) => void;
};

export const BAKU_BBOX = { s: 40.28, w: 49.68, n: 40.62, e: 50.15 };
const GEOCODE_MS = 3000;
const ROUTE_MS = 4000;
const UA = { 'User-Agent': 'Hara/1.0', 'Accept-Language': 'az,en' };
const WALK_M_PER_MIN = 75;

const RED = ['İçərişəhər', 'Sahil', '28 May', 'Gənclik', 'Nəriman Nərimanov', 'Ulduz', 'Koroğlu', 'Qara Qarayev', 'Neftçilər', 'Xalqlar Dostluğu', 'Əhmədli', 'Həzi Aslanov'];
const GREEN = ['Xətai', 'Cəfər Cabbarlı', 'Nizami', 'Elmlər Akademiyası', 'İnşaatçılar', '20 Yanvar', 'Memar Əcəmi', 'Nəsimi', 'Azadlıq prospekti', 'Dərnəgül'];

const toRad = (d: number) => (d * Math.PI) / 180;
const r5 = (v: number) => Math.round(v * 1e5) / 1e5;
const r1 = (v: number) => Math.round(v * 10) / 10;
type P = [number, number];

export function hav(a: P, b: P) {
  const R = 6371000, dLat = toRad(b[0] - a[0]), dLon = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const lineLen = (pts: P[]) => pts.reduce((s, p, i) => (i ? s + hav(pts[i - 1], p) : 0), 0);
const flat = (pts: P[]) => pts.flatMap(([a, b]) => [r5(a), r5(b)]);
const inBaku = (lat: number, lon: number) => lat >= BAKU_BBOX.s && lat <= BAKU_BBOX.n && lon >= BAKU_BBOX.w && lon <= BAKU_BBOX.e;
const round10 = (m: number) => Math.max(10, Math.round(m / 10) * 10);
export const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ə/g, 'e')
    .replace(/ı/g, 'i')
    .replace(/i̇/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/[^a-z0-9]/g, '');

function densify3(pts: P[]): P[] {
  if (pts.length >= 3) return pts;
  const a = pts[0], b = pts[pts.length - 1];
  return [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b];
}

/** remove out-and-back loops (OSRM via-point artefacts) */
function despur(pts: P[]): P[] {
  const out: P[] = [];
  for (const p of pts) {
    if (out.length && hav(out[out.length - 1], p) < 0.5) continue;
    out.push(p);
    let acc = 0;
    for (let k = out.length - 2; k >= Math.max(0, out.length - 120); k--) {
      acc += hav(out[k], out[k + 1]);
      if (acc > 400) break;
      if (k <= out.length - 3 && acc > 6 && hav(out[k], p) < 3) {
        out.length = k + 1;
        break;
      }
    }
  }
  return out;
}

// ─────────────────────────────────────────── geocoding
type PhotonFeature = { geometry?: { coordinates?: [number, number] }; properties?: Record<string, string | undefined> };
type NominatimHit = { lat: string; lon: string; name?: string; display_name?: string; address?: Record<string, string> };

export async function geocode(query: string, deps: LiveDeps): Promise<LivePlace | null> {
  const q = query.trim();
  if (q.length < 2) return null;
  const tries = /bak[ıiu]|baku/i.test(q) ? [q] : [q, `${q}, Bakı`];
  for (const t of tries) {
    try {
      const url =
        `https://photon.komoot.io/api/?q=${encodeURIComponent(t)}&lat=40.38&lon=49.85&limit=5` +
        `&bbox=${BAKU_BBOX.w},${BAKU_BBOX.s},${BAKU_BBOX.e},${BAKU_BBOX.n}`;
      const j = (await deps.fetchJson(url, GEOCODE_MS)) as { features?: PhotonFeature[] };
      for (const f of j.features ?? []) {
        const c = f.geometry?.coordinates;
        if (!c || !inBaku(c[1], c[0])) continue;
        const p = f.properties ?? {};
        const name = p.name ?? p.street ?? t;
        const district = [p.district, p.locality, p.city].find((x) => x && !/\d/.test(x));
        return { name, district, lat: r5(c[1]), lon: r5(c[0]) };
      }
    } catch (e) {
      deps.log?.('live: photon', e);
    }
  }
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=5&addressdetails=1` +
      `&viewbox=${BAKU_BBOX.w},${BAKU_BBOX.n},${BAKU_BBOX.e},${BAKU_BBOX.s}&bounded=1&accept-language=az`;
    const j = (await deps.fetchJson(url, GEOCODE_MS, UA)) as NominatimHit[];
    for (const h of Array.isArray(j) ? j : []) {
      const lat = parseFloat(h.lat), lon = parseFloat(h.lon);
      if (!inBaku(lat, lon)) continue;
      const a = h.address ?? {};
      const name = h.name || h.display_name?.split(',')[0] || q;
      return { name, district: a.city_district ?? a.suburb ?? a.city, lat: r5(lat), lon: r5(lon) };
    }
  } catch (e) {
    deps.log?.('live: nominatim', e);
  }
  return null;
}

// ─────────────────────────────────────────── OSRM
type OsrmStep = { maneuver: { type: string; modifier?: string; location: [number, number] }; name?: string; distance: number };
type OsrmRoute = { geometry: { coordinates: [number, number][] }; legs: { steps: OsrmStep[] }[]; distance: number; duration: number };
type Track = { pts: P[]; steps: { lat: number; lon: number; type: StepType; street?: string; dist: number }[]; distance: number; duration: number };

function stepType(m: OsrmStep['maneuver']): StepType {
  const t = m.type, mod = m.modifier ?? '';
  if (t === 'depart') return 'depart';
  if (t === 'arrive') return 'arrive';
  if (mod.includes('uturn')) return 'uturn';
  if (mod === 'slight left') return 'slight-left';
  if (mod === 'slight right') return 'slight-right';
  if (mod.includes('left')) return 'left';
  if (mod.includes('right')) return 'right';
  return 'straight';
}
function track(r: OsrmRoute): Track {
  const pts = despur(r.geometry.coordinates.map(([lon, lat]) => [lat, lon] as P));
  const steps: Track['steps'] = [];
  let acc = 0;
  for (const leg of r.legs)
    for (const s of leg.steps) {
      const type = stepType(s.maneuver);
      if (type !== 'straight' || s.name) steps.push({ lat: s.maneuver.location[1], lon: s.maneuver.location[0], type, street: s.name || undefined, dist: acc });
      acc += s.distance;
    }
  return { pts, steps, distance: lineLen(pts), duration: r.duration };
}
async function osrm(deps: LiveDeps, profile: 'foot' | 'car', pts: P[], alternatives = 0): Promise<Track[]> {
  const coords = pts.map(([lat, lon]) => `${lon.toFixed(6)},${lat.toFixed(6)}`).join(';');
  const url = `https://routing.openstreetmap.de/routed-${profile}/route/v1/driving/${coords}?alternatives=${alternatives}&steps=true&geometries=geojson&overview=full`;
  const j = (await deps.fetchJson(url, ROUTE_MS)) as { code?: string; routes?: OsrmRoute[] };
  if (j.code !== 'Ok' || !j.routes?.length) throw new Error('osrm ' + (j.code ?? 'empty'));
  return j.routes.map(track);
}

// ─────────────────────────────────────────── metro (straight station hops, drawn underground)
function stationOf(deps: LiveDeps, name: string) {
  const n = norm(name);
  return deps.stations.find((s) => norm(s.name) === n) ?? deps.stations.find((s) => norm(s.name).includes(n) || n.includes(norm(s.name)));
}
function lineOf(name: string) {
  return RED.includes(name) ? RED : GREEN.includes(name) ? GREEN : null;
}
function nearestStation(deps: LiveDeps, p: P) {
  let best: { name: string; s: { name: string; lat: number; lon: number }; d: number } | null = null;
  for (const name of [...RED, ...GREEN]) {
    const s = stationOf(deps, name);
    if (!s) continue;
    const d = hav(p, [s.lat, s.lon]);
    if (!best || d < best.d) best = { name, s, d };
  }
  return best;
}
function metroLegs(deps: LiveDeps, from: string, to: string): { legs: Leg[]; hops: number; transfer: boolean } | null {
  const lf = lineOf(from), lt = lineOf(to);
  if (!lf || !lt) return null;
  const seg = (line: string[], a: string, b: string) => {
    const i = line.indexOf(a), j = line.indexOf(b);
    return i <= j ? line.slice(i, j + 1) : line.slice(j, i + 1).reverse();
  };
  const parts = lf === lt ? [seg(lf, from, to)] : [seg(lf, from, lf === RED ? '28 May' : 'Cəfər Cabbarlı'), seg(lt, lt === RED ? '28 May' : 'Cəfər Cabbarlı', to)];
  const legs: Leg[] = [];
  let hops = 0;
  for (const names of parts) {
    if (names.length < 2) continue;
    const sts = names.map((n) => stationOf(deps, n)).filter((s): s is { name: string; lat: number; lon: number } => !!s);
    if (sts.length !== names.length) return null;
    const pts = sts.map((s) => [s.lat, s.lon] as P);
    if (legs.length) {
      const prev = legs[legs.length - 1];
      const a: P = [prev.c[prev.c.length - 2], prev.c[prev.c.length - 1]];
      legs.push({ mode: 'walk', indoor: true, c: flat(densify3([a, pts[0]])), label: `Keçid · ${names[0]}`, distanceM: Math.round(hav(a, pts[0]) + 60), durationMin: 3 });
    }
    hops += sts.length - 1;
    legs.push({
      mode: 'metro',
      underground: true,
      c: flat(pts),
      stations: sts.map((s, i) => ({ name: names[i], lat: r5(s.lat), lon: r5(s.lon) })),
      label: `Metro · ${sts.length - 1} dayanacaq`,
      distanceM: Math.round(lineLen(pts)),
      durationMin: r1(3 + (sts.length - 1) * 2.2),
    });
  }
  return legs.length ? { legs, hops, transfer: lf !== lt } : null;
}

// ─────────────────────────────────────────── assembly
type Draft = { kind: RouteOption['kind']; legs: Leg[]; steps: Step[]; price: string; reasons: string[]; warning?: string };

function walkLeg(t: Track, speed: number): Leg {
  const pts = densify3(t.pts);
  return { mode: 'walk', c: flat(pts), distanceM: Math.round(t.distance), durationMin: r1(((t.duration / 60) * 1.1) / speed) };
}
function stepsFor(legs: Leg[], tracks: (Track | null)[]): Step[] {
  const out: Step[] = [];
  let acc = 0;
  legs.forEach((l, li) => {
    const t = tracks[li];
    if (t) for (const s of t.steps) if (s.type !== 'arrive') out.push({ lat: r5(s.lat), lon: r5(s.lon), type: s.type, street: s.street, atM: Math.round(acc + s.dist), leg: li });
    if (l.mode === 'metro' && l.stations?.length) {
      const a = l.stations[0], b = l.stations[l.stations.length - 1];
      out.push({ lat: a.lat, lon: a.lon, type: 'board', street: a.name, atM: Math.round(acc), leg: li });
      out.push({ lat: b.lat, lon: b.lon, type: 'alight', street: b.name, atM: Math.round(acc + l.distanceM), leg: li });
    }
    acc += l.distanceM;
  });
  const last = legs[legs.length - 1];
  out.push({ lat: last.c[last.c.length - 2], lon: last.c[last.c.length - 1], type: 'arrive', atM: Math.round(acc), leg: legs.length - 1 });
  return out;
}
function crossingWords(s: WalkScore) {
  const parts: string[] = [];
  if (s.signals) parts.push(`${s.signals} işıqforlu/yeraltı keçid`);
  parts.push(s.unsignalized ? `${s.unsignalized} işıqforsuz keçid` : 'işıqforsuz keçid yoxdur');
  return parts.join(', ');
}

function finalize(id: string, d: Draft, s: WalkScore): RouteOption {
  const co2 = d.legs.reduce((sum, l) => sum + (l.mode === 'metro' ? 20 : l.mode === 'taxi' ? 170 : 0) * (l.distanceM / 1000), 0);
  const o: RouteOption = {
    id: `${id}-${d.kind}`,
    destId: `live:${id}`,
    kind: d.kind,
    legs: d.legs,
    durationMin: Math.max(1, Math.round(d.legs.reduce((sum, l) => sum + l.durationMin, 0))),
    distanceM: Math.round(d.legs.reduce((sum, l) => sum + l.distanceM, 0)),
    price: d.price,
    co2g: Math.round(co2),
    scoreDay: s.day,
    scoreNight: s.night,
    avoided: 0,
    unsignalized: s.unsignalized,
    reasons: d.reasons,
    steps: d.steps,
  };
  if (d.warning) o.warning = d.warning;
  return o;
}
const sameGeometry = (a: RouteOption, b: RouteOption) => {
  const ca = a.legs.flatMap((l) => l.c), cb = b.legs.flatMap((l) => l.c);
  return ca.length === cb.length && ca.every((v, i) => Math.abs(v - cb[i]) < 1e-5);
};

/** Build up to three scored options from the origin to `place`. Throws on network failure. */
export async function buildOptions(id: string, place: LivePlace, deps: LiveDeps, opts: { profile?: Profile; time?: TimeOfDay }): Promise<RouteOption[]> {
  const O: P = [deps.origin.lat, deps.origin.lon];
  const D: P = [place.lat, place.lon];
  const night = (opts.time ?? 'day') === 'night';
  const speed = opts.profile === 'accessible' ? 0.8 : 1;
  const direct = hav(O, D);
  const score = (legs: Leg[]) => deps.scoreWalk(deps.layer, legs.filter((l) => l.mode === 'walk' && !l.indoor).map((l) => l.c));
  const key = (s: WalkScore) => (night ? s.night * 1000 + s.day : s.day * 1000 + s.night);

  const [footR, carR] = await Promise.allSettled([
    direct <= 6000 ? osrm(deps, 'foot', [O, D], 2) : Promise.resolve([] as Track[]),
    osrm(deps, 'car', [O, D]),
  ]);
  const walks = footR.status === 'fulfilled' ? footR.value : [];

  const drafts: { d: Draft; s: WalkScore }[] = [];
  // walking options
  const walkScored = walks.map((t) => {
    const legs = [walkLeg(t, speed)];
    return { t, legs, s: score(legs) };
  });

  // metro + walk (station near both ends)
  let metroDraft: { d: Draft; s: WalkScore } | null = null;
  const so = nearestStation(deps, O), sd = nearestStation(deps, D);
  if (so && sd && so.name !== sd.name && so.d <= 450 && sd.d <= 1000 && direct > 900) {
    const m = metroLegs(deps, so.name, sd.name);
    if (m) {
      try {
        const legs: Leg[] = [];
        const tracks: (Track | null)[] = [];
        // to the first platform actually used (28 May → Cəfər Cabbarlı when the trip starts on the green line)
        const fp: P = [m.legs[0].c[0], m.legs[0].c[1]];
        const dIn = hav(O, fp);
        if (dIn > 8) {
          legs.push({ mode: 'walk', indoor: dIn < 150, c: flat(densify3([O, fp])), label: 'Stansiyaya giriş', distanceM: Math.round(dIn), durationMin: r1(dIn / WALK_M_PER_MIN + 1) });
          tracks.push(null);
        }
        for (const l of m.legs) {
          legs.push(l);
          tracks.push(null);
        }
        const tail = (await osrm(deps, 'foot', [[sd.s.lat, sd.s.lon], D], 1)).map((t) => {
          const lg = walkLeg(t, speed);
          return { t, lg, s: deps.scoreWalk(deps.layer, [lg.c]) };
        });
        tail.sort((a, b) => key(b.s) - key(a.s) || a.t.distance - b.t.distance);
        legs.push(tail[0].lg);
        tracks.push(tail[0].t);
        const s = score(legs);
        const walkM = legs.filter((l) => l.mode === 'walk' && !l.indoor).reduce((a, l) => a + l.distanceM, 0);
        metroDraft = {
          s,
          d: {
            kind: 'safest',
            legs,
            steps: stepsFor(legs, tracks),
            price: '0,60 ₼',
            reasons: [`Metro: ${m.hops} dayanacaq${m.transfer ? ', 1 keçid' : ''}`, `Cəmi ${round10(walkM)} m piyada`, crossingWords(s)],
          },
        };
      } catch (e) {
        deps.log?.('live: metro tail', e);
      }
    }
  }

  // safest = best of walks + metro
  const walkCands = walkScored.filter((w) => w.t.distance <= 4500);
  const bestWalk = [...walkCands].sort((a, b) => key(b.s) - key(a.s) || a.t.distance - b.t.distance)[0];
  const shortest = [...walkScored].sort((a, b) => a.t.distance - b.t.distance)[0];
  const walkDraft = (w: (typeof walkScored)[number], kind: RouteOption['kind']): { d: Draft; s: WalkScore } => ({
    s: w.s,
    d: {
      kind,
      legs: w.legs,
      steps: stepsFor(w.legs, [w.t]),
      price: '0 ₼',
      reasons:
        kind === 'safest'
          ? [crossingWords(w.s), 'Ən az riskli piyada xətti', `${round10(w.t.distance)} m piyada`]
          : ['Pulsuz, birbaşa piyada', `${round10(w.t.distance)} m`],
      warning: kind === 'cheapest' && w.s.unsignalized ? `${w.s.unsignalized} işıqforsuz keçid${(night ? w.s.riskyNight : w.s.riskyDay) ? ' · riskli keçid var' : ''}` : undefined,
    },
  });
  let safest: { d: Draft; s: WalkScore } | null = bestWalk ? walkDraft(bestWalk, 'safest') : null;
  if (metroDraft && (!safest || key(metroDraft.s) >= key(safest.s))) safest = metroDraft;
  if (safest) drafts.push(safest);

  // cheapest = shortest walk ≤3 km (else the metro trip when it isn't already the safest)
  if (shortest && shortest.t.distance <= 3000) drafts.push(walkDraft(shortest, 'cheapest'));
  else if (metroDraft && safest !== metroDraft) drafts.push({ s: metroDraft.s, d: { ...metroDraft.d, kind: 'cheapest' } });

  // fastest = taxi
  if (carR.status === 'fulfilled' && carR.value.length) {
    const car = carR.value[0];
    const legs: Leg[] = [];
    const tracks: (Track | null)[] = [];
    const pickup = car.pts[0], drop = car.pts[car.pts.length - 1];
    if (hav(O, pickup) > 8) {
      legs.push({ mode: 'walk', c: flat(densify3([O, pickup])), distanceM: Math.round(hav(O, pickup)), durationMin: r1(hav(O, pickup) / WALK_M_PER_MIN / speed) });
      tracks.push(null);
    }
    const km = car.distance / 1000;
    const lo = Math.max(3, Math.round(2.4 + km * 0.85));
    legs.push({ mode: 'taxi', c: flat(car.pts), label: 'Taksi · təxmini', distanceM: Math.round(car.distance), durationMin: r1((car.duration / 60) * 1.3 + 3) });
    tracks.push(car);
    if (hav(drop, D) > 8) {
      legs.push({ mode: 'walk', c: flat(densify3([drop, D])), distanceM: Math.round(hav(drop, D)), durationMin: r1(hav(drop, D) / WALK_M_PER_MIN / speed) });
      tracks.push(null);
    }
    const s = score(legs);
    drafts.push({
      s,
      d: {
        kind: 'fastest',
        legs,
        steps: stepsFor(legs, tracks),
        price: `${lo}–${lo + 2} ₼`,
        reasons: ['Qapıdan qapıya ən az piyada', 'Qiymət tarif modeli ilə təxminidir'],
        warning: s.unsignalized ? `${s.unsignalized} işıqforsuz keçid piyada hissədə` : undefined,
      },
    });
  }

  const options = drafts.map(({ d, s }) => finalize(id, d, s));
  // never show the same line twice
  const out: RouteOption[] = [];
  for (const o of options) if (!out.some((x) => sameGeometry(x, o))) out.push(o);
  const safe = out.find((o) => o.kind === 'safest');
  if (safe) {
    const worst = Math.max(0, ...out.filter((o) => o !== safe).map((o) => o.unsignalized));
    safe.avoided = Math.max(0, worst - safe.unsignalized);
  }
  return out;
}

export function liveId(name: string, lat: number, lon: number) {
  const base = norm(name).slice(0, 24) || 'yer';
  return `${base}-${Math.round(lat * 1e4).toString(36)}${Math.round(lon * 1e4).toString(36)}`;
}

/** Full pipeline: geocode (if needed) → options. Returns null instead of throwing. */
export async function routeToCore(input: RouteToInput, opts: { profile?: Profile; time?: TimeOfDay }, deps: LiveDeps): Promise<LiveRoute | null> {
  try {
    let place: LivePlace | null;
    if ('query' in input) place = await geocode(input.query, deps);
    else place = inBaku(input.lat, input.lon) ? { name: input.name ?? 'Seçilmiş yer', lat: input.lat, lon: input.lon } : null;
    if (!place) return null;
    if (hav([deps.origin.lat, deps.origin.lon], [place.lat, place.lon]) < 60) return null;
    const id = liveId(place.name, place.lat, place.lon);
    const options = await buildOptions(id, place, deps, opts);
    if (!options.length) return null;
    return { id, place, options, computedAt: Date.now() };
  } catch (e) {
    deps.log?.('live: routeTo', e);
    return null;
  }
}
