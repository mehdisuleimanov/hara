import type { Report, ReportCategory } from './types';

export const REPORT_META: Record<
  ReportCategory,
  { title: string; icon: string; tone: 'warn' | 'danger' }
> = {
  dark: { title: 'Qaranlıq küçə', icon: 'lightbulb-off-outline', tone: 'warn' },
  car: { title: 'Səkidə maşın', icon: 'car-side', tone: 'danger' },
  lift: { title: 'Lift işləmir', icon: 'elevator-passenger-off-outline', tone: 'danger' },
  crossing: { title: 'Təhlükəli keçid', icon: 'alert-outline', tone: 'danger' },
  sidewalk: { title: 'Səki yoxdur', icon: 'road-variant', tone: 'warn' },
  speed: { title: 'Sürətli maşınlar', icon: 'car-speed-limiter', tone: 'danger' },
};

// Plausible demo reports around central Baku.
export const SEED_REPORTS: Report[] = [
  { id: 'r1', category: 'crossing', lat: 40.37755, lon: 49.84452, minutesAgo: 12, aiConfidence: 91, count: 7 },
  { id: 'r2', category: 'dark', lat: 40.38262, lon: 49.83561, minutesAgo: 46, aiConfidence: 88, count: 4 },
  { id: 'r3', category: 'lift', lat: 40.38012, lon: 49.84905, minutesAgo: 95, aiConfidence: 97, count: 3 },
  { id: 'r4', category: 'car', lat: 40.39552, lon: 49.86541, minutesAgo: 21, aiConfidence: 94, count: 2 },
  { id: 'r5', category: 'sidewalk', lat: 40.39071, lon: 49.80422, minutesAgo: 180, aiConfidence: 85, count: 5 },
  { id: 'r6', category: 'speed', lat: 40.37096, lon: 49.85741, minutesAgo: 33, aiConfidence: 89, count: 6 },
  { id: 'r7', category: 'dark', lat: 40.40613, lon: 49.87411, minutesAgo: 64, aiConfidence: 86, count: 2 },
  { id: 'r8', category: 'crossing', lat: 40.36872, lon: 49.82231, minutesAgo: 140, aiConfidence: 90, count: 3 },
];
