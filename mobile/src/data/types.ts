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
