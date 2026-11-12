import { DESTINATIONS } from '@/data/destinations';
import type { Profile, RouteKind, TimeOfDay } from '@/data/types';

/** Scripted demo sentence used by the hidden demo button and when audio can't be understood. */
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
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type Intent = {
  destId: string | null;
  timeOfDay: TimeOfDay | null;
  profile: Profile;
  preference: RouteKind;
  companions: string[];
};

/** Keyword matcher — works offline. */
export function matchIntent(text: string): Intent {
  const t = ' ' + norm(text) + ' ';
  let destId: string | null = null;
  let best = 0;
  for (const d of DESTINATIONS) {
    for (const a of [d.name, d.short, ...d.aliases]) {
      const na = norm(a);
      if (na.length >= 2 && t.includes(' ' + na) && na.length > best) {
        // ignore the origin metro mention ("28 May-dan")
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
  if (has('tez ', 'suretli', 'telesir', 'gecikir')) preference = 'fastest';

  let timeOfDay: TimeOfDay | null = null;
  if (has('gece', 'axsam', 'qaranliq')) timeOfDay = 'night';
  else if (has('gunduz', 'seher', 'gunorta')) timeOfDay = 'day';

  return { destId, timeOfDay, profile, preference, companions };
}
