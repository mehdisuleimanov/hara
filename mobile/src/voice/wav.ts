/** PCM16 mono (base64) → WAV bytes. No RN imports (also used by scripts). */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]);
    const b = B64.indexOf(clean[i + 1]);
    const c = B64.indexOf(clean[i + 2]);
    const d = B64.indexOf(clean[i + 3]);
    const n = (a << 18) | (b << 12) | ((c < 0 ? 0 : c) << 6) | (d < 0 ? 0 : d);
    if (p < len) out[p++] = (n >> 16) & 255;
    if (p < len && c >= 0) out[p++] = (n >> 8) & 255;
    if (p < len && d >= 0) out[p++] = n & 255;
  }
  return out;
}

/**
 * Shortens long silent pauses in PCM16 mono (keeps natural rhythm, removes dead air).
 * Silence = 20 ms windows with RMS < threshold; runs longer than maxPauseMs are cut to maxPauseMs.
 */
export function compressPauses(pcm: Uint8Array, rate = 24000, maxPauseMs = 280, threshold = 300): Uint8Array {
  const n = Math.floor(pcm.length / 2);
  const view = new DataView(pcm.buffer, pcm.byteOffset, n * 2);
  const win = Math.max(1, Math.floor(rate / 50));
  const keepWins = Math.max(1, Math.round(maxPauseMs / 20));
  const out = new Uint8Array(pcm.length);
  let o = 0;
  let silentRun = 0;
  for (let i = 0; i < n; i += win) {
    const end = Math.min(n, i + win);
    let sum = 0;
    for (let j = i; j < end; j++) {
      const v = view.getInt16(j * 2, true);
      sum += v * v;
    }
    const rms = Math.sqrt(sum / (end - i));
    const silent = rms < threshold;
    silentRun = silent ? silentRun + 1 : 0;
    if (silent && silentRun > keepWins) continue;
    out.set(pcm.subarray(i * 2, end * 2), o);
    o += (end - i) * 2;
  }
  return out.slice(0, o);
}

/**
 * Newer Gemini TTS models return a complete WAV file instead of raw PCM. Wrapping that again made the
 * inner header click at the start and its trailing metadata (LIST chunk) crackle at the end.
 * Returns only the PCM samples (and the real sample rate if a header was found).
 */
export function extractPcm(bytes: Uint8Array, rate = 24000): { pcm: Uint8Array; rate: number } {
  const tag = (o: number) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
  const u32 = (o: number) => (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0;
  if (bytes.length > 12 && tag(0) === 'RIFF' && tag(8) === 'WAVE') {
    let o = 12;
    let r = rate;
    while (o + 8 <= bytes.length) {
      const id = tag(o);
      const size = u32(o + 4);
      if (id === 'fmt ') r = u32(o + 12) || r;
      if (id === 'data') {
        const end = Math.min(bytes.length, o + 8 + (size || bytes.length));
        return { pcm: stripTrailer(bytes.subarray(o + 8, end - ((end - o - 8) % 2))), rate: r };
      }
      o += 8 + size + (size % 2);
    }
  }
  return { pcm: stripTrailer(bytes), rate };
}

/** Cuts a trailing metadata chunk (C2PA content credentials, LIST, ID3) that would play as noise. */
function stripTrailer(pcm: Uint8Array): Uint8Array {
  const from = Math.max(0, pcm.length - 65536);
  for (let o = from; o + 4 <= pcm.length; o++) {
    const a = pcm[o];
    if (a !== 0x43 && a !== 0x4c && a !== 0x69 && a !== 0x49) continue; // C L i I
    const t = String.fromCharCode(a, pcm[o + 1], pcm[o + 2], pcm[o + 3]);
    if (t === 'C2PA' || t === 'LIST' || t === 'id3 ' || t === 'ID3 ') return pcm.subarray(0, o - (o % 2));
  }
  return pcm;
}

/** Short fade-in/out and a little trailing silence so playback starts and ends without a click. */
export function cleanEdges(pcm: Uint8Array, rate = 24000): Uint8Array {
  const n = Math.floor(pcm.length / 2);
  const view = new DataView(pcm.buffer, pcm.byteOffset, n * 2);
  const fade = Math.min(Math.floor(n / 2), Math.floor(rate * 0.012));
  const pad = Math.floor(rate * 0.08);
  const out = new Uint8Array((n + pad) * 2);
  const ov = new DataView(out.buffer);
  for (let k = 0; k < n; k++) {
    let v = view.getInt16(k * 2, true);
    if (k < fade) v = Math.round((v * k) / fade);
    if (n - k < fade) v = Math.round((v * (n - k)) / fade);
    ov.setInt16(k * 2, v, true);
  }
  return out;
}

export function pcmToWav(pcm: Uint8Array, rate = 24000, channels = 1, bits = 16): Uint8Array {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  const byteRate = (rate * channels * bits) / 8;
  w(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, byteRate, true);
  v.setUint16(32, (channels * bits) / 8, true);
  v.setUint16(34, bits, true);
  w(36, 'data');
  v.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
}
