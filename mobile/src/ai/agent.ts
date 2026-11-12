/**
 * Əhməd — a real two-stage agent.
 *  1. understand: Gemini (audio or text) → transcript + intent + slots (structured JSON)
 *  2. reason:     Gemini function calling; tools run on-device (weather, routes, safety layer,
 *                 taxi drop-off, live routing). Every real call becomes a visible step.
 * Without a key / network the same tools run locally and a data-only scripted reply is used.
 * Never throws; never surfaces an error to the user.
 */
import { DESTINATIONS, destById } from '@/data/destinations';
import type { Profile, RouteKind, TimeOfDay } from '@/data/types';
import type { AhmedResult, AhmedStep } from '@/store/useAppStore';
import { COMMON } from '@/voice/lines/common';
import { log } from '@/utils/log';
import { GEMINI_KEY, GeminiError, geminiJson, geminiTurn, type Content, type Part } from './gemini';
import { matchIntent, norm } from './fallback';
import { AHMED_SAY, scriptedAreaAnswer, scriptedReply } from './script';
import { TOOL_DECLS, TOOL_LABEL, runTool, stepOutcome, type ToolCtx } from '@/features/ahmed/tools';
import type { LiveRoute } from '@/features/routing/live';

export type AgentInput = { text?: string; audioB64?: string; mime?: string };

export type AgentOpts = {
  aiEnabled: boolean;
  night: boolean;
  /** previous exchanges (for follow-ups like "bəs gündüz?") */
  history?: { q: string; a: string }[];
  /** show the first row as voice understanding even for text (hidden stage trigger) */
  asVoice?: boolean;
  /** step stream for the thinking trace */
  onStep?: (op: StepOp) => void;
  /** the transcript is known (typed out above the trace) */
  onTranscript?: (t: string) => void;
};

export type StepOp = { type: 'add'; step: AhmedStep } | { type: 'update'; id: string; patch: Partial<AhmedStep> };

type Understood = {
  transcript: string;
  intent: 'route' | 'question' | 'unclear';
  destinationId: string;
  placeQuery: string;
  timeOfDay: 'day' | 'night' | 'unspecified';
  profile: Profile;
  preference: RouteKind;
  companions: string[];
};

const IDS = DESTINATIONS.map((d) => d.id);

const UNDERSTAND_SCHEMA = {
  type: 'OBJECT',
  properties: {
    transcript: { type: 'STRING', description: 'Exactly what the user said, Azerbaijani Latin script' },
    intent: { type: 'STRING', enum: ['route', 'question', 'unclear'] },
    destinationId: { type: 'STRING', enum: [...IDS, 'other', 'none'] },
    placeQuery: { type: 'STRING', description: 'Place/street name as said, when not in the catalog or asked about; else empty' },
    timeOfDay: { type: 'STRING', enum: ['day', 'night', 'unspecified'] },
    profile: { type: 'STRING', enum: ['daily', 'accessible', 'scooter', 'family'] },
    preference: { type: 'STRING', enum: ['safest', 'cheapest', 'fastest'] },
    companions: { type: 'ARRAY', items: { type: 'STRING', enum: ['stroller', 'wheelchair', 'child', 'elderly'] } },
  },
  required: ['transcript', 'intent', 'destinationId', 'placeQuery', 'timeOfDay', 'profile', 'preference', 'companions'],
  propertyOrdering: ['transcript', 'intent', 'destinationId', 'placeQuery', 'timeOfDay', 'profile', 'preference', 'companions'],
};

function understandPrompt(night: boolean) {
  const catalog = DESTINATIONS.map((d) => `- ${d.id}: ${d.name} (${d.district}; also: ${d.aliases.join(', ')})`).join('\n');
  return `You are the speech-understanding stage of "Əhməd", the voice companion of "Hara?" — a Baku app that recommends the LEAST RISKY way to walk, ride or travel.
The user speaks Azerbaijani (sometimes mixed with Russian, Turkish or English). Input is audio or text.
The user's location is ALWAYS 28 May metro station (the origin). It is now ${night ? 'NIGHT' : 'DAY'} in Baku.

Return JSON:
- transcript: exactly what the user said, in Azerbaijani Latin script (ə, ı, ş, ç, ğ, ö, ü); fix place-name spelling using the catalog. Empty if nothing intelligible was said.
- intent: "route" if they want to go somewhere / ask how to get somewhere; "question" for a free question about safety, streets, crossings, weather or the app; "unclear" if the audio is silent, noise or not understandable.
- destinationId: the catalog id they want to go to (or ask about). "28 May" is the ORIGIN, never the destination. "other" if they name a place not in the catalog; "none" if no place.
- placeQuery: the place or street name as said when destinationId is "other", or the street/area a question is about; otherwise "".
- timeOfDay: "night" if they mention night/evening/dark (gecə, axşam, qaranlıq), "day" if day/morning, else "unspecified".
- profile: "accessible" for wheelchair, stroller (uşaq arabası), elderly with mobility issues, blind or deaf users; "scooter" for scooter or bicycle; "family" if they talk about tracking a child or family member; otherwise "daily".
- preference: "cheapest" if they want cheap (ucuz, sərfəli, qənaət); "fastest" if in a hurry (tez, sürətli, tələsirəm); otherwise "safest".
- companions: any of stroller, wheelchair, child, elderly.

Catalog:
${catalog}`;
}

function reasonPrompt(night: boolean) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `You are Əhməd, the warm, calm companion inside "Hara?" — a Baku app that finds the LEAST RISKY way (not the fastest) for pedestrians, parents with strollers, wheelchair users, elderly people and scooter riders. The user is always at 28 May metro station. Local time ${hh}:${mm}; treat it as ${night ? 'NIGHT' : 'DAY'} unless the request says otherwise.

How you work:
1. In your FIRST reply, call every tool you need IN PARALLEL. For a route to a catalog destination call get_weather, get_route_options, query_safety_layer (destination_id + route_kind of the option you will recommend) and check_taxi_dropoff. For a place outside the catalog call route_to_place. For a question call query_safety_layer (and get_weather or get_route_options if useful).
2. Then answer in Azerbaijani (Latin script), talking to the user as "sən", like a friend walking next to them.

Rules for the answer:
- Start directly with the answer (no greeting). Keep it under ~35 words for a route, ~45 for a question.
- Route request: 1–2 short spoken sentences. Recommend the option matching the user's preference (safest by default) and say why, using its numbers. If the taxi drops the user on the wrong side of a multi-lane road, mention it briefly. If gusts are too strong for a scooter, say so.
- Question: 2–3 short spoken sentences with the concrete counts you got. Name the area exactly as the tool's "area" field says (e.g. "Nizami m. ətrafında"), never a different street.
- Use ONLY facts returned by the tools. Never invent streets, numbers, prices, times or places.
- Never say "100% təhlükəsiz", "tam təhlükəsiz" or "tamamilə təhlükəsiz" — say "ən az riskli" or "daha təhlükəsiz".
- Prices exactly as given (e.g. "0,60 ₼"); minutes as "14 dəqiqə".
- Plain spoken text only: no markdown, lists, emoji or quotes. Never mention tools, data sources, JSON or that you are an AI model.`;
}

// ---------- helpers ----------

/**
 * Hedged request: Gemini latency has a long tail (0.6 s typical, sometimes > 6 s).
 * If the first request is slow (or fails with a server error), a second identical one is
 * launched; the first success wins. No hedge when there is no network/key.
 */
function hedged<T>(make: (ms: number) => Promise<T>, totalMs: number, hedgeAfterMs: number, maxLaunches = 3): Promise<T> {
  const deadline = Date.now() + totalMs;
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let pending = 0;
    let launches = 0;
    let lastErr: unknown = new GeminiError('TIMEOUT');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      fn();
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      if (launches < maxLaunches) timer = setTimeout(() => !settled && launch(), hedgeAfterMs);
    };
    const launch = (): boolean => {
      const left = deadline - Date.now();
      if (left < 900 || launches >= maxLaunches) return false;
      launches++;
      pending++;
      make(left).then(
        (v) => finish(() => resolve(v)),
        (e) => {
          pending--;
          lastErr = e;
          if (settled) return;
          const code = e instanceof GeminiError ? e.code : '';
          if (code !== 'NO_KEY' && code !== 'OFFLINE' && launch()) return;
          if (pending === 0) finish(() => reject(lastErr));
        },
      );
      schedule();
      return true;
    };
    launch();
  });
}

type ToolEvent = { name: string; args: Record<string, unknown>; result?: Record<string, unknown>; phase: 'call' | 'done' | 'error' };

/** Function-calling loop (same contract as gemini.runToolLoop) with hedged model turns. */
async function toolLoop(opts: {
  system: string;
  userParts: Part[];
  impl: (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  onStep: (e: ToolEvent) => void;
  maxTurns: number;
  timeoutMs: number;
}): Promise<string> {
  const deadline = Date.now() + opts.timeoutMs;
  const contents: Content[] = [{ role: 'user', parts: opts.userParts }];
  for (let turn = 0; turn < opts.maxTurns; turn++) {
    const left = deadline - Date.now();
    if (left < 1200) throw new GeminiError('TIMEOUT');
    const reply = await hedged((ms) => geminiTurn({ system: opts.system, contents, tools: TOOL_DECLS, timeoutMs: ms, temperature: 0.3 }), left, 1800);
    contents.push(reply);
    const calls = reply.parts.filter((p): p is Extract<Part, { functionCall: unknown }> => 'functionCall' in p);
    if (!calls.length) return reply.parts.map((p) => ('text' in p ? p.text : '')).join('');
    const responses: Part[] = [];
    for (const c of calls) {
      const { name, args = {}, id } = c.functionCall;
      opts.onStep({ name, args, phase: 'call' });
      let result: Record<string, unknown>;
      try {
        result = await opts.impl(name, args);
        opts.onStep({ name, args, result, phase: 'done' });
      } catch (e) {
        result = { error: String(e) };
        opts.onStep({ name, args, result, phase: 'error' });
      }
      responses.push({ functionResponse: { name, response: result, ...(id ? { id } : {}) } });
    }
    contents.push({ role: 'user', parts: responses });
  }
  throw new GeminiError('TIMEOUT', 'too many tool turns');
}

const COMPANION_WORD: Record<string, string> = { stroller: 'uşaq arabası', wheelchair: 'əlil arabası', child: 'uşaqla', elderly: 'yaşlı ilə' };

function slotSummary(u: { destId: string | null; place?: string; tod: TimeOfDay | null; companions: string[]; profile: Profile; preference: RouteKind; intent: string }) {
  const parts: string[] = [];
  const d = u.destId ? destById(u.destId) : null;
  if (d) parts.push(d.short);
  else if (u.place) parts.push(u.place);
  if (u.tod) parts.push(u.tod === 'night' ? 'gecə' : 'gündüz');
  const comp = u.companions.map((c) => COMPANION_WORD[c]).filter(Boolean)[0];
  if (comp) parts.push(comp);
  else if (u.profile === 'scooter') parts.push('skuter');
  if (u.preference === 'cheapest') parts.push('sərfəli');
  else if (u.preference === 'fastest') parts.push('tələsir');
  if (!parts.length) parts.push(u.intent === 'question' ? 'sual' : 'aydın deyil');
  return parts.join(' · ');
}

/** Numbers in the reply must exist in tool results / transcript (±10 %), or we don't trust it. */
function grounded(reply: string, sources: string[]) {
  const nums = (s: string) => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => Number(x.replace(',', '.')));
  const pool = new Set<number>();
  for (const s of sources) for (const n of nums(s)) pool.add(n);
  for (const d of DESTINATIONS) for (const n of nums(d.name)) pool.add(n);
  const pl = [...pool];
  return nums(reply).every((x) => pl.some((n) => Math.abs(n - x) <= Math.max(1, n * 0.1)));
}

const BANNED = /(100\s*%|tam\s+təhlükəsiz|tamamilə\s+təhlükəsiz|tam\s+etibarlı)/i;

function cleanReply(t: string) {
  return t
    .replace(/[*_#`>]/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/^["“”']+|["“”']+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function capSentences(t: string, max: number) {
  const parts = t.match(/[^.!?]+[.!?]+/g);
  if (!parts || parts.length <= max) return t;
  return parts.slice(0, max).join('').trim();
}

const toTod = (t?: string): TimeOfDay | null => (t === 'night' ? 'night' : t === 'day' ? 'day' : null);

/** Unique step ids per tool name. */
function stepIds() {
  const n = new Map<string, number>();
  const last = new Map<string, string>();
  return {
    next(name: string) {
      const k = (n.get(name) ?? 0) + 1;
      n.set(name, k);
      const id = `${name}#${k}`;
      last.set(name, id);
      return id;
    },
    last: (name: string) => last.get(name),
  };
}

function makeResult(p: Partial<AhmedResult> & Pick<AhmedResult, 'reply'>, error?: string): AhmedResult {
  return {
    transcript: p.transcript ?? '',
    destId: p.destId ?? null,
    timeOfDay: p.timeOfDay ?? null,
    profile: p.profile ?? 'daily',
    preference: p.preference ?? 'safest',
    companions: p.companions ?? [],
    reply: p.reply,
    source: p.source ?? 'fallback',
    intent: p.intent,
    error: p.error ?? error,
    liveRouteId: p.liveRouteId,
  };
}

// ---------- the agent ----------

export async function runAgent(input: AgentInput, opts: AgentOpts): Promise<AhmedResult> {
  const t0 = Date.now();
  const emit = opts.onStep ?? (() => {});
  const isAudio = !!input.audioB64;
  const voiceLike = isAudio || !!opts.asVoice;
  const useAi = opts.aiEnabled && !!GEMINI_KEY;
  let error: string | undefined;

  // ---- Stage 1: understand
  emit({ type: 'add', step: { id: 'understand', label: voiceLike ? 'Səsini anlayıram…' : 'Sualını oxuyuram…', state: 'run' } });

  let u: Understood | null = null;
  if (useAi) {
    try {
      const ctx = opts.history?.length ? `Previous turns (for follow-ups):\n${opts.history.map((h) => `user: ${h.q}\nəhməd: ${h.a}`).join('\n')}\n\n` : '';
      const parts: Part[] = isAudio
        ? [{ inlineData: { mimeType: input.mime ?? 'audio/mp4', data: input.audioB64! } }, { text: `${ctx}Bu səsli sorğunu emal et.` }]
        : [{ text: `${ctx}${input.text ?? ''}` }];
      u = await hedged(
        (ms) => geminiJson<Understood>({ system: understandPrompt(opts.night), parts, schema: UNDERSTAND_SCHEMA, timeoutMs: ms, temperature: 0.1 }),
        isAudio ? 7000 : 5000,
        isAudio ? 2800 : 1600,
      );
    } catch (e) {
      error = e instanceof GeminiError ? e.code : 'UNKNOWN';
      log('[Əhməd] understand failed', String(e));
    }
  }

  // Audio we could not understand → honest "didn't hear" (never a substituted sentence).
  if (!u && isAudio) {
    emit({ type: 'update', id: 'understand', patch: { label: 'Səs aydın deyil', state: 'warn', value: undefined } });
    return makeResult({ transcript: '', reply: COMMON.didntHear, intent: 'unclear', source: 'fallback' }, error);
  }

  let local = false;
  if (!u) {
    // typed text without the model: offline keyword understanding
    local = true;
    const text = (input.text ?? '').trim();
    const it = matchIntent(text);
    u = {
      transcript: text,
      intent: it.kind,
      destinationId: it.destId ?? 'none',
      placeQuery: '',
      timeOfDay: it.timeOfDay ?? 'unspecified',
      profile: it.profile,
      preference: it.preference,
      companions: it.companions,
    };
  }

  const transcript = (u.transcript || input.text || '').trim();
  opts.onTranscript?.(transcript);
  const destId = u.destinationId && destById(u.destinationId) ? u.destinationId : null;
  const place = (u.placeQuery || '').trim();
  const tod = toTod(u.timeOfDay);
  const night = tod ? tod === 'night' : opts.night;
  const profile: Profile = u.profile ?? 'daily';
  const preference: RouteKind = u.preference ?? 'safest';
  const companions = u.companions ?? [];
  let intent: AhmedResult['intent'] = u.intent ?? 'unclear';
  if (!transcript) intent = 'unclear';
  if (intent === 'route' && !destId && !place) intent = 'unclear';

  emit({
    type: 'update',
    id: 'understand',
    patch: {
      label: voiceLike ? 'Səs anlaşıldı' : 'Sorğu anlaşıldı',
      value: slotSummary({ destId, place, tod, companions, profile, preference, intent }),
      state: intent === 'unclear' ? 'warn' : 'done',
    },
  });

  const base = (p: Partial<AhmedResult> & Pick<AhmedResult, 'reply'>) => makeResult({ transcript, ...p }, error);

  if (intent === 'unclear') {
    return base({
      transcript,
      reply: voiceLike && !transcript ? COMMON.didntHear : AHMED_SAY.askWhere,
      intent,
      source: local ? 'fallback' : 'ai',
      timeOfDay: tod,
      profile,
      preference,
      companions,
    });
  }

  // ---- Stage 2: reason with tools
  const liveBox: { r: LiveRoute | null } = { r: null };
  const ctx: ToolCtx = { night, profile, onLive: (r) => (liveBox.r = r), weatherTimeoutMs: local ? 1500 : 2500 };
  const results: { name: string; args: Record<string, unknown>; result: Record<string, unknown> }[] = [];
  const ids = stepIds();

  const record = (name: string, args: Record<string, unknown>, result: Record<string, unknown>, id: string) => {
    results.push({ name, args, result });
    emit({ type: 'update', id, patch: stepOutcome(name, result) });
  };

  /** Execute a tool locally (model unavailable or skipped it) — a real computation, shown as such. */
  const localCall = async (name: string, args: Record<string, unknown>, opt: { hideIfUnavailable?: boolean } = {}) => {
    const result = await runTool(name, args, ctx);
    if (opt.hideIfUnavailable && result.available === false) {
      results.push({ name, args, result });
      return result;
    }
    const id = ids.next(name);
    emit({ type: 'add', step: { id, label: TOOL_LABEL[name] ?? name, state: 'run' } });
    record(name, args, result, id);
    return result;
  };

  let modelReply = '';
  if (!local && useAi) {
    const left = 10000 - (Date.now() - t0);
    try {
      const request = {
        transcript,
        intent,
        destination_id: destId ?? undefined,
        place_outside_catalog: !destId && place ? place : undefined,
        question_about: intent === 'question' && place ? place : undefined,
        time_of_day: tod ?? (night ? 'night (now)' : 'day (now)'),
        profile,
        preference,
        companions,
      };
      const text = await toolLoop({
        system: reasonPrompt(night),
        userParts: [{ text: `User request (already understood):
${JSON.stringify(request)}` }],
        impl: (name, args) => runTool(name, args, ctx),
        onStep: (s) => {
          if (s.phase === 'call') {
            const id = ids.next(s.name);
            emit({ type: 'add', step: { id, label: TOOL_LABEL[s.name] ?? s.name, state: 'run' } });
          } else {
            const id = ids.last(s.name);
            if (id) record(s.name, s.args, s.result ?? { error: 'no result' }, id);
          }
        },
        maxTurns: 3,
        timeoutMs: Math.max(4000, Math.min(7500, left)),
      });
      modelReply = cleanReply(text);
    } catch (e) {
      error = e instanceof GeminiError ? e.code : 'UNKNOWN';
      log('[Əhməd] reason failed', String(e));
    }
  }

  const has = (name: string) => results.some((r) => r.name === name);

  // Place outside the catalog: try live routing if the model did not.
  if (intent === 'route' && !destId && place && !has('route_to_place')) {
    await localCall('route_to_place', { query: place });
  }
  const liveR = liveBox.r;

  if (intent === 'route' && destId) {
    // Make sure the facts behind the card are computed (truthfully labeled, no fake "calls").
    if (!has('get_weather')) await localCall('get_weather', {}, { hideIfUnavailable: true });
    if (!has('get_route_options')) await localCall('get_route_options', { destination_id: destId, time_of_day: night ? 'night' : 'day' });
    if (!has('query_safety_layer')) await localCall('query_safety_layer', { destination_id: destId, route_kind: preference, time_of_day: night ? 'night' : 'day' });
    if (!has('check_taxi_dropoff')) await localCall('check_taxi_dropoff', { destination_id: destId });
  }

  let areaResult: Record<string, unknown> | null = null;
  if (intent === 'question') {
    const q = results.find((r) => r.name === 'query_safety_layer');
    areaResult = q?.result ?? null;
    if (!q) areaResult = await localCall('query_safety_layer', destId ? { destination_id: destId } : place ? { place } : {});
  }

  // ---- choose the reply
  const sources = [transcript, ...results.map((r) => JSON.stringify(r.result))];
  let reply = '';
  let source: AhmedResult['source'] = 'fallback';
  if (modelReply && !BANNED.test(modelReply) && grounded(modelReply, sources)) {
    reply = capSentences(modelReply, intent === 'question' ? 3 : 2);
    source = 'ai';
  } else if (modelReply) {
    log('[Əhməd] model reply rejected (ungrounded/banned):', modelReply);
  }

  if (intent === 'route') {
    if (liveR) {
      return base({
        transcript,
        destId: `live:${liveR.id}`,
        liveRouteId: liveR.id,
        reply: reply || `${liveR.place.name} üçün ən az riskli yolu tapdım.`,
        intent,
        source,
        timeOfDay: tod,
        profile,
        preference,
        companions,
      });
    }
    if (!destId) {
      // honest: we don't know this place yet
      return base({ transcript, reply: COMMON.unknownPlace, intent, source: 'fallback', timeOfDay: tod, profile, preference, companions });
    }
    return base({
      transcript,
      destId,
      reply: reply || scriptedReply(destId, preference, night),
      intent,
      source,
      timeOfDay: tod,
      profile,
      preference,
      companions,
    });
  }

  // question
  if (!reply) {
    const a = areaResult;
    if (a && a.found && a.scope === 'area') {
      reply = scriptedAreaAnswer(
        {
          name: String(a.area).replace(/ ətrafı$/, ''),
          radiusM: Number(a.radius_m),
          total: Number(a.crossings_total),
          unsignalized: Number(a.unsignalized_total),
          signalized: Number(a.signalized),
          underpass: Number(a.underpass),
        },
        night,
      );
    } else reply = AHMED_SAY.notSure;
  }
  return base({ transcript, destId, reply, intent: 'question', source, timeOfDay: tod, profile, preference, companions });
}

/** Normalised comparison used by the screen to avoid re-asking the same thing. */
export const sameQuery = (a: string, b: string) => norm(a) === norm(b);
