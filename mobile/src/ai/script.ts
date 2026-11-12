/**
 * Əhməd's deterministic replies, built ONLY from route data. Used when the live agent is
 * unavailable, and enumerated by voice/lines/ahmed.ts so every line ships as a
 * pre-generated Azerbaijani clip. No React Native imports (runs in Node too).
 */
import { DESTINATIONS, destById } from '../data/destinations';
import { optionOf, optionsFor } from '../data/routes';
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

/** "metro ilə 1 dayanacaq, sonra 590 metr piyada" */
export function spokenLegs(o: RouteOption) {
  const parts: string[] = [];
  for (const l of o.legs) {
    if (l.mode === 'walk') {
      if (l.distanceM >= 60) parts.push(`${round10(l.distanceM)} metr piyada`);
    } else if (l.mode === 'metro') {
      const n = metroStops(l);
      parts.push(n ? `metro ilə ${n} dayanacaq` : 'metro ilə');
    } else if (l.mode === 'bus') {
      const num = /(\d+)/.exec(l.label ?? '')?.[1];
      parts.push(num ? `${num} nömrəli avtobusla` : 'avtobusla');
    } else if (l.mode === 'taxi') parts.push('taksi ilə');
    else if (l.mode === 'scooter') parts.push('skuterlə');
    else if (l.mode === 'bike') parts.push('velosipedlə');
  }
  return parts.join(', sonra ') || 'piyada';
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

function taxiSentence(destId: string) {
  const drop = taxiDrop(destId);
  if (!drop) return '';
  if (drop.wrongSide) {
    return drop.lanes
      ? ` Taksi isə səni yolun qarşı tərəfində düşürür, ${drop.lanes} zolaqlı yolu keçməli olardın.`
      : ' Taksi isə səni yolun qarşı tərəfində düşürür.';
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
  const o = optionOf(destId, pref) ?? optionOf(destId, 'safest');
  if (!d || !o) return AHMED_SAY.askWhere;
  if (o.kind === 'safest') {
    const to = toDest(d.id, d.short);
    const head = night ? `Gecədir, ona görə ${to} ən az riskli yolu seçdim` : `${upperFirst(to)} ən az riskli yol`;
    return `${head}: ${spokenLegs(o)}, cəmi ${o.durationMin} dəqiqə.${taxiSentence(destId)}`;
  }
  if (o.kind === 'cheapest') {
    const price = /^0\s*₼$/.test(o.price.trim()) ? 'pulsuzdur' : o.price;
    const warn = o.warning ? ` Amma diqqət: ${warnPhrase(o.warning)}.` : '';
    return `${upperFirst(toDest(d.id, d.short))} ən sərfəli yol ${price}: ${spokenLegs(o)}, ${o.durationMin} dəqiqə.${warn}`;
  }
  const warn = o.warning ? ` Diqqət: ${warnPhrase(o.warning)}.` : '';
  return `${upperFirst(toDest(d.id, d.short))} ən tez yol taksidir: ${o.durationMin} dəqiqə, təxminən ${o.price}.${warn}`;
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

