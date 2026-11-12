/** Stable clip key for a spoken line (shared by the app and scripts/gen-voice.ts — no RN imports). */
export function normalizeLine(text: string) {
  return text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function lineKey(text: string) {
  const s = normalizeLine(text);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
