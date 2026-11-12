import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { askAhmed } from '@/ai/ahmed';
import { DEMO_SENTENCE } from '@/ai/fallback';
import { useAppStore, isNightNow } from '@/store/useAppStore';
import type { AhmedResult } from '@/store/useAppStore';
import { Orb } from '@/components/Orb';
import { Waveform } from '@/components/Waveform';
import { Pulse } from '@/components/anim';
import { AhmedAvatar } from '@/components/Brand';
import { CircleButton, Icon, Txt, tap } from '@/components/ui';
import { speak, stopSpeaking } from '@/utils/tts';
import { C, F, R, shadow } from '@/theme';

type Phase = 'idle' | 'listening' | 'thinking' | 'answer';

const SUGGESTIONS = [
  'Gecədir, uşaq arabası ilə Hilton-a',
  'İçərişəhərə ən ucuz yol',
  'Tələsirəm, Gənclik Mall-a',
  'Skuterlə Port Baku-ya',
];

export default function Ahmed() {
  const params = useLocalSearchParams<{ mode?: string; demo?: string }>();
  const insets = useSafeAreaInsets();
  const aiEnabled = useAppStore((s) => s.aiEnabled);
  const timeMode = useAppStore((s) => s.timeMode);
  const setTimeMode = useAppStore((s) => s.setTimeMode);
  const setLastAhmed = useAppStore((s) => s.setLastAhmed);
  const setProfile = useAppStore((s) => s.setProfile);

  const [phase, setPhase] = useState<Phase>('idle');
  const [textMode, setTextMode] = useState(params.mode === 'text');
  const [input, setInput] = useState('');
  const [shown, setShown] = useState(''); // typed-out transcript
  const [answer, setAnswer] = useState<AhmedResult | null>(null);
  const busy = useRef(false);

  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const rec = useAudioRecorderState(recorder, 80);
  const level = rec.isRecording && rec.metering != null ? Math.max(0, Math.min(1, (rec.metering + 55) / 50)) : 0;
  const secs = Math.floor((rec.durationMillis ?? 0) / 1000);

  // typewriter effect for the transcript
  const typeOut = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      let i = 0;
      const id = setInterval(() => {
        i += 2;
        setShown(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(id);
          resolve();
        }
      }, 28);
    });
  }, []);

  const finish = useCallback(
    async (result: AhmedResult) => {
      setAnswer(result);
      setLastAhmed(result);
      if (result.timeOfDay) setTimeMode(result.timeOfDay);
      setProfile(result.profile === 'family' ? 'daily' : result.profile);
      await typeOut(result.transcript);
      setPhase('answer');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (result.profile === 'scooter') {
        setTimeout(() => router.replace('/scooter?speak=1'), 900);
      } else if (result.destId) {
        setTimeout(() => router.replace(`/results/${result.destId}?kind=${result.preference}&speak=1`), 900);
      } else {
        speak(result.reply);
      }
    },
    [setLastAhmed, setTimeMode, setProfile, typeOut],
  );

  const run = useCallback(
    async (payload: { text?: string; audioB64?: string; mime?: string }) => {
      if (busy.current) return;
      busy.current = true;
      setPhase('thinking');
      setShown('');
      try {
        const night = isNightNow(timeMode);
        const result = await askAhmed(payload, { aiEnabled, night });
        await finish(result);
      } finally {
        busy.current = false;
      }
    },
    [aiEnabled, timeMode, finish],
  );

  const runDemo = useCallback(() => {
    tap(Haptics.ImpactFeedbackStyle.Heavy);
    run({ text: DEMO_SENTENCE });
  }, [run]);

  useEffect(() => {
    if (params.demo === '1') {
      const t = setTimeout(runDemo, 500);
      return () => clearTimeout(t);
    }
  }, [params.demo, runDemo]);

  useEffect(() => () => stopSpeaking(), []);

  const startListening = async () => {
    stopSpeaking();
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setTextMode(true);
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setAnswer(null);
      setShown('');
      setPhase('listening');
      tap(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      console.warn('record failed', e);
      runDemo();
    }
  };

  const stopAndSend = async () => {
    if (phase !== 'listening') return;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      if (!uri || (rec.durationMillis ?? 0) < 600) {
        // too short / nothing captured -> scripted demo sentence
        run({ text: DEMO_SENTENCE });
        return;
      }
      const b64 = await new File(uri).base64();
      run({ audioB64: b64, mime: 'audio/m4a' });
    } catch (e) {
      console.warn('stop failed', e);
      run({ text: DEMO_SENTENCE });
    }
  };

  const cancel = async () => {
    if (phase === 'listening') {
      try {
        await recorder.stop();
      } catch {}
    }
    setPhase('idle');
    setShown('');
    setAnswer(null);
  };

  const status =
    phase === 'listening' ? 'Dinləyirəm…' : phase === 'thinking' ? 'Fikirləşirəm…' : phase === 'answer' ? 'Hazırdır' : 'Əhməd hazırdır';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#EAF2FF', '#FFFFFF', '#E6F7EE']} style={StyleSheet.absoluteFill} />
      <View style={[styles.blob, { top: 60, left: -80, backgroundColor: 'rgba(18,183,106,0.25)' }]} />
      <View style={[styles.blob, { bottom: 140, right: -90, backgroundColor: 'rgba(15,27,45,0.05)' }]} />

      <View style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) }}>
        {/* header */}
        <View style={styles.header}>
          <CircleButton icon="chevron-left" size={50} onPress={() => router.back()} style={shadow(1)} />
          <Txt w="bold" size={17}>
            Əhməd
          </Txt>
          <CircleButton
            icon={textMode ? 'microphone-outline' : 'keyboard-outline'}
            size={50}
            onPress={() => setTextMode((v) => !v)}
            style={shadow(1)}
          />
        </View>

        <ScrollView contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 24 }} keyboardShouldPersistTaps="handled">
          <Txt w="semi" size={15} color={phase === 'listening' ? C.ink : C.muted} style={{ marginTop: 18 }}>
            {status}
          </Txt>

          <Pressable onLongPress={runDemo} delayLongPress={700} style={{ marginTop: 10 }}>
            <Orb size={250} level={level} active={phase === 'listening' || phase === 'thinking'} />
            <View style={styles.ahmedBadge}>
              <AhmedAvatar size={34} mood={phase === 'answer' ? 'talk' : 'smile'} />
            </View>
          </Pressable>

          {/* big two-tone text */}
          <View style={{ minHeight: 120, marginTop: 6, justifyContent: 'center' }}>
            {shown ? (
              <Txt w="bold" size={25} lh={32} center>
                “{shown}”
              </Txt>
            ) : phase === 'thinking' ? (
              <Txt w="bold" size={25} lh={32} center color={C.faint}>
                Marşrutları yoxlayıram…
              </Txt>
            ) : (
              <Txt w="bold" size={25} lh={32} center>
                <Txt w="bold" size={25} color={C.faint}>
                  Hara getmək istədiyini{' '}
                </Txt>
                səslə de, mən ən az riskli yolu tapım
              </Txt>
            )}
          </View>

          {answer && phase === 'answer' ? (
            <View style={styles.replyCard}>
              <Icon name="creation" size={18} color={C.navy} />
              <Txt w="med" size={14.5} color={C.ink2} lh={20} style={{ flex: 1 }}>
                {answer.reply}
              </Txt>
            </View>
          ) : null}

          {phase === 'idle' ? (
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} onPress={() => run({ text: s })} style={styles.suggestion}>
                  <Txt w="semi" size={13.5}>
                    {s}
                  </Txt>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>

        {/* controls */}
        {textMode ? (
          <View style={styles.inputRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Məs: Gecə Hilton-a necə gedim?"
              placeholderTextColor={C.faint}
              style={styles.input}
              returnKeyType="send"
              onSubmitEditing={() => input.trim() && run({ text: input.trim() })}
              autoFocus={params.mode === 'text'}
            />
            <CircleButton
              icon="arrow-up"
              size={52}
              bg={C.brand}
              color={C.navy}
              onPress={() => input.trim() && run({ text: input.trim() })}
            />
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: 14 }}>
            <Waveform level={level} active={phase === 'listening'} color={C.ink} />
            <Pressable
              onPress={() => (phase === 'listening' ? stopAndSend() : phase === 'thinking' ? null : startListening())}
              style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.95 : 1 }] }]}
            >
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              {phase === 'listening' ? <Pulse size={84} color={C.brand} duration={1300} /> : null}
              <LinearGradient colors={['#7FE0B0', C.brand, '#1F6FEB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mic}>
                <Icon name={phase === 'listening' ? 'stop' : 'microphone'} size={34} color={C.navy} />
              </LinearGradient>
              </View>
            </Pressable>
            <View style={styles.controls}>
              <CircleButton icon="close" size={54} onPress={cancel} style={shadow(1)} />
              <Txt w="semi" size={16} color={C.ink2} style={{ fontFamily: F.semi, width: 70, textAlign: 'center' }}>
                00:{String(Math.min(secs, 59)).padStart(2, '0')}
              </Txt>
              <CircleButton icon="check" size={54} onPress={stopAndSend} style={shadow(1)} />
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  blob: { position: 'absolute', width: 260, height: 260, borderRadius: 130 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  ahmedBadge: {
    position: 'absolute',
    bottom: 6,
    right: 18,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(2),
  },
  replyCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: C.surface,
    borderRadius: R.md,
    padding: 14,
    marginTop: 4,
    ...shadow(1),
  },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 },
  suggestion: { backgroundColor: C.surface, borderRadius: R.pill, paddingHorizontal: 14, height: 38, justifyContent: 'center', ...shadow(1) },
  mic: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', ...shadow(3) },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  input: {
    flex: 1,
    height: 56,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    paddingHorizontal: 20,
    fontFamily: F.med,
    fontSize: 16,
    color: C.ink,
    ...shadow(1),
  },
});
