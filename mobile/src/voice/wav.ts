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
