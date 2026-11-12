/**
 * Əhməd's on-device tools. The model chooses which to call (Gemini function calling);
 * the same implementations run locally when the model is unreachable, so the thinking
 * trace always reflects work that really happened.
 */
import { DESTINATIONS, destById } from '@/data/destinations';
import { optionsFor, optionOf, summary, score } from '@/data/routes';
import { CROSSING_TYPE, LAYER, crossingsNearTrack } from '@/data/layer';
import type { Profile, RouteKind, RouteOption } from '@/data/types';
import type { FunctionDecl } from '@/ai/gemini';
import { matchIntent } from '@/ai/fallback';
import { taxiDrop, taxiOption } from '@/ai/script';
import { routeTo, type LiveRoute } from '@/features/routing/live';
import { getWeather } from '@/utils/weather';
import { GUST_LIMIT, SEAFRONT_WIND_LIMIT } from '@/store/useAppStore';
import type { AhmedStep } from '@/store/useAppStore';

export type ToolCtx = {
  night: boolean;
  profile: Profile;
  /** called when route_to_place computed a live route */
  onLive?: (r: LiveRoute) => void;
  /** weather fetch budget (shorter when we already know the network is down) */
  weatherTimeoutMs?: number;
};

type Json = Record<string, unknown>;

const IDS = DESTINATIONS.map((d) => d.id);
const KINDS: RouteKind[] = ['safest', 'cheapest', 'fastest'];

// ---------- geometry helpers ----------

const M_LAT = 110540;
const mLon = (lat: number) => 111320 * Math.cos((lat * Math.PI) / 180);

/** Flat [lat,lon,...] → points every ≤ stepM metres (so crossings between vertices are not missed). */
function densify(c: number[], stepM = 12) {
  const out: { latitude: number; longitude: number }[] = [];
  for (let i = 0; i + 1 < c.length; i += 2) {
    const a = { latitude: c[i], longitude: c[i + 1] };
    out.push(a);
    if (i + 3 < c.length) {
      const b = { latitude: c[i + 2], longitude: c[i + 3] };
      const d = Math.hypot((b.latitude - a.latitude) * M_LAT, (b.longitude - a.longitude) * mLon(a.latitude));
      const n = Math.floor(d / stepM);
      for (let k = 1; k < n; k++) {
        const f = k / n;
        out.push({ latitude: a.latitude + (b.latitude - a.latitude) * f, longitude: a.longitude + (b.longitude - a.longitude) * f });
      }
    }
  }
  return out;
}

/** Pedestrian exposure of an option: walk/scooter/bike legs + the taxi's last meters. */
function exposedTrack(o: RouteOption) {
  const pts: { latitude: number; longitude: number }[] = [];
  let meters = 0;
  for (const l of o.legs) {
    if (l.underground || l.mode === 'metro' || l.mode === 'bus' || l.mode === 'taxi') continue;
    pts.push(...densify(l.c));
    meters += l.distanceM;
  }
  if (o.lastMeters?.safeC?.length) pts.push(...densify(o.lastMeters.safeC));
  return { pts, meters };
}

type Counts = { total: number; signalized: number; zebra: number; unmarked: number; underpass: number; worst: number; avgDay: number; avgNight: number };

function countCrossings(idx: number[]): Counts {
  const c: Counts = { total: idx.length, signalized: 0, zebra: 0, unmarked: 0, underpass: 0, worst: -1, avgDay: 0, avgNight: 0 };
  let worstScore = 999;
  let sd = 0;
  let sn = 0;
  for (const i of idx) {
    const x = LAYER.crossings[i];
    const t = x[2];
    if (t === 0) c.signalized++;
    else if (t === 1) c.zebra++;
    else if (t === 2) c.unmarked++;
    else c.underpass++;
    sd += x[3];
    sn += x[4];
    if (x[4] < worstScore) {
      worstScore = x[4];
      c.worst = i;
    }
  }
  if (idx.length) {
    c.avgDay = Math.round(sd / idx.length);
    c.avgNight = Math.round(sn / idx.length);
  }
  return c;
}

function countsJson(c: Counts, night: boolean): Json {
  const w = c.worst >= 0 ? LAYER.crossings[c.worst] : null;
  return {
    crossings_total: c.total,
    signalized: c.signalized,
    unsignalized_zebra: c.zebra,
    unmarked: c.unmarked,
    underpass: c.underpass,
    unsignalized_total: c.zebra + c.unmarked,
    average_score: night ? c.avgNight : c.avgDay,
    worst_crossing: w ? { type: CROSSING_TYPE[w[2]], score: night ? w[4] : w[3], lanes: w[5] || undefined } : null,
  };
}

let cityCache: Counts | null = null;

/** Crossings around a point (area questions). */
function areaCounts(lat: number, lon: number, radiusM: number) {
  return countCrossings(crossingsNearTrack([{ latitude: lat, longitude: lon }], radiusM));
}

// ---------- tool implementations ----------

function optionJson(o: RouteOption, night: boolean): Json {
  const lm = o.lastMeters;
  const metro = o.legs.find((l) => l.mode === 'metro');
  return {
    kind: o.kind,
    summary: summary(o),
    minutes: o.durationMin,
    price: o.price,
    co2_g: o.co2g,
    safety_score: score(o, night),
    unsignalized_crossings: o.unsignalized,
    risky_crossings_avoided: o.avoided,
    reasons: o.reasons,
    warning: o.warning,
    metro_stations: metro?.stations?.map((s) => s.name),
    last_meters: lm
      ? { wrong_side: lm.wrongSide, lanes: lm.lanes, street: lm.street, note: lm.note, extra_walk_min: lm.extraMin }
      : undefined,
  };
}

async function getWeatherTool(ctx: ToolCtx): Promise<Json> {
  const w = await getWeather(ctx.weatherTimeoutMs ?? 2500);
  if (w.source === 'store') return { available: false };
  return {
    available: true,
    wind_ms: w.windSpeed,
    gust_ms: w.windGust,
    temp_c: w.tempC,
    rain_mm: w.precipitation,
    is_day: w.isDay,
    scooter_ok: w.windGust < GUST_LIMIT,
    seafront_ok_for_scooter: w.windSpeed < SEAFRONT_WIND_LIMIT,
  };
}

function nightOf(ctx: ToolCtx, tod?: unknown) {
  return tod === 'night' ? true : tod === 'day' ? false : ctx.night;
}

function getRouteOptions(args: Json, ctx: ToolCtx): Json {
  const id = String(args.destination_id ?? '');
  const d = destById(id);
  if (!d) return { found: false, catalog: IDS };
  const night = nightOf(ctx, args.time_of_day);
  return {
    found: true,
    origin: '28 May m.',
    destination: d.name,
    time_of_day: night ? 'night' : 'day',
    options: optionsFor(id).map((o) => optionJson(o, night)),
  };
}

async function querySafetyLayer(args: Json, ctx: ToolCtx): Promise<Json> {
  const night = nightOf(ctx, args.time_of_day);
  let id = args.destination_id ? String(args.destination_id) : '';
  const place = args.place ? String(args.place) : '';
  const kind = KINDS.includes(args.route_kind as RouteKind) ? (args.route_kind as RouteKind) : null;

  if (id && destById(id) && kind) {
    const o = optionOf(id, kind);
    if (!o) return { found: false };
    const { pts, meters } = exposedTrack(o);
    const c = countCrossings(crossingsNearTrack(pts, 20));
    return { found: true, scope: 'route', destination: destById(id)!.name, route_kind: kind, walked_m: Math.round(meters), time_of_day: night ? 'night' : 'day', ...countsJson(c, night) };
  }
  if (!id && place) id = matchIntent(place).destId ?? '';
  if (id && destById(id)) {
    const d = destById(id)!;
    const radius = 400;
    const c = areaCounts(d.lat, d.lon, radius);
    return { found: true, scope: 'area', area: `${d.name} ətrafı`, radius_m: radius, time_of_day: night ? 'night' : 'day', ...countsJson(c, night) };
  }
  if (place) {
    const live = await withTimeout(routeTo({ query: place }, { profile: ctx.profile, time: night ? 'night' : 'day' }), 6000);
    if (live) {
      const radius = 400;
      const c = areaCounts(live.place.lat, live.place.lon, radius);
      return { found: true, scope: 'area', area: `${live.place.name} ətrafı`, radius_m: radius, time_of_day: night ? 'night' : 'day', ...countsJson(c, night) };
    }
    return { found: false, place };
  }
  if (!cityCache) cityCache = countCrossings(LAYER.crossings.map((_, i) => i));
  return { found: true, scope: 'city', area: 'Bakı', time_of_day: night ? 'night' : 'day', ...countsJson(cityCache, night) };
}

function checkTaxiDropoff(args: Json): Json {
  const id = String(args.destination_id ?? '');
  if (!destById(id)) return { found: false };
  const o = taxiOption(id);
  const drop = taxiDrop(id);
  if (!o || !drop) return { found: true, has_taxi_option: false };
  const lm = o.lastMeters;
  return {
    found: true,
    has_taxi_option: true,
    wrong_side: drop.wrongSide,
    lanes_to_cross: drop.lanes ?? undefined,
    street: lm?.street,
    safe_crossing_type: lm?.crossing ? CROSSING_TYPE[lm.crossing.type] : undefined,
    extra_walk_m: lm ? Math.round(lm.extraM) : undefined,
    extra_walk_min: lm?.extraMin,
    better_drop_point: lm?.betterDrop?.label,
    note: lm?.note ?? drop.warning,
  };
}

async function routeToPlace(args: Json, ctx: ToolCtx): Promise<Json> {
  const q = String(args.query ?? '').trim();
  if (!q) return { found: false };
  const r = await withTimeout(routeTo({ query: q }, { profile: ctx.profile, time: ctx.night ? 'night' : 'day' }), 7000);
  if (!r) return { found: false, query: q };
  ctx.onLive?.(r);
  return {
    found: true,
    place: r.place.name,
    district: r.place.district,
    options: r.options.map((o) => optionJson(o, ctx.night)),
  };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

// ---------- declarations (what the model sees) ----------

export const TOOL_DECLS: FunctionDecl[] = [
  {
    name: 'get_weather',
    description: 'Live Baku weather right now (wind, gusts, temperature, rain). Use it for any route advice; strong gusts make scooters and the seafront risky.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_route_options',
    description: 'The 3 route options (safest, cheapest, fastest) from 28 May metro to a catalog destination, with minutes, price, CO2, safety score for the time of day, unsignalized crossings, reasons and warnings.',
    parameters: {
      type: 'OBJECT',
      properties: {
        destination_id: { type: 'STRING', enum: IDS },
        time_of_day: { type: 'STRING', enum: ['day', 'night'] },
      },
      required: ['destination_id'],
    },
  },
  {
    name: 'query_safety_layer',
    description:
      'Baku pedestrian safety layer (OpenStreetMap crossings with day/night risk scores). With destination_id + route_kind: crossings the user walks over on that route. With destination_id only, or a free-text place: crossings within 400 m of that place. With no arguments: city-wide totals.',
    parameters: {
      type: 'OBJECT',
      properties: {
        destination_id: { type: 'STRING', enum: IDS },
        route_kind: { type: 'STRING', enum: KINDS },
        place: { type: 'STRING', description: 'Free-text place or street name, if not a catalog destination' },
        time_of_day: { type: 'STRING', enum: ['day', 'night'] },
      },
    },
  },
  {
    name: 'check_taxi_dropoff',
    description: 'Checks the taxi option\'s "last 50 meters": whether the taxi drops the user on the wrong side of a multi-lane road and how many lanes they would have to cross.',
    parameters: { type: 'OBJECT', properties: { destination_id: { type: 'STRING', enum: IDS } }, required: ['destination_id'] },
  },
  {
    name: 'route_to_place',
    description: 'Finds a place in Baku that is NOT in the catalog (geocoding) and computes live walking routes to it, scored with the safety layer. Returns found=false if the place is unknown.',
    parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'Place name as the user said it' } }, required: ['query'] },
  },
];

export async function runTool(name: string, args: Json, ctx: ToolCtx): Promise<Json> {
  switch (name) {
    case 'get_weather':
      return getWeatherTool(ctx);
    case 'get_route_options':
      return getRouteOptions(args, ctx);
    case 'query_safety_layer':
      return querySafetyLayer(args, ctx);
    case 'check_taxi_dropoff':
      return checkTaxiDropoff(args);
    case 'route_to_place':
      return routeToPlace(args, ctx);
    default:
      return { error: `unknown tool ${name}` };
  }
}

// ---------- thinking-trace labels ----------

export const TOOL_LABEL: Record<string, string> = {
  get_weather: 'Hava yoxlanılır',
  get_route_options: 'Marşrutlar müqayisə olunur',
  query_safety_layer: 'Təhlükəsizlik Qatı',
  check_taxi_dropoff: 'Taksi düşmə nöqtəsi',
  route_to_place: 'Yer axtarılır',
};

const fmt = (n: number) => String(n).replace('.', ',');

/** Human value + state for a finished tool call. */
export function stepOutcome(name: string, r: Json): Pick<AhmedStep, 'value' | 'state'> {
  if (r.error) return { value: 'cavab gəlmədi', state: 'fail' };
  switch (name) {
    case 'get_weather': {
      if (!r.available) return { value: 'yenilənmədi', state: 'warn' };
      const gust = Number(r.gust_ms);
      const v = `${fmt(Number(r.wind_ms))} m/s külək · ${r.temp_c}°`;
      return { value: v, state: gust >= GUST_LIMIT ? 'warn' : 'done' };
    }
    case 'get_route_options': {
      if (!r.found) return { value: 'tapılmadı', state: 'warn' };
      const n = (r.options as unknown[]).length;
      return { value: `${n} variant`, state: 'done' };
    }
    case 'query_safety_layer': {
      if (!r.found) return { value: 'məlumat yoxdur', state: 'warn' };
      const total = Number(r.crossings_total);
      const unsig = Number(r.unsignalized_total);
      if (r.scope === 'area') return { value: `${total} keçid, ${unsig} işıqforsuz · ${r.radius_m} m`, state: 'done' };
      if (r.scope === 'city') return { value: `${fmt(total)} keçid yoxlandı`, state: 'done' };
      return { value: total ? `${total} keçid, ${unsig} işıqforsuz` : 'risksiz keçid yolu', state: 'done' };
    }
    case 'check_taxi_dropoff': {
      if (!r.found || !r.has_taxi_option) return { value: 'taksi variantı yoxdur', state: 'done' };
      if (r.wrong_side) return { value: r.lanes_to_cross ? `qarşı tərəf, ${r.lanes_to_cross} zolaq` : 'qarşı tərəf', state: 'warn' };
      return { value: 'düzgün tərəf', state: 'done' };
    }
    case 'route_to_place': {
      if (!r.found) return { value: 'tanımadım', state: 'warn' };
      return { value: String(r.place), state: 'done' };
    }
  }
  return { value: undefined, state: 'done' };
}
