import * as Speech from 'expo-speech';

/**
 * Əhməd's voice via the phone's own TTS. Most phones have no Azerbaijani voice,
 * so we fall back to Turkish and lightly transliterate the letters Turkish TTS
 * can't pronounce (ə, x, q).
 */

let voice: { id?: string; language: string; transliterate: boolean } = {
  language: 'tr-TR',
  transliterate: true,
};
let muted = false;

export async function initTts() {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const az = voices.find((v) => v.language?.toLowerCase().startsWith('az'));
    if (az) {
      voice = { id: az.identifier, language: az.language, transliterate: false };
      return;
    }
    const trVoices = voices.filter((v) => v.language?.toLowerCase().startsWith('tr'));
    const tr = trVoices.find((v) => String(v.quality).toLowerCase() === 'enhanced') ?? trVoices[0];
    voice = { id: tr?.identifier, language: tr?.language ?? 'tr-TR', transliterate: true };
  } catch {}
}

export function ttsInfo() {
  return voice;
}

function forTurkish(text: string) {
  return text
    .replace(/Ə/g, 'E')
    .replace(/ə/g, 'e')
    .replace(/X/g, 'H')
    .replace(/x/g, 'h')
    .replace(/Q/g, 'G')
    .replace(/q/g, 'g')
    .replace(/₼/g, ' manat')
    .replace(/(\d)\s?m\b/g, '$1 metr')
    .replace(/(\d)\s?dəq\b/g, '$1 dakika');
}

export function speak(text: string, opts: { onDone?: () => void } = {}) {
  if (muted || !text) {
    opts.onDone?.();
    return;
  }
  Speech.stop().catch(() => {});
  Speech.speak(voice.transliterate ? forTurkish(text) : text, {
    language: voice.language,
    voice: voice.id,
    rate: 1.0,
    pitch: 1.0,
    onDone: opts.onDone,
    onStopped: opts.onDone,
    onError: () => opts.onDone?.(),
  });
}

export function stopSpeaking() {
  Speech.stop().catch(() => {});
}

export function setMuted(v: boolean) {
  muted = v;
  if (v) stopSpeaking();
}
