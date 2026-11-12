/**
 * Əhməd's deterministic replies, built ONLY from route data. Used when the live agent is
 * unavailable, and enumerated by voice/lines/ahmed.ts so every line ships as a
 * pre-generated Azerbaijani clip. No React Native imports (runs in Node too).
 */
import { DESTINATIONS, destById } from '../data/destinations';
import { optionOf, optionsFor, score } from '../data/routes';
import type { Leg, RouteKind, RouteOption } from '../data/types';

/** Fixed spoken lines of the Əhməd screen (exact strings → clips). */
export const AHMED_SAY = {
  askWhere: 'Hara getmək istədiyini de: məsələn, Hilton, İçərişəhər və ya Gənclik Mall.',
  noMic: 'Mikrofona icazə olmadan səni eşidə bilmirəm. Yazaraq da soruşa bilərsən.',
  notSure: 'Bunu dəqiq deyə bilmərəm. Hara getmək istədiyini de, ən az riskli yolu göstərim.',
  scooterWind: 'Bu gün külək çox güclüdür, skuter riskli olar. Metro ilə getməyi məsləhət görürəm.',
} as const;

const round10 = (m: number) => Math.max(10, Math.round(m / 10) * 10);

function metroStops(l: Leg) {
  if (l.stations && l.stations.length > 1) return l.stations.length - 1;
  const m = /(\d+)\s*dayanacaq/.exec(l.label ?? '');
  return m ? Number(m[1]) : 0;
}

/** "metro ilə 1 dayanacaq, sonra 590 metr piyada" (consecutive walks merged, tiny ones skipped) */
export function spokenLegs(o: RouteOption) {
  const parts: string[] = [];
  let walk = 0;
  const flush = () => {
    if (walk >= 60) parts.push(`${round10(walk)} metr piyada`);
    walk = 0;
  };
  for (const l of o.legs) {
    if (l.mode === 'walk') {
      walk += l.distanceM;
      continue;
    }
    // the short walk to the taxi / station is not worth saying
    if (parts.length === 0 && walk < 200) walk = 0;
    flush();
    if (l.mode === 'metro') {
      const n = metroStops(l);
      parts.push(n ? `metro ilə ${n} dayanacaq` : 'metro ilə');
    } else if (l.mode === 'bus') {
      const num = /(\d+)/.exec(l.label ?? '')?.[1];
      parts.push(num ? `${num} nömrəli avtobusla` : 'avtobusla');
    } else if (l.mode === 'taxi') parts.push('taksi ilə');
    else if (l.mode === 'scooter') parts.push('skuterlə');
    else if (l.mode === 'bike') parts.push('velosipedlə');
  }
  flush();
  return parts.join(', sonra ') || 'piyada';
}

const isTaxi = (o: RouteOption) => o.legs.some((l) => l.mode === 'taxi');

/**
 * The option Əhməd recommends: for "safest" the HIGHEST score for this time of day (at night the
 * taxi can beat the walk/metro); "fastest" = shortest door-to-door; "cheapest" = that kind.
 */
export function recommended(destId: string, pref: RouteKind, night: boolean): RouteOption | undefined {
  const all = optionsFor(destId);
  if (!all.length) return undefined;
  if (pref === 'cheapest') return optionOf(destId, 'cheapest') ?? all[0];
  if (pref === 'fastest') return [...all].sort((a, b) => a.durationMin - b.durationMin || score(b, night) - score(a, night))[0];
  return [...all].sort((a, b) => score(b, night) - score(a, night) || (a.kind === 'safest' ? -1 : b.kind === 'safest' ? 1 : 0))[0];
}

/** Taxi option of a destination (if any). */
export function taxiOption(destId: string) {
  return optionsFor(destId).find((o) => o.legs.some((l) => l.mode === 'taxi'));
}

/** Last-meters facts of the taxi option: real analysis if present, else parsed from its warning. */
export function taxiDrop(destId: string): { wrongSide: boolean; lanes: number | null; analysed: boolean; warning?: string } | null {
  const o = taxiOption(destId);
  if (!o) return null;
  const lm = o.lastMeters;
  if (lm) return { wrongSide: lm.wrongSide, lanes: lm.lanes || null, analysed: true, warning: o.warning };
  const w = o.warning ?? '';
  const lanes = /(\d+)\s*zolaq/.exec(w)?.[1];
  return { wrongSide: /qarşı tərəf/i.test(w), lanes: lanes ? Number(lanes) : null, analysed: false, warning: o.warning };
}

/** "Hilton üçün" / "evə" */
function toDest(id: string, short: string) {
  return id === 'ev' ? 'evə' : `${short} üçün`;
}

function upperFirst(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function lowerFirst(s: string) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

function warnPhrase(w?: string) {
  if (!w) return '';
  const t = w.split(' · ').join(', ');
  // keep street names capitalized ("Neftçilər pr. ...")
  return /^\S+\s(pr\.|küç\.|prospekti|küçəsi)/.test(t) ? t : lowerFirst(t);
}

/**
 * Text → what Əhməd actually says: abbreviations and currency read naturally.
 * The screen shows the original ("0,60 ₼", "12 dəq"); say() gets this form (clip keys use it too).
 */
export function speakable(text: string) {
  return text
    .replace(/0,(\d\d)\s*₼/g, '$1 qəpik')
    .replace(/(\d+)\s*[–-]\s*(\d+)\s*₼/g, '$1 ilə $2 manat arası')
    .replace(/(\d+(?:,\d+)?)\s*₼/g, '$1 manat')
    .replace(/(\d+)\s*[–-]\s*(\d+)\s*dəq(?![a-zəüöğıçş])/g, '$1 ilə $2 dəqiqə')
    .replace(/(\d+)\s*dəq(?![a-zəüöğıçş])/g, '$1 dəqiqə')
    .replace(/(^|\s)pr\./g, '$1prospekti')
    .replace(/(^|\s)küç\./g, '$1küçəsi')
    .replace(/(\S)\s+m\.(?=\s|,|$)/g, '$1 metrosu')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "Neftçilər prospekti" → "Neftçilər prospektinin" */
function genitive(street: string) {
  if (/prospekti$/i.test(street) || /küçəsi$/i.test(street) || /meydanı$/i.test(street)) return `${street}nin`;
  return '';
}

/** " Taksi isə səni … qarşı tərəfində düşürür …" (leading space), or '' */
export function taxiSentence(destId: string) {
  const drop = taxiDrop(destId);
  if (!drop) return '';
  if (drop.wrongSide) {
    const lm = taxiOption(destId)?.lastMeters;
    const g = lm?.street ? genitive(lm.street) : '';
    const where = g ? `${g} qarşı tərəfində` : 'yolun qarşı tərəfində';
    return drop.lanes ? ` Taksi isə səni ${where} düşürür, ${drop.lanes} zolağı keçməli olardın.` : ` Taksi isə səni ${where} düşürür.`;
  }
  return drop.warning ? ` Taksi ilə getsən, diqqət: ${warnPhrase(drop.warning)}.` : '';
}

/**
 * Natural spoken reply from the route data only (never invents facts).
 * Safest × day/night are pre-generated as clips; the others usually are too.
 */
export function scriptedReply(destId: string | null, pref: RouteKind, night: boolean): string {
  if (!destId) return AHMED_SAY.askWhere;
  const d = destById(destId);
  const o = recommended(destId, pref, night);
  if (!d || !o) return AHMED_SAY.askWhere;
  const to = toDest(d.id, d.short);
  if (pref === 'cheapest') {
    const price = /^0\s*₼$/.test(o.price.trim()) ? 'pulsuzdur' : o.price;
    const warn = o.warning ? ` Amma diqqət: ${warnPhrase(o.warning)}.` : '';
    return `${upperFirst(to)} ən sərfəli yol ${price}: ${spokenLegs(o)}, ${o.durationMin} dəqiqə.${warn}`;
  }
  if (pref === 'fastest') {
    const how = isTaxi(o) ? `taksidir: ${o.durationMin} dəqiqə, təxminən ${o.price}` : `${spokenLegs(o)}, ${o.durationMin} dəqiqə`;
    const warn = o.warning ? ` Diqqət: ${warnPhrase(o.warning)}.` : '';
    return `${upperFirst(to)} ən tez yol ${how}.${warn}`;
  }
  // safest = highest score now
  const head = night ? `Gecədir, ona görə ${to} ən az riskli yolu seçdim` : `${upperFirst(to)} ən az riskli yol`;
  if (isTaxi(o)) {
    const why = night ? ' Piyada yolda gecə riskli keçidlər var.' : '';
    return `${head}: taksi, təxminən ${o.price}, ${o.durationMin} dəqiqə.${why}`;
  }
  return `${head}: ${spokenLegs(o)}, cəmi ${o.durationMin} dəqiqə.${taxiSentence(destId)}`;
}

/** Spoken answer to a safety question about an area, from safety-layer counts (offline path). */
export function scriptedAreaAnswer(a: { name: string; radiusM: number; total: number; unsignalized: number; signalized: number; underpass: number }, night: boolean) {
  if (!a.total) return `${a.name} ətrafında qeydə alınmış keçid tapmadım. Hara getmək istədiyini de, ən az riskli yolu göstərim.`;
  const tail = night
    ? ' Gecə işıqforlu keçidlərdən keç, mən də marşrutu ona görə qururam.'
    : ' İşıqforlu keçidlərdən keçsən, risk xeyli azalır.';
  const safe = a.signalized + a.underpass;
  return `${a.name} ətrafında ${a.radiusM} metr radiusda ${a.total} keçid var: ${safe} işıqforlu və ya yeraltı, ${a.unsignalized} işıqforsuz.${tail}`;
}

/** Every deterministic reply (for clip generation). */
export function scriptLines(): string[] {
  const out = new Set<string>(Object.values(AHMED_SAY));
  for (const d of DESTINATIONS) {
    for (const night of [false, true]) {
      for (const k of ['safest', 'cheapest', 'fastest'] as RouteKind[]) out.add(scriptedReply(d.id, k, night));
    }
  }
  return [...out].map(speakable);
}

