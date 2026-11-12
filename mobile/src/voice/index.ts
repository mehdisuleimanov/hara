import { useEffect } from 'react';
import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type RecordingOptions } from 'expo-audio';
import { useSharedValue, withRepeat, withSequence, withTiming, cancelAnimation, Easing, type SharedValue } from 'react-native-reanimated';
import { create } from 'zustand';
import { GEMINI_KEY, geminiTts } from '@/ai/gemini';
import { usePrefs } from '@/store/prefs';
import { log } from '@/utils/log';
import { CLIPS } from './clips.generated';
import { initDeviceVoice, speakDevice, stopDevice } from './device';
import { lineKey } from './key';
import { b64ToBytes, compressPauses, pcmToWav } from './wav';

/**
 * Əhməd's voice. Lookup order: bundled clip → cached WAV → live Gemini TTS → device TTS.
 * Every path ends in onDone, never throws, never shows an error.
 */
export type VoiceSource = 'clip' | 'cache' | 'gemini' | 'device';

type VoiceState = { speaking: boolean; source: VoiceSource | null; text: string | null };
const useVoiceStore = create<VoiceState>(() => ({ speaking: false, source: null, text: null }));

/** Mono 16 kHz AAC — what Gemini wants; 4× smaller uploads than the HIGH_QUALITY preset. */
export const VOICE_RECORDING: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  isMeteringEnabled: true,
  android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: { outputFormat: 'aac ', audioQuality: 96, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
  web: { mimeType: 'audio/webm', bitsPerSecond: 32000 },
} as RecordingOptions;

let player: AudioPlayer | null = null;
let sub: { remove: () => void } | null = null;
let seq = 0;
let pendingDone: (() => void) | undefined;

function finish(my: number) {
  if (my !== seq) return;
  useVoiceStore.setState({ speaking: false, source: null, text: null });
  const cb = pendingDone;
  pendingDone = undefined;
  cb?.();
}

export async function initVoice() {
  initDeviceVoice();
  try {
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, interruptionMode: 'duckOthers' } as never);
  } catch {}
}

export function hasClip(text: string) {
  return CLIPS[lineKey(text)] != null;
}

async function cacheFile(key: string) {
  if (Platform.OS === 'web') return null;
  const { Directory, File, Paths } = await import('expo-file-system');
  const dir = new Directory(Paths.cache, 'voice');
  if (!dir.exists) dir.create({ intermediates: true });
  return new File(dir, `${key}.wav`);
}

async function synth(text: string, timeoutMs: number) {
  const key = lineKey(text);
  const f = await cacheFile(key);
  if (!f) return null;
  if (f.exists) return f.uri;
  const { pcmB64, rate } = await geminiTts(text, { timeoutMs });
  const wav = pcmToWav(compressPauses(b64ToBytes(pcmB64), rate), rate);
  f.create({ overwrite: true });
  f.write(wav);
  return f.uri;
}

function play(source: number | string, my: number, src: VoiceSource, text: string, onStart?: () => void) {
  try {
    sub?.remove();
    sub = null;
    if (!player) player = createAudioPlayer(typeof source === 'string' ? { uri: source } : source);
    else player.replace(typeof source === 'string' ? { uri: source } : source);
    sub = player.addListener('playbackStatusUpdate', (s: { didJustFinish?: boolean }) => {
      if (s.didJustFinish) finish(my);
    });
    useVoiceStore.setState({ speaking: true, source: src, text });
    player.play();
    onStart?.();
    return true;
  } catch (e) {
    log('[voice] play failed', String(e));
    return false;
  }
}

export type SayOpts = {
  /** stop whatever is playing first (default true) */
  interrupt?: boolean;
  /** allow live Gemini TTS when no clip/cache (default true) */
  live?: boolean;
  /** how long to wait for live TTS before using the device voice (default 3500 ms) */
  maxWaitMs?: number;
  onStart?: () => void;
  onDone?: () => void;
};

export async function say(text: string, o: SayOpts = {}): Promise<void> {
  if (!text?.trim()) return o.onDone?.();
  if (usePrefs.getState().voiceMuted) return o.onDone?.();
  if (o.interrupt !== false) stop();
  const my = ++seq;
  pendingDone = o.onDone;
  const key = lineKey(text);

  const clip = CLIPS[key];
  if (clip != null && play(clip, my, 'clip', text, o.onStart)) return;

  try {
    const f = await cacheFile(key);
    if (my !== seq) return;
    if (f?.exists && play(f.uri, my, 'cache', text, o.onStart)) return;
  } catch {}

  if (o.live !== false && GEMINI_KEY) {
    try {
      const uri = await Promise.race([
        synth(text, o.maxWaitMs ?? 3500),
        new Promise<null>((r) => setTimeout(() => r(null), o.maxWaitMs ?? 3500)),
      ]);
      if (my !== seq) return;
      if (uri && play(uri, my, 'gemini', text, o.onStart)) return;
    } catch (e) {
      log('[voice] live tts failed', String(e));
    }
  }
  if (my !== seq) return;
  useVoiceStore.setState({ speaking: true, source: 'device', text });
  speakDevice(text, { onStart: o.onStart, onDone: () => finish(my) });
}

export function stop() {
  seq++;
  try {
    player?.pause();
  } catch {}
  stopDevice();
  useVoiceStore.setState({ speaking: false, source: null, text: null });
  pendingDone = undefined;
}

export function setMuted(v: boolean) {
  usePrefs.getState().setVoiceMuted(v);
  if (v) stop();
}

/** Warm the disk cache with live Gemini TTS (developer panel → "Səsləri hazırla"). */
export async function prefetch(lines: string[]): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  for (const l of lines) {
    if (hasClip(l)) {
      ok++;
      continue;
    }
    try {
      (await synth(l, 12000)) ? ok++ : failed++;
    } catch {
      failed++;
    }
  }
  return { ok, failed };
}

/**
 * Speaking state + a 0..1 "level" shared value for orbs/avatars (synthetic envelope while speaking).
 */
export function useVoice(): { speaking: boolean; source: VoiceSource | null; text: string | null; level: SharedValue<number> } {
  const st = useVoiceStore();
  const level = useSharedValue(0);
  useEffect(() => {
    if (st.speaking) {
      level.value = withRepeat(
        withSequence(
          withTiming(0.85, { duration: 140, easing: Easing.out(Easing.quad) }),
          withTiming(0.35, { duration: 120 }),
          withTiming(1, { duration: 160 }),
          withTiming(0.25, { duration: 180 }),
          withTiming(0.7, { duration: 130 }),
          withTiming(0.4, { duration: 150 }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(level);
      level.value = withTiming(0, { duration: 200 });
    }
  }, [st.speaking, level]);
  return { ...st, level };
}

export const voiceState = () => useVoiceStore.getState();
