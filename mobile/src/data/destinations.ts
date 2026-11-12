import type { Destination } from './types';

/** Fixed demo origin: "Cari yer" = 28 May metro (coords verified against OSM in build-routes). */
export const ORIGIN = {
  id: 'may28',
  name: '28 May m.',
  lat: 40.38003,
  lon: 49.84868,
};

// Coordinates verified with Nominatim (OSM) on 2026-11-12.
export const DESTINATIONS: Destination[] = [
  {
    id: 'hilton',
    name: 'Hilton Baku',
    short: 'Hilton',
    district: 'Səbail · Azadlıq pr.',
    icon: 'office-building-outline',
    aliases: ['hilton', 'hiltona', 'hilton baku', 'hiltonun', 'otel', 'hotel'],
    lat: 40.37211,
    lon: 49.84959,
  },
  {
    id: 'icherisheher',
    name: 'İçərişəhər',
    short: 'İçərişəhər',
    district: 'Səbail · Qala divarları',
    icon: 'castle',
    aliases: ['icerisheher', 'icerisehere', 'icerisehe', 'icheri', 'old city', 'qala', 'qosa qala', 'icherisheher', 'icerisheher'],
    lat: 40.36596,
    lon: 49.83165,
  },
  {
    id: 'bulvar',
    name: 'Dənizkənarı Bulvar',
    short: 'Bulvar',
    district: 'Səbail · Milli Park',
    icon: 'waves',
    aliases: ['bulvar', 'bulvara', 'denizkenari', 'milli park', 'deniz kenari', 'kukla teatri'],
    lat: 40.36619,
    lon: 49.83947,
  },
  {
    id: 'genclik',
    name: 'Gənclik Mall',
    short: 'Gənclik Mall',
    district: 'Nərimanov · F. X. Xoyski pr.',
    icon: 'shopping-outline',
    aliases: ['genclik', 'gencliy', 'genclik mall', 'ganjlik', 'gencilik'],
    lat: 40.39986,
    lon: 49.8528,
  },
  {
    id: 'ada',
    name: 'ADA Universiteti',
    short: 'Universitet',
    district: 'Nərimanov · Ə. Ağaoğlu küç.',
    icon: 'school-outline',
    aliases: ['ada', 'universitet', 'universitete', 'ada universiteti', 'university', 'univer'],
    lat: 40.39641,
    lon: 49.84976,
  },
  {
    id: 'port',
    name: 'Port Baku Mall',
    short: 'Port Baku',
    district: 'Nəsimi · Neftçilər pr.',
    icon: 'storefront-outline',
    aliases: ['port baku', 'port', 'portbaku', 'port baku mall'],
    lat: 40.37565,
    lon: 49.85969,
  },
  {
    id: 'flame',
    name: 'Alov Qüllələri',
    short: 'Alov Qüllələri',
    district: 'Səbail · Mehdi Hüseyn küç.',
    icon: 'fire',
    aliases: ['alov', 'alov qulleleri', 'flame', 'flame towers', 'qulleler'],
    lat: 40.36036,
    lon: 49.82635,
  },
  {
    id: 'nizami',
    name: 'Nizami m.',
    short: 'Nizami m.',
    district: 'Yasamal · Cəfər Cabbarlı küç.',
    icon: 'subway-variant',
    aliases: ['nizami', 'nizami metro', 'nizami metrosu', 'nizamiye'],
    lat: 40.37984,
    lon: 49.83062,
  },
  {
    id: 'ev',
    name: 'Ev',
    short: 'Ev',
    district: 'Xətai · Əhmədli',
    icon: 'home-outline',
    aliases: ['ev', 'eve', 'evime', 'evə', 'ehmedli', 'əhmədli'],
    lat: 40.38464,
    lon: 49.95422,
  },
];

export const destById = (id: string) => DESTINATIONS.find((d) => d.id === id);

export const RECENT_IDS = ['ev', 'ada', 'hilton'];
