export type LatLng = { latitude: number; longitude: number };

export type Mode = 'walk' | 'metro' | 'bus' | 'taxi' | 'scooter' | 'bike';
export type RouteKind = 'safest' | 'cheapest' | 'fastest';
export type Profile = 'daily' | 'accessible' | 'scooter' | 'family';
export type TimeOfDay = 'day' | 'night';

export type StepType =
  | 'depart'
  | 'arrive'
  | 'left'
  | 'right'
  | 'slight-left'
  | 'slight-right'
  | 'straight'
  | 'uturn'
  | 'board'
  | 'alight';

export type Leg = {
  mode: Mode;
  /** flat [lat, lon, lat, lon, ...] */
  c: number[];
  label?: string;
  distanceM: number;
  durationMin: number;
  /** metro tunnel leg: draw thin/dashed "underground", never slide a walking puck over it */
  underground?: boolean;
  /** metro stations passed on this leg, in order (first = board, last = alight) */
  stations?: { name: string; lat: number; lon: number }[];
};

/**
 * "Son 50 metr": where a taxi actually drops you vs. the destination entrance.
 * Computed from real geometry (OSRM drop-off side + crossings from the safety layer).
 */
export type LastMeters = {
  drop: { lat: number; lon: number };
  /** street the taxi stops on, e.g. "Azadlıq prospekti" */
  street: string;
  /** lanes the pedestrian must cross if they walk straight over */
  lanes: number;
  /** true when the entrance is on the other side of a multi-lane road */
  wrongSide: boolean;
  /** risky direct line across the road (flat [lat,lon,...]) */
  directC: number[];
  /** safe walk via the nearest signalized/underpass crossing (flat [lat,lon,...]) */
  safeC: number[];
  /** the crossing used by the safe walk */
  crossing: { lat: number; lon: number; type: number } | null;
  /** extra meters/minutes of the safe walk vs. the direct line */
  extraM: number;
  extraMin: number;
  /** suggested better drop-off point (same side as the entrance) */
  betterDrop?: { lat: number; lon: number; label: string };
  /** one-line Azerbaijani explanation */
  note: string;
};

export type Step = {
  lat: number;
  lon: number;
  type: StepType;
  street?: string;
  /** distance from route start, meters */
  atM: number;
  leg: number;
};

export type RouteOption = {
  id: string;
  destId: string;
  kind: RouteKind;
  legs: Leg[];
  durationMin: number;
  distanceM: number;
  price: string;
  co2g: number;
  scoreDay: number;
  scoreNight: number;
  /** risky crossings avoided vs fastest walking line */
  avoided: number;
  unsignalized: number;
  reasons: string[];
  warning?: string;
  steps: Step[];
  /** taxi options: the last-meters analysis at the destination */
  lastMeters?: LastMeters;
};

export type Destination = {
  id: string;
  name: string;
  short: string;
  district: string;
  icon: string;
  aliases: string[];
  lat: number;
  lon: number;
};

export type ReportCategory = 'dark' | 'car' | 'lift' | 'crossing' | 'sidewalk' | 'speed';

export type Report = {
  id: string;
  category: ReportCategory;
  lat: number;
  lon: number;
  minutesAgo: number;
  aiConfidence: number;
  count: number;
  mine?: boolean;
};
