// Dev-time: runs the bundled AI Göz sample photos through REAL Gemini Vision with the
// exact prompt + schema the app uses (src/features/scan/spec.json) and stores the raw
// model answers in src/features/scan/samples.json. The app computes score + stars
// locally from these attributes (src/ai/vision.ts → rate()), exactly as for live photos.
//
// Usage (from mobile/):  node scripts/precompute-scan.mjs [--model gemini-3.1-flash-lite]
// Reads EXPO_PUBLIC_GEMINI_API_KEY from mobile/.env (never printed).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/features/scan/spec.json'), 'utf8'));
const OUT = path.join(ROOT, 'src/features/scan/samples.json');
const SAMPLES = ['signal', 'unmarked', 'underpass'];

const env = {};
try {
  for (const l of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}
const KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || env.EXPO_PUBLIC_GEMINI_API_KEY;
if (!KEY) {
  console.error('No EXPO_PUBLIC_GEMINI_API_KEY in mobile/.env');
  process.exit(1);
}
const argv = process.argv.slice(2);
const forced = argv.includes('--model') ? argv[argv.indexOf('--model') + 1] : null;
const MODELS = forced ? [forced] : ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'];

// Same request body as src/ai/gemini.ts geminiJson() (temperature from src/ai/vision.ts).
function body(b64, thinking) {
  return {
    systemInstruction: { parts: [{ text: SPEC.system }] },
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: b64 } }, { text: SPEC.prompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: SPEC.schema,
      ...(thinking ? { thinkingConfig: { thinkingLevel: 'minimal' } } : {}),
    },
  };
}

function valid(a) {
  if (!a || typeof a !== 'object' || !a.crossing_type || !Array.isArray(a.boxes) || !a.summary_az) return false;
  return a.boxes.every((b) => Array.isArray(b.box_2d) && b.box_2d.length === 4 && b.box_2d[0] < b.box_2d[2] && b.box_2d[1] < b.box_2d[3]);
}

async function call(model, b64) {
  let thinking = true;
  for (let attempt = 0; attempt < 4; attempt++) {
    const t0 = Date.now();
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify(body(b64, thinking)),
    });
    const ms = Date.now() - t0;
    const text = await res.text();
    if (res.status === 400 && /thinking/i.test(text) && thinking) {
      thinking = false;
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      console.log(`  ${model}: HTTP ${res.status}, retrying`);
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`${model} HTTP ${res.status}: ${text.slice(0, 300)}`);
    const j = JSON.parse(text);
    const out = j?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    try {
      const a = JSON.parse(out);
      if (valid(a)) return { attrs: a, ms };
      console.log(`  ${model}: answer failed validation, retrying`);
    } catch {
      console.log(`  ${model}: unparsable answer, retrying`);
    }
  }
  throw new Error(`${model}: no valid answer`);
}

const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
const samples = {};
let usedModel = null;
for (const id of SAMPLES) {
  const b64 = fs.readFileSync(path.join(ROOT, 'assets/scan', `${id}.jpg`)).toString('base64');
  let done = false;
  for (const model of MODELS) {
    try {
      const { attrs, ms } = await call(model, b64);
      samples[id] = { ...attrs, _model: model, _latencyMs: ms };
      usedModel = usedModel ?? model;
      console.log(`${id}: ${model} ${ms} ms → ${attrs.crossing_type}, ${attrs.lanes_to_cross} lanes, ${attrs.boxes.length} boxes`);
      console.log(`  "${attrs.summary_az}"`);
      done = true;
      break;
    } catch (e) {
      console.log(`  ${String(e).slice(0, 200)}`);
    }
  }
  if (!done) {
    if (prev?.samples?.[id]) samples[id] = prev.samples[id];
    console.log(`${id}: kept previous result`);
  }
}

const out = {
  source: 'gemini',
  model: usedModel,
  specVersion: SPEC.version,
  generated: new Date().toISOString(),
  samples,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${path.relative(ROOT, OUT)}`);
