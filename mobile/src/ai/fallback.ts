/**
 * Offline understanding for Əhməd (no network, no React Native imports — also used by
 * scripts/gen-voice.ts through script.ts). Relative imports on purpose.
 */
import { DESTINATIONS } from '../data/destinations';
import type { Profile, RouteKind, TimeOfDay } from '../data/types';

/** Hidden stage sentence (double long-press on Əhməd, /ahmed?demo=1, stage fallback). */
export const DEMO_SENTENCE = 'Gecədir, uşaq arabası ilə 28 May metrosundan Hilton-a getmək istəyirəm';

export function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/ə/g, 'e')
    .replace(/ı/g, 'i')
    .replace(/i̇/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/[^a-z0-9? ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type Intent = {
  destId: string | null;
  timeOfDay: TimeOfDay | null;
  profile: Profile;
  preference: RouteKind;
  companions: string[];
  /** route request vs. a free question ("Gecə Nizami təhlükəsizdir?") */
  kind: 'route' | 'question' | 'unclear';
};

const MOTION = [' get', ' gedim', ' gedirem', ' gedir', ' apar', ' catim', ' catmaq', ' yol ', ' yolu', ' yolla', ' marsrut', ' isteyirem', ' lazimdir'];
const QUESTION = ['?', ' mi ', ' mu ', ' nece', ' necedir', ' tehlukesiz', ' tehlukeli', ' riskli', ' nedir', ' hansi', ' varmi', ' olar ', ' neyse', ' isiqfor', ' kecid'];

/** Keyword matcher — works offline. "28 May" is always the origin, never the destination. */
export function matchIntent(text: string): Intent {
  const t = ' ' + norm(text).replace(/\b28 ?may\w*/g, ' ') + ' ';
  let destId: string | null = null;
  let best = 0;
  for (const d of DESTINATIONS) {
    for (const a of [d.name, d.short, ...d.aliases]) {
      const na = norm(a);
      if (na.length >= 2 && t.includes(' ' + na) && na.length > best) {
        destId = d.id;
        best = na.length;
      }
    }
  }
  const has = (...w: string[]) => w.some((x) => t.includes(x));
  const companions: string[] = [];
  if (has('usaq araba', 'kolyaska', 'araba ile')) companions.push('stroller');
  if (has('elil', 'invalid', 'teker')) companions.push('wheelchair');
  if (has('nene', 'baba', 'yasli')) companions.push('elderly');
  if (has('usaq', 'oglum', 'qizim')) companions.push('child');

  let profile: Profile = 'daily';
  if (companions.includes('stroller') || companions.includes('wheelchair')) profile = 'accessible';
  if (has('skuter', 'scooter', 'velosiped', 'velik', 'samokat')) profile = 'scooter';

  let preference: RouteKind = 'safest';
  if (has('ucuz', 'serfeli', 'qenaet', 'pulsuz')) preference = 'cheapest';
  if (has(' tez ', 'suretli', 'telesir', 'gecikir')) preference = 'fastest';

  let timeOfDay: TimeOfDay | null = null;
  if (has('gece', 'axsam', 'qaranliq')) timeOfDay = 'night';
  else if (has('gunduz', 'seher', 'gunorta')) timeOfDay = 'day';

  const asks = has(...QUESTION);
  const moves = has(...MOTION) || preference !== 'safest';
  let kind: Intent['kind'] = 'unclear';
  if (asks && !moves) kind = 'question';
  else if (destId) kind = 'route';
  else if (asks) kind = 'question';

  return { destId, timeOfDay, profile, preference, companions, kind };
}
