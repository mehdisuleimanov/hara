import raw from './routes.json';
import type { RouteKind, RouteOption } from './types';
import { DESTINATIONS, destById } from './destinations';

type Line = { c: number[]; distanceM: number; durationMin?: number };

type RoutesData = {
  origin: { lat: number; lon: number; name: string };
  destCoords: Record<string, { lat: number; lon: number }>;
  options: Record<string, RouteOption[]>;
  scooter: {
    from: { lat: number; lon: number; name: string };
    to: { lat: number; lon: number; name: string };
    seafront: Line & { durationMin: number };
    calm: Line & { durationMin: number };
  };
  accessible: { from: { lat: number; lon: number }; legs: (Line & { mode: 'walk' | 'metro' })[]; stations: string[] };
  family: {
    home: { lat: number; lon: number };
    school: { lat: number; lon: number };
    murad: Line;
    nene: Line;
  };
};

export const ROUTES = raw as unknown as RoutesData;

// Keep destination coordinates in sync with the generated data (e.g. "Ev" near Əhmədli m.).
for (const d of DESTINATIONS) {
  const c = ROUTES.destCoords[d.id];
  if (c?.lat) {
    d.lat = c.lat;
    d.lon = c.lon;
  }
}

export function optionsFor(destId: string): RouteOption[] {
  return ROUTES.options[destId] ?? [];
}

export function optionOf(destId: string, kind: RouteKind) {
  return optionsFor(destId).find((o) => o.kind === kind);
}

export const KIND_TITLE: Record<RouteKind, string> = {
  safest: 'Ən təhlükəsiz',
  cheapest: 'Ən sərfəli',
  fastest: 'Ən sürətli',
};

const MODE_WORD: Record<string, string> = {
  walk: 'piyada',
  metro: 'Metro',
  bus: 'Avtobus',
  taxi: 'Taksi',
  scooter: 'Skuter',
  bike: 'Velosiped',
};

/** "Metro + 350 m piyada" style one-liner. */
export function summary(o: RouteOption) {
  const parts: string[] = [];
  for (const l of o.legs) {
    if (l.mode === 'walk') {
      if (l.distanceM >= 60) parts.push(`${Math.round(l.distanceM / 10) * 10} m piyada`);
    } else if (l.mode === 'bus') parts.push(l.label ?? 'Avtobus');
    else if (l.mode === 'taxi') parts.push('Taksi · təxmini');
    else parts.push(MODE_WORD[l.mode]);
  }
  return parts.join(' + ');
}

export function score(o: RouteOption, night: boolean) {
  return night ? o.scoreNight : o.scoreDay;
}

/** Compact facts for the LLM prompt, so Əhməd only explains what the data says. */
export function routeFacts(night: boolean) {
  return DESTINATIONS.map((d) => {
    const opts = optionsFor(d.id)
      .map(
        (o) =>
          `  - ${o.kind}: ${summary(o)}; ${o.durationMin} dəq; ${o.price}; bal ${score(o, night)}/100` +
          (o.reasons.length ? `; səbəblər: ${o.reasons.join(', ')}` : '') +
          (o.warning ? `; xəbərdarlıq: ${o.warning}` : ''),
      )
      .join('\n');
    return `* ${d.id} = ${d.name} (${d.district}; aliases: ${d.aliases.join(', ')})\n${opts}`;
  }).join('\n');
}

export function destName(id: string) {
  return destById(id)?.short ?? id;
}
