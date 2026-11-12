/**
 * AI Göz — Gemini Vision codes a street photo with iRAP-style pedestrian attributes.
 *
 * The model only DESCRIBES what it sees (spec.json: one prompt + JSON schema, shared with
 * scripts/precompute-scan.mjs so the bundled sample answers are genuine model output).
 * The 0–100 score and the 1–5 stars are computed HERE, locally and deterministically,
 * from those attributes (rate()), so the same photo description always gives the same
 * rating and every point can be explained.
 */
import { geminiJson, GeminiError } from './gemini';
import SPEC from '@/features/scan/spec.json';

export type CrossingKind = 'signalized' | 'zebra' | 'unmarked' | 'underpass' | 'footbridge' | 'none';
export type BoxLabel =
  | 'crosswalk'
  | 'pedestrian_signal'
  | 'traffic_light'
  | 'pedestrian'
  | 'car'
  | 'bus'
  | 'median'
  | 'street_light'
  | 'crossing_sign'
  | 'stairs'
  | 'escalator'
  | 'ramp'
  | 'lift'
  | 'underpass_entrance'
  | 'footbridge'
  | 'bollard'
  | 'lane_marking';

export type VisionBox = { label: BoxLabel; box_2d: [number, number, number, number] };

export type VisionAttrs = {
  is_street_scene: boolean;
  crossing_type: CrossingKind;
  pedestrian_signal: boolean;
  vehicle_signal: boolean;
  lanes_to_cross: number;
  median_refuge: boolean;
  street_lighting: boolean;
  sidewalk: 'good' | 'poor' | 'none' | 'unknown';
  grade_access: 'at_grade' | 'stairs' | 'escalator' | 'lift' | 'ramp' | 'unknown';
  step_free: 'yes' | 'no' | 'unknown';
  speed_context: 'residential' | 'urban_street' | 'urban_arterial' | 'highway';
  parked_cars_block_view: boolean;
  pedestrians_in_traffic: boolean;
  boxes: VisionBox[];
  summary_az: string;
};

/** Azerbaijani names for the box label pills. */
export const BOX_LABEL_AZ: Record<BoxLabel, string> = {
  crosswalk: 'Zebra',
  pedestrian_signal: 'Piyada işığı',
  traffic_light: 'İşıqfor',
  pedestrian: 'Piyada',
  car: 'Avtomobil',
  bus: 'Avtobus',
  median: 'Adacıq',
  street_light: 'Küçə işığı',
  crossing_sign: 'Keçid nişanı',
  stairs: 'Pilləkən',
  escalator: 'Eskalator',
  ramp: 'Pandus',
  lift: 'Lift',
  underpass_entrance: 'Yeraltı keçid',
  footbridge: 'Yerüstü keçid',
  bollard: 'Dirək',
  lane_marking: 'Zolaq xətti',
};

/** Box tint: green = protects pedestrians, red = conflict / risk, blue = context. */
export function boxTone(l: BoxLabel): 'safe' | 'risk' | 'info' {
  if (l === 'pedestrian' || l === 'car' || l === 'bus') return 'risk';
  if (l === 'lane_marking' || l === 'bollard' || l === 'street_light') return 'info';
  return 'safe';
}

export type FactorState = 'ok' | 'warn' | 'bad';
export type Factor = { id: string; label: string; state: FactorState; delta: number; icon: string };
export type Rating = { score: number; stars: 1 | 2 | 3 | 4 | 5; factors: Factor[]; gradeSeparated: boolean; accessible: boolean | null };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * iRAP-inspired pedestrian rating (prototype rules, documented so every point is explainable).
 * iRAP's pedestrian Star Rating weighs the crossing facility, number of lanes, median/refuge,
 * operating speed, street lighting, sidewalk provision and visibility. We mirror that:
 *
 *   base by facility    underpass/footbridge 84 · signalized 78 (−6 if no pedestrian light)
 *                       zebra 60 · unmarked 36 · none 30
 *   lanes (at grade)    −4 per lane above 2 (max −20)
 *   median (at grade)   +8 if a refuge splits ≥3 lanes, −4 if none on ≥4 lanes
 *   speed context       residential +6 · urban street 0 · arterial −6 · highway −14 (halved if grade-separated)
 *   street lighting     +4 visible / −6 not visible
 *   sidewalk            good +4 · poor −4 · none −10
 *   visibility          −5 parked cars hide pedestrians (at grade)
 *   behaviour           −6 pedestrians standing in traffic outside a crossing
 *   score = clamp(10..98); stars: ≥80 ★5 · ≥65 ★4 · ≥50 ★3 · ≥35 ★2 · else ★1
 *
 * Step-free access is reported separately (accessibility), it does not change collision risk.
 */
export function rate(a: VisionAttrs): Rating {
  const f: Factor[] = [];
  const t = a.crossing_type;
  const gradeSep = t === 'underpass' || t === 'footbridge';
  const lanes = clamp(Math.round(a.lanes_to_cross || 0), 0, 10);

  // 1. facility
  const BASE: Record<CrossingKind, number> = { underpass: 84, footbridge: 84, signalized: 78, zebra: 60, unmarked: 36, none: 30 };
  let score = BASE[t] ?? 30;
  const FAC: Record<CrossingKind, [string, FactorState, string]> = {
    signalized: ['İşıqforlu keçid', 'ok', 'traffic-light-outline'],
    zebra: ['Zebra var, işıqfor yoxdur', 'warn', 'walk'],
    unmarked: ['Nişansız keçid', 'bad', 'alert-outline'],
    none: ['Piyada keçidi yoxdur', 'bad', 'alert-outline'],
    underpass: ['Yeraltı keçid', 'ok', 'stairs-down'],
    footbridge: ['Yerüstü keçid', 'ok', 'bridge'],
  };
  f.push({ id: 'facility', label: FAC[t][0], state: FAC[t][1], delta: 0, icon: FAC[t][2] });

  if (t === 'signalized') {
    const d = a.pedestrian_signal ? 0 : -6;
    score += d;
    f.push({ id: 'pedsig', label: a.pedestrian_signal ? 'Piyada işığı var' : 'Piyada işığı görünmür', state: a.pedestrian_signal ? 'ok' : 'warn', delta: d, icon: 'walk' });
  }

  // 2. lanes
  if (lanes > 0) {
    const d = gradeSep ? 0 : -Math.min(20, 4 * Math.max(0, lanes - 2));
    score += d;
    f.push({
      id: 'lanes',
      label: gradeSep ? `${lanes} zolağın ${t === 'underpass' ? 'altından' : 'üstündən'} keçirsən` : `${lanes} zolaq keçmək lazımdır`,
      state: gradeSep || lanes <= 2 ? 'ok' : lanes === 3 ? 'warn' : 'bad',
      delta: d,
      icon: 'road-variant',
    });
  }

  // 3. median / refuge
  if (!gradeSep && lanes >= 3) {
    const d = a.median_refuge ? 8 : lanes >= 4 ? -4 : 0;
    score += d;
    f.push({ id: 'median', label: a.median_refuge ? 'Ortada adacıq var' : 'Ortada adacıq yoxdur', state: a.median_refuge ? 'ok' : 'bad', delta: d, icon: 'island' });
  }

  // 4. speed context
  const SPEED: Record<VisionAttrs['speed_context'], [number, string, FactorState]> = {
    residential: [6, 'Sakit məhəllə küçəsi', 'ok'],
    urban_street: [0, 'Şəhər küçəsi', 'ok'],
    urban_arterial: [-6, 'Magistral küçə, sürət yüksəkdir', 'bad'],
    highway: [-14, 'Sürətli yol', 'bad'],
  };
  const sp = SPEED[a.speed_context] ?? SPEED.urban_street;
  const spd = gradeSep ? Math.round(sp[0] / 2) : sp[0];
  score += spd;
  f.push({ id: 'speed', label: sp[1], state: gradeSep && sp[2] === 'bad' ? 'warn' : sp[2], delta: spd, icon: 'speedometer' });

  // 5. lighting
  const ld = a.street_lighting ? 4 : -6;
  score += ld;
  f.push({ id: 'light', label: a.street_lighting ? 'Küçə işığı görünür' : 'Küçə işığı görünmür', state: a.street_lighting ? 'ok' : 'warn', delta: ld, icon: 'lightbulb-on-outline' });

  // 6. sidewalk
  if (a.sidewalk !== 'unknown') {
    const SW = { good: [4, 'Səki rahatdır', 'ok'], poor: [-4, 'Səki pis vəziyyətdədir', 'warn'], none: [-10, 'Səki görünmür', 'bad'] } as const;
    const [d, label, state] = SW[a.sidewalk];
    score += d;
    f.push({ id: 'sidewalk', label, state, delta: d, icon: 'walk' });
  }

  // 7. visibility + behaviour
  if (!gradeSep && a.parked_cars_block_view) {
    score -= 5;
    f.push({ id: 'parked', label: 'Park edilmiş maşınlar görüntünü bağlayır', state: 'bad', delta: -5, icon: 'car-off' });
  }
  if (a.pedestrians_in_traffic) {
    score -= 6;
    f.push({ id: 'intraffic', label: 'Piyada maşınların arasında dayanıb', state: 'bad', delta: -6, icon: 'account-alert-outline' });
  }

  // 8. accessibility (reported, not scored)
  let accessible: boolean | null = null;
  if (a.step_free === 'yes') {
    accessible = true;
    f.push({ id: 'access', label: 'Pilləkənsiz keçmək olur', state: 'ok', delta: 0, icon: 'wheelchair-accessibility' });
  } else if (a.step_free === 'no') {
    accessible = false;
    const how = a.grade_access === 'escalator' ? 'Yalnız eskalator, lift görünmür' : a.grade_access === 'stairs' ? 'Yalnız pilləkən, lift görünmür' : 'Əlil arabası ilə keçmək çətindir';
    f.push({ id: 'access', label: how, state: 'bad', delta: 0, icon: 'wheelchair-accessibility' });
  }

  score = Math.round(clamp(score, 10, 98));
  const stars = (score >= 80 ? 5 : score >= 65 ? 4 : score >= 50 ? 3 : score >= 35 ? 2 : 1) as Rating['stars'];
  return { score, stars, factors: f, gradeSeparated: gradeSep, accessible };
}

const VALID_LABELS = new Set(Object.keys(BOX_LABEL_AZ));

/** Keep only well-formed boxes and in-range values (the model can be sloppy). */
export function sanitize(raw: Partial<VisionAttrs>): VisionAttrs {
  const boxes = (Array.isArray(raw.boxes) ? raw.boxes : [])
    .filter((b) => b && VALID_LABELS.has(b.label) && Array.isArray(b.box_2d) && b.box_2d.length === 4)
    .map((b) => {
      const [y0, x0, y1, x1] = b.box_2d.map((v) => clamp(Math.round(Number(v) || 0), 0, 1000));
      return { label: b.label, box_2d: [Math.min(y0, y1), Math.min(x0, x1), Math.max(y0, y1), Math.max(x0, x1)] as VisionBox['box_2d'] };
    })
    .filter((b) => b.box_2d[2] - b.box_2d[0] >= 8 && b.box_2d[3] - b.box_2d[1] >= 8)
    .slice(0, 8);
  return {
    is_street_scene: raw.is_street_scene !== false,
    crossing_type: (raw.crossing_type ?? 'none') as CrossingKind,
    pedestrian_signal: !!raw.pedestrian_signal,
    vehicle_signal: !!raw.vehicle_signal,
    lanes_to_cross: clamp(Math.round(Number(raw.lanes_to_cross) || 0), 0, 10),
    median_refuge: !!raw.median_refuge,
    street_lighting: !!raw.street_lighting,
    sidewalk: raw.sidewalk ?? 'unknown',
    grade_access: raw.grade_access ?? 'unknown',
    step_free: raw.step_free ?? 'unknown',
    speed_context: raw.speed_context ?? 'urban_street',
    parked_cars_block_view: !!raw.parked_cars_block_view,
    pedestrians_in_traffic: !!raw.pedestrians_in_traffic,
    boxes,
    summary_az: String(raw.summary_az ?? '').trim(),
  };
}

export const VISION_TIMEOUT_MS = 9000;

/**
 * Live photo → attributes. Throws GeminiError (NO_KEY / OFFLINE / TIMEOUT / …) so the
 * screen can guide the user calmly; never shown as an error.
 */
export async function analyzePhoto(jpegB64: string, timeoutMs = VISION_TIMEOUT_MS): Promise<VisionAttrs> {
  const raw = await geminiJson<Partial<VisionAttrs>>({
    system: SPEC.system,
    parts: [{ inlineData: { mimeType: 'image/jpeg', data: jpegB64 } }, { text: SPEC.prompt }],
    schema: SPEC.schema,
    timeoutMs,
    temperature: 0.2,
  });
  const a = sanitize(raw);
  if (!a.summary_az) throw new GeminiError('EMPTY');
  return a;
}
