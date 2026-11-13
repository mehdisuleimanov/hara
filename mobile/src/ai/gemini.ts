/**
 * Gemini REST client (generateContent) — JSON answers, tool/function calling and TTS.
 * The key is bundled via EXPO_PUBLIC_ env vars: put a spend cap on it and rotate after the event.
 *
 * Latency notes (2026-11-12): 3.1-flash-lite answered text + Azerbaijani audio in 0.8–1.7 s;
 * 3.5-flash-lite 1.7–9 s with occasional 403/503. We try a short chain inside one deadline.
 */
import { log } from '@/utils/log';

export const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
/** Optional extra keys (comma-separated). Used in turn when a key hits its daily quota. */
const GEMINI_KEYS = [GEMINI_KEY, ...(process.env.EXPO_PUBLIC_GEMINI_API_KEYS ?? '').split(',').map((k: string) => k.trim())].filter(
  (k, i, a) => !!k && a.indexOf(k) === i,
);
export const GEMINI_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-3.1-flash-lite';
export const GEMINI_TTS_MODEL = process.env.EXPO_PUBLIC_GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';
const TTS_MODELS = [GEMINI_TTS_MODEL, 'gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'].filter((m, i, a) => a.indexOf(m) === i);
const FALLBACK_MODELS = ['gemini-3.5-flash-lite'];
/** `${keyIndex}|${model}` pairs that hit a daily quota this session. */
const exhausted = new Set<string>();
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export type GeminiErrorCode = 'NO_KEY' | 'OFFLINE' | 'TIMEOUT' | 'HTTP_4XX' | 'HTTP_5XX' | 'PARSE' | 'EMPTY';
export class GeminiError extends Error {
  code: GeminiErrorCode;
  status?: number;
  constructor(code: GeminiErrorCode, message: string = code, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export type Part =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { functionCall: { name: string; args?: Record<string, unknown>; id?: string } }
  | { functionResponse: { name: string; response: Record<string, unknown>; id?: string } };

export type Content = { role: 'user' | 'model'; parts: Part[] };

export type FunctionDecl = {
  name: string;
  description: string;
  parameters?: object;
};

let thinkingSupported = true;

/** POST to one model; on a daily-quota 429 moves on to the next key within the same deadline. */
async function post(model: string, body: object, timeoutMs: number): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let lastErr: GeminiError | null = null;
    for (let k = 0; k < GEMINI_KEYS.length; k++) {
      if (exhausted.has(`${k}|${model}`)) continue;
      let res: Response;
      try {
        res = await fetch(`${BASE}/${model}:generateContent`, {
          method: 'POST',
          signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEYS[k] },
          body: JSON.stringify(body),
        });
      } catch (e) {
        throw new GeminiError(ctrl.signal.aborted ? 'TIMEOUT' : 'OFFLINE', String(e));
      }
      if (res.ok) return await res.json();
      const text = await res.text().catch(() => '');
      lastErr = new GeminiError(res.status >= 500 ? 'HTTP_5XX' : 'HTTP_4XX', `HTTP_${res.status}: ${text.slice(0, 300)}`, res.status);
      if (res.status === 429 && /PerDay/i.test(text)) {
        exhausted.add(`${k}|${model}`);
        continue;
      }
      throw lastErr;
    }
    throw lastErr ?? new GeminiError('HTTP_4XX', `HTTP_429: all keys exhausted for ${model}`, 429);
  } finally {
    clearTimeout(timer);
  }
}

function withThinking(gen: Record<string, unknown>) {
  return thinkingSupported ? { ...gen, thinkingConfig: { thinkingLevel: 'minimal' } } : gen;
}

/** Calls the model chain within one deadline. Retries once without thinkingConfig if rejected. */
async function generate(body: (gen: (g: Record<string, unknown>) => Record<string, unknown>) => object, timeoutMs: number, firstCapMs: number) {
  if (!GEMINI_KEY) throw new GeminiError('NO_KEY');
  const deadline = Date.now() + timeoutMs;
  const models = [GEMINI_MODEL, ...FALLBACK_MODELS.filter((m) => m !== GEMINI_MODEL)];
  let lastErr: unknown;
  for (let i = 0; i < models.length; i++) {
    const left = deadline - Date.now();
    if (left < 1200) break;
    try {
      return await post(models[i], body(withThinking), i === 0 ? Math.min(left, firstCapMs) : left);
    } catch (e) {
      if (e instanceof GeminiError && e.code === 'HTTP_4XX' && /thinking/i.test(e.message) && thinkingSupported) {
        thinkingSupported = false;
        i--; // retry same model without thinking
        continue;
      }
      lastErr = e;
      log(`[gemini] ${models[i]} failed: ${String(e).slice(0, 140)}`);
      if (e instanceof GeminiError && (e.code === 'NO_KEY' || e.code === 'OFFLINE')) break;
    }
  }
  if (lastErr instanceof GeminiError) throw lastErr;
  throw new GeminiError('TIMEOUT', String(lastErr ?? 'deadline'));
}

function textOf(json: any): string {
  return json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
}

/** Structured JSON answer (responseSchema). */
export async function geminiJson<T>(opts: { system: string; parts: Part[]; schema: object; timeoutMs?: number; temperature?: number }): Promise<T> {
  const isAudio = opts.parts.some((p) => 'inlineData' in p && p.inlineData.mimeType.startsWith('audio'));
  const json = await generate(
    (gen) => ({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ role: 'user', parts: opts.parts }],
      generationConfig: gen({ temperature: opts.temperature ?? 0.3, responseMimeType: 'application/json', responseSchema: opts.schema }),
    }),
    opts.timeoutMs ?? 12000,
    isAudio ? 8000 : 6000,
  );
  const text = textOf(json);
  if (!text) throw new GeminiError('EMPTY');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GeminiError('PARSE', text.slice(0, 200));
  }
}

/** One raw turn with tools available. Returns the model content (text and/or functionCall parts). */
export async function geminiTurn(opts: {
  system: string;
  contents: Content[];
  tools?: FunctionDecl[];
  timeoutMs?: number;
  temperature?: number;
}): Promise<Content> {
  const json = await generate(
    (gen) => ({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: opts.contents,
      ...(opts.tools?.length ? { tools: [{ functionDeclarations: opts.tools }], toolConfig: { functionCallingConfig: { mode: 'AUTO' } } } : {}),
      generationConfig: gen({ temperature: opts.temperature ?? 0.2 }),
    }),
    opts.timeoutMs ?? 10000,
    7000,
  );
  const content = json?.candidates?.[0]?.content as Content | undefined;
  if (!content?.parts?.length) throw new GeminiError('EMPTY');
  return { role: 'model', parts: content.parts };
}

export type ToolImpl = (args: Record<string, any>) => Promise<Record<string, unknown>> | Record<string, unknown>;

/**
 * Agent loop: the model calls tools (executed on-device), sees their results and answers.
 * `onStep` fires for every real tool call (drives the visible "thinking" trace).
 */
export async function runToolLoop(opts: {
  system: string;
  userParts: Part[];
  tools: { decl: FunctionDecl; impl: ToolImpl }[];
  onStep?: (s: { name: string; args: Record<string, unknown>; result?: Record<string, unknown>; phase: 'call' | 'done' | 'error' }) => void;
  maxTurns?: number;
  timeoutMs?: number;
}): Promise<{ text: string; contents: Content[] }> {
  const deadline = Date.now() + (opts.timeoutMs ?? 16000);
  const contents: Content[] = [{ role: 'user', parts: opts.userParts }];
  const byName = new Map(opts.tools.map((t) => [t.decl.name, t.impl]));
  for (let turn = 0; turn < (opts.maxTurns ?? 4); turn++) {
    const left = deadline - Date.now();
    if (left < 1500) throw new GeminiError('TIMEOUT');
    const reply = await geminiTurn({ system: opts.system, contents, tools: opts.tools.map((t) => t.decl), timeoutMs: left });
    contents.push(reply);
    const calls = reply.parts.filter((p): p is Extract<Part, { functionCall: unknown }> => 'functionCall' in p);
    if (!calls.length) {
      return { text: reply.parts.map((p) => ('text' in p ? p.text : '')).join(''), contents };
    }
    const responses: Part[] = [];
    for (const c of calls) {
      const { name, args = {}, id } = c.functionCall;
      opts.onStep?.({ name, args, phase: 'call' });
      let result: Record<string, unknown>;
      try {
        const impl = byName.get(name);
        result = impl ? await impl(args) : { error: `unknown tool ${name}` };
        opts.onStep?.({ name, args, result, phase: 'done' });
      } catch (e) {
        result = { error: String(e) };
        opts.onStep?.({ name, args, result, phase: 'error' });
      }
      responses.push({ functionResponse: { name, response: result, ...(id ? { id } : {}) } });
    }
    contents.push({ role: 'user', parts: responses });
  }
  throw new GeminiError('TIMEOUT', 'too many tool turns');
}

/**
 * Text-to-speech (Azerbaijani supported). Returns base64 PCM16 mono + sample rate.
 * `style` is prepended as a natural-language instruction.
 */
export async function geminiTts(text: string, opts: { voice?: string; style?: string; timeoutMs?: number } = {}): Promise<{ pcmB64: string; rate: number }> {
  if (!GEMINI_KEY) throw new GeminiError('NO_KEY');
  const prompt = `${opts.style ?? 'Speak quickly and warmly, like a friendly young Baku guide — fast conversational pace, short pauses. Language: North Azerbaijani. Text:'} ${text}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: opts.voice ?? DEFAULT_VOICE } } },
    },
  };
  const deadline = Date.now() + (opts.timeoutMs ?? 8000);
  let lastErr: unknown;
  // same voice on every TTS model: when one model's quota is used up, the next one speaks
  for (const model of TTS_MODELS) {
    const left = deadline - Date.now();
    if (left < 800) break;
    try {
      const json = await post(model, body, left);
      const part = json?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data);
      if (!part) throw new GeminiError('EMPTY');
      const mime: string = part.inlineData.mimeType ?? '';
      const rate = Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000);
      return { pcmB64: part.inlineData.data, rate };
    } catch (e) {
      lastErr = e;
      log(`[tts] ${model} failed: ${String(e).slice(0, 120)}`);
      if (e instanceof GeminiError && (e.code === 'OFFLINE' || e.code === 'TIMEOUT')) break;
    }
  }
  if (lastErr instanceof GeminiError) throw lastErr;
  throw new GeminiError('TIMEOUT', String(lastErr ?? 'deadline'));
}

export const DEFAULT_VOICE = process.env.EXPO_PUBLIC_GEMINI_VOICE || 'Achird';
