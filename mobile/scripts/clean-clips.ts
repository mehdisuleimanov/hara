/** Repairs bundled clips in place: strips a nested WAV header / trailing metadata, fades edges. npx tsx scripts/clean-clips.ts */
import fs from 'node:fs';
import path from 'node:path';
import { cleanEdges, extractPcm, pcmToWav } from '../src/voice/wav';
const dir = path.resolve(__dirname, '..', 'assets', 'voice');
let fixed = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.wav'))) {
  const buf = fs.readFileSync(path.join(dir, f));
  const outer = extractPcm(new Uint8Array(buf.buffer, buf.byteOffset, buf.length));
  const inner = extractPcm(outer.pcm, outer.rate); // nested WAV or trailing LIST chunk inside the data
  if (inner.pcm.length !== outer.pcm.length) fixed++;
  fs.writeFileSync(path.join(dir, f), pcmToWav(cleanEdges(inner.pcm, inner.rate), inner.rate));
}
console.log('repaired', fixed, 'of', fs.readdirSync(dir).length);
