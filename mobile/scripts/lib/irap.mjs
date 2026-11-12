// Dev-time only: the crossing scoring rule used by build-safety-layer.mjs (documented there)
// and by build-routes.mjs for "virtual" crossings (e.g. a taxi drop-off on the far side of a
// multi-lane road where no crossing facility exists = unmarked crossing).
export const T_SIGNALS = 0, T_ZEBRA = 1, T_UNMARKED = 2, T_GRADE = 3;
export const F = {
  [T_GRADE]: { base: 92, lane: 0, speed: 0, island: 0, night: { yes: 3, unknown: 6, no: 12 } },
  [T_SIGNALS]: { base: 88, lane: 1.5, speed: 0.15, island: 2, night: { yes: 3, unknown: 6, no: 14 } },
  [T_ZEBRA]: { base: 74, lane: 5, speed: 0.45, island: 6, night: { yes: 6, unknown: 12, no: 22 } },
  [T_UNMARKED]: { base: 64, lane: 6, speed: 0.55, island: 5, night: { yes: 8, unknown: 14, no: 24 } },
};
export const DEFAULT_SPEED = { trunk: 70, trunk_link: 50, primary: 60, primary_link: 50, secondary: 60, secondary_link: 50, tertiary: 50, tertiary_link: 50, unclassified: 50, residential: 40, living_street: 20, pedestrian: 10 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** @returns {{day:number, night:number}} rounded, clamped to [5,97] */
export function crossingScore({ type, lanes, speed, lit = 'unknown', island = false, bus = false, school = false, isolated = false, lanesVerified = true }) {
  const f = F[type];
  if (type === T_GRADE) return { day: f.base, night: f.base - f.night[lit] };
  let day = f.base - f.lane * Math.max(0, lanes - 2) - f.speed * Math.max(0, speed - 30) + (island ? f.island : 0);
  if (type !== T_SIGNALS) {
    if (bus) day -= 4;
    if (school) day -= type === T_UNMARKED ? 5 : 4;
    if (isolated) day -= 3;
  }
  if (!lanesVerified) day -= 2;
  day = clamp(day, 5, 97);
  return { day: Math.round(day), night: Math.round(clamp(day - f.night[lit], 5, 97)) };
}
