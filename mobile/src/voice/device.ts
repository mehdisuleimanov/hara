import * as Speech from 'expo-speech';

/**
 * Device TTS fallback. Most phones have no Azerbaijani voice → Turkish voice with a light
 * transliteration. NOTE: Android's Locale.Builder needs a bare language subtag ('tr'), not 'tr-TR'.
 */
let voice: { id?: string; language: string; transliterate: boolean } = { language: 'tr', transliterate: true };
let ready: Promise<void> | null = null;

export function initDeviceVoice() {
  if (!ready) {
    ready = (async () => {
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        const az = voices.find((v) => v.language?.toLowerCase().startsWith('az'));
        if (az) {
          voice = { id: az.identifier, language: 'az', transliterate: false };
          return;
        }
        const tr = voices.filter((v) => v.language?.toLowerCase().startsWith('tr'));
        const best = tr.find((v) => String(v.quality).toLowerCase() === 'enhanced') ?? tr[0];
        voice = { id: best?.identifier, language: 'tr', transliterate: true };
      } catch {}
    })();
  }
  return ready;
}

export function forTurkish(text: string) {
  return text
    .replace(/₼/g, ' manat')
    .replace(/(\d)\s?dəq\b/g, '$1 dakika')
    .replace(/(\d)\s?m\b/g, '$1 metre')
    .replace(/(\d)\s?km\b/g, '$1 kilometre')
    .replace(/Ə/g, 'E')
    .replace(/ə/g, 'e')
    .replace(/X/g, 'H')
    .replace(/x/g, 'h')
    .replace(/Q/g, 'G')
    .replace(/q/g, 'g');
}

export async function speakDevice(text: string, cb: { onStart?: () => void; onDone?: () => void }) {
  await initDeviceVoice();
  Speech.stop().catch(() => {});
  Speech.speak(voice.transliterate ? forTurkish(text) : text, {
    language: voice.language,
    voice: voice.id,
    rate: 1.0,
    pitch: 1.0,
    onStart: cb.onStart,
    onDone: cb.onDone,
    onStopped: cb.onDone,
    onError: () => cb.onDone?.(),
  });
}

export function stopDevice() {
  Speech.stop().catch(() => {});
}
