/**
 * Minimal Gemini REST client (generateContent). The key is bundled into the app
 * via EXPO_PUBLIC_ env vars — acceptable for the hackathon demo only.
 * Put a spend cap on the key and rotate it after the demo.
 *
 * Measured on 2026-11-12: gemini-3.8-flash hung (>40 s), 3.5-flash took ~10 s,
 * 3.5-flash-lite answered in 1.7–9 s but intermittently returned 403/503,
 * 3.1-flash-lite answered in 0.8–1.7 s (text and Azerbaijani audio, 3/3 correct).
 * So we try a short chain of lite models inside one overall deadline, and the
 * caller falls back to the offline script if everything fails.
 */

export const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
export const GEMINI_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-3.1-flash-lite';
const FALLBACK_MODELS = ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite'];

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

async function once<T>(model: string, body: string, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP_${res.status}: ${text.slice(0, 160)}`);
    }
    const json = await res.json();
    const text: string =
      json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function geminiJson<T>(opts: {
  system: string;
  parts: Part[];
  schema: object;
  timeoutMs?: number;
}): Promise<T> {
  if (!GEMINI_KEY) throw new Error('NO_KEY');
  const deadline = Date.now() + (opts.timeoutMs ?? 9000);
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: 'user', parts: opts.parts }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
      responseSchema: opts.schema,
    },
  });
  const models = [GEMINI_MODEL, ...FALLBACK_MODELS.filter((m) => m !== GEMINI_MODEL)];
  let lastErr: unknown;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const left = deadline - Date.now();
    if (left < 1200) break;
    try {
      // cap the primary attempt so a hanging model still leaves time for a fallback
      return await once<T>(model, body, i === 0 ? Math.min(left, 5000) : left);
    } catch (e) {
      lastErr = e;
      console.warn(`[gemini] ${model} failed: ${String(e).slice(0, 120)}`);
    }
  }
  throw lastErr ?? new Error('GEMINI_DEADLINE');
}
