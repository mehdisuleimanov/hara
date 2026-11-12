/**
 * Legacy shim → src/voice. Kept so older screens keep working; new code imports '@/voice'.
 */
import { initVoice, say, setMuted as setVoiceMuted, stop } from '@/voice';

export function initTts() {
  return initVoice();
}

export function speak(text: string, opts: { onDone?: () => void } = {}) {
  say(text, { onDone: opts.onDone });
}

export function stopSpeaking() {
  stop();
}

export function setMuted(v: boolean) {
  setVoiceMuted(v);
}
