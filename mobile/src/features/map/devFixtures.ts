import type { LastMeters, RouteOption } from '@/data/types';

/**
 * DEV-ONLY sample for building the "Son 50 metr" UI before the generated data lands.
 * Active only in dev builds with EXPO_PUBLIC_DEV_FIXTURES=1 — release builds never see it.
 */
const ENABLED = typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_DEV_FIXTURES === '1';

const HILTON_LM: LastMeters = {
  drop: { lat: 40.37292, lon: 49.84968 },
  street: 'Azadlıq prospekti',
  lanes: 6,
  wrongSide: true,
  directC: [40.37292, 49.84968, 40.37268, 49.84964, 40.37211, 49.84959],
  safeC: [40.37292, 49.84968, 40.37262, 49.84893, 40.37232, 49.84812, 40.37214, 49.84818, 40.37238, 49.84893, 40.37236, 49.84952, 40.37211, 49.84959],
  crossing: { lat: 40.37221, lon: 49.8481, type: 0 },
  extraM: 190,
  extraMin: 3,
  betterDrop: { lat: 40.37244, lon: 49.84978, label: 'Hilton girişi qarşısı' },
  note: 'Taksi səni Azadlıq prospektinin o biri tərəfində düşürür. Altı zolağı birbaşa keçmə, işıqforlu keçiddən keç.',
};

export function withDevFixtures(destId: string, options: RouteOption[]): RouteOption[] {
  if (!ENABLED || destId !== 'hilton') return options;
  return options.map((o) => (o.kind === 'fastest' && !o.lastMeters ? { ...o, lastMeters: HILTON_LM } : o));
}
