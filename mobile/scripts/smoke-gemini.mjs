// Smoke test for the Gemini key/model used by Əhməd.
// Usage: npm run smoke:gemini   (reads .env via node --env-file)
const KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const MODEL = process.argv[2] || process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-3.1-flash-lite';
if (!KEY) {
  console.error('EXPO_PUBLIC_GEMINI_API_KEY missing in .env');
  process.exit(1);
}

const schema = {
  type: 'OBJECT',
  properties: {
    transcript: { type: 'STRING' },
    destinationId: { type: 'STRING', enum: ['hilton', 'icherisheher', 'genclik', 'port', 'unknown'] },
    timeOfDay: { type: 'STRING', enum: ['day', 'night', 'unspecified'] },
    preference: { type: 'STRING', enum: ['safest', 'cheapest', 'fastest'] },
    reply: { type: 'STRING' },
  },
  required: ['transcript', 'destinationId', 'timeOfDay', 'preference', 'reply'],
};

const SENTENCES = [
  ['Gecədir, uşaq arabası ilə 28 May metrosundan Hilton-a getmək istəyirəm', 'hilton'],
  ['İçərişəhərə ən ucuz yolla necə gedim?', 'icherisheher'],
  ['Tələsirəm, Gənclik Mall-a', 'genclik'],
  ['Port Baku-ya getmək istəyirəm', 'port'],
  ['Marsa necə gedim', 'unknown'],
];

async function call(text, auth) {
  const t0 = Date.now();
  const headers = { 'Content-Type': 'application/json' };
  if (auth === 'key') headers['x-goog-api-key'] = KEY;
  else headers.Authorization = `Bearer ${KEY}`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: 'You map Azerbaijani travel requests in Baku to a destination id. Origin is always 28 May metro. Reply in Azerbaijani, 1 sentence.' }] },
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: { temperature: 0.3, responseMimeType: 'application/json', responseSchema: schema },
    }),
  });
  const ms = Date.now() - t0;
  const body = await res.text();
  if (!res.ok) return { ok: false, ms, status: res.status, body: body.slice(0, 300) };
  const j = JSON.parse(body);
  const out = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
  return { ok: true, ms, json: JSON.parse(out) };
}

console.log(`model: ${MODEL}`);
let auth = 'key';
let first = await call(SENTENCES[0][0], 'key');
if (!first.ok) {
  console.log(`x-goog-api-key failed (${first.status}): ${first.body}`);
  first = await call(SENTENCES[0][0], 'bearer');
  auth = 'bearer';
  if (!first.ok) {
    console.log(`Bearer failed (${first.status}): ${first.body}`);
    process.exit(2);
  }
}
console.log(`auth: ${auth}`);
let pass = 0;
for (const [i, [text, expected]] of SENTENCES.entries()) {
  const r = i === 0 ? first : await call(text, auth);
  if (!r.ok) {
    console.log(`✗ ${text} -> HTTP ${r.status} ${r.body}`);
    continue;
  }
  const ok = r.json.destinationId === expected;
  if (ok) pass++;
  console.log(`${ok ? '✓' : '✗'} ${r.ms}ms  "${text}" -> ${r.json.destinationId}/${r.json.timeOfDay}/${r.json.preference} | ${r.json.reply}`);
}
console.log(`${pass}/${SENTENCES.length} correct`);
