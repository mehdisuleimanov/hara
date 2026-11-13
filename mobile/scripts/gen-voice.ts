/**
 * Pre-generates Əhməd's Azerbaijani voice clips with Gemini TTS.
 *   npx -y tsx scripts/gen-voice.ts                 # all missing lines
 *   npx -y tsx scripts/gen-voice.ts --voices Puck,Charon,Achird   # A/B one sample line per voice → scripts/.voice-ab/
 *   npx -y tsx scripts/gen-voice.ts --voice Charon --force
 * Reads EXPO_PUBLIC_GEMINI_API_KEY (+ optional EXPO_PUBLIC_GEMINI_TTS_MODEL) from mobile/.env.
 */
import fs from 'node:fs';
import path from 'node:path';
import { allLines } from '../src/voice/lines/index';
import { lineKey } from '../src/voice/key';
import { b64ToBytes, compressPauses, pcmToWav } from '../src/voice/wav';

const ROOT = path.resolve(__dirname, '..');
const env: Record<string, string> = {};
try {
  for (const l of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}
const KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || env.EXPO_PUBLIC_GEMINI_API_KEY;
const MODEL = process.env.EXPO_PUBLIC_GEMINI_TTS_MODEL || env.EXPO_PUBLIC_GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';
if (!KEY) {
  console.error('No EXPO_PUBLIC_GEMINI_API_KEY in mobile/.env');
  process.exit(1);
}

const args = process.argv.slice(2);
const arg = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const VOICE = arg('--voice') || env.EXPO_PUBLIC_GEMINI_VOICE || 'Achird';
const FORCE = args.includes('--force');
const STYLE = 'Speak quickly and warmly, like a friendly young Baku guide — fast conversational pace, short pauses. Language: North Azerbaijani. Text:';

// All keys (free tier quotas are per project): main + GEMINI_API_KEY1..9
const KEYS = [KEY!, ...Array.from({ length: 9 }, (_, i) => process.env[`GEMINI_API_KEY${i + 1}`] || env[`GEMINI_API_KEY${i + 1}`]).filter(Boolean)] as string[];
const MODELS = [MODEL, 'gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'].filter((m, i, a) => a.indexOf(m) === i);
const dead = new Set<string>(); // `${key}|${model}` exhausted for today
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ttsOnce(text: string, voice: string, key: string, model: string): Promise<Uint8Array | 'quota' | null> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `${STYLE} ${text}` }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
    }),
  });
  const j: any = await res.json().catch(() => ({}));
  if (res.status === 429) {
    const details: any[] = j?.error?.details ?? [];
    const ids = details.flatMap((d) => d?.violations ?? []).map((v: any) => String(v?.quotaId ?? ''));
    if (ids.some((id) => /PerDay/i.test(id))) return 'quota';
    const delay = Number(/(\d+(?:\.\d+)?)s/.exec(details.find((d) => d?.retryDelay)?.retryDelay ?? '')?.[1] ?? 20);
    console.warn(`  · per-minute limit (${model}), waiting ${Math.ceil(delay)}s`);
    await sleep(Math.min(65, delay) * 1000 + 500);
    return null;
  }
  if (!res.ok) {
    if (res.status >= 500) return null;
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
  }
  const part = j?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data);
  if (!part) {
    console.warn(`  · no audio (${model}, finish=${j?.candidates?.[0]?.finishReason})`);
    return null;
  }
  const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType ?? '')?.[1] ?? 24000);
  return pcmToWav(compressPauses(b64ToBytes(part.inlineData.data), rate), rate);
}

/** Tries the preferred key first, then every other key/model; retries network errors. */
async function tts(text: string, voice: string, prefer = 0): Promise<Uint8Array> {
  for (let round = 0; round < 25; round++) {
    if (KEYS.every((k) => MODELS.every((m) => dead.has(`${k}|${m}`)))) throw new Error('all daily quotas used');
    for (const model of MODELS) {
      for (let i = 0; i < KEYS.length; i++) {
        const key = KEYS[(prefer + i) % KEYS.length];
        if (dead.has(`${key}|${model}`)) continue;
        try {
          const r = await ttsOnce(text, voice, key, model);
          if (r === 'quota') { dead.add(`${key}|${model}`); continue; }
          if (r) return r;
        } catch (e) {
          if (!/fetch failed|ENOTFOUND|ECONN|ETIMEDOUT|socket/i.test(String((e as any)?.cause ?? e))) throw e;
        }
        await sleep(1500);
      }
    }
    await sleep(20000);
  }
  throw new Error('retries exhausted');
}

async function main() {
  const voices = arg('--voices');
  if (voices) {
    const dir = path.join(ROOT, 'scripts', '.voice-ab');
    fs.mkdirSync(dir, { recursive: true });
    const sample = 'Salam! Mən Əhmədəm. Gecədir, ona görə səni işıqlı küçələrlə aparacağam: metro, sonra iki dəqiqə piyada, bir işıqforlu keçid.';
    for (const v of voices.split(',')) {
      const wav = await tts(sample, v.trim());
      fs.writeFileSync(path.join(dir, `${v.trim()}.wav`), wav);
      console.log('wrote', v, wav.length, 'bytes');
    }
    return;
  }
  const outDir = path.join(ROOT, 'assets', 'voice');
  fs.mkdirSync(outDir, { recursive: true });
  const lines = allLines();
  const map: Record<string, string> = {};
  let made = 0;
  const todo: string[] = [];
  for (const line of lines) {
    const k = lineKey(line);
    map[k] = line;
    if (FORCE || !fs.existsSync(path.join(outDir, `${k}.wav`))) todo.push(line);
  }
  // --first k1,k2,…  → make these line keys first (demo-critical lines)
  const first = (arg('--first') ?? '').split(',').filter(Boolean);
  todo.sort((a, b) => {
    const ia = first.indexOf(lineKey(a));
    const ib = first.indexOf(lineKey(b));
    return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib);
  });
  // --serial → one request at a time (free tier has tight per-minute limits)
  const workers = args.includes('--serial') ? [0] : KEYS.map((_, w) => w);
  console.log(`keys: ${KEYS.length}, lines to make: ${todo.length}, workers: ${workers.length}`);
  let next = 0;
  let stopAll = false;
  await Promise.all(
    workers.map(async (w) => {
      while (next < todo.length && !stopAll) {
        const line = todo[next++];
        const k = lineKey(line);
        try {
          const wav = await tts(line, VOICE, w);
          fs.writeFileSync(path.join(outDir, `${k}.wav`), wav);
          made++;
          console.log(`✓ [${w}] ${k} ${(wav.length / 1024).toFixed(0)}KB  ${line.slice(0, 60)}`);
        } catch (e) {
          console.error(`✗ ${k} ${line.slice(0, 50)} → ${String(e).slice(0, 160)}`);
          if (/all daily quotas used/.test(String(e))) stopAll = true;
        }
      }
    }),
  );
  // regenerate the clip map from files that exist
  const entries = Object.keys(map)
    .filter((k) => fs.existsSync(path.join(outDir, `${k}.wav`)))
    .sort()
    .map((k) => `  '${k}': require('../../assets/voice/${k}.wav'), // ${map[k].replace(/\n/g, ' ').slice(0, 80)}`);
  const src = `// AUTO-GENERATED by scripts/gen-voice.ts — do not edit by hand.\n// Maps lineKey(text) → bundled Azerbaijani clip (Gemini TTS, voice ${VOICE}).\n/* eslint-disable */\nexport const CLIPS: Record<string, number> = {\n${entries.join('\n')}\n};\nexport const CLIP_VOICE = '${VOICE}';\n`;
  fs.writeFileSync(path.join(ROOT, 'src', 'voice', 'clips.generated.ts'), src);
  console.log(`done: ${made} new, ${entries.length} total clips`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
