import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { AudioModule, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { askAhmed, AHMED_SAY, DEMO_SENTENCE, speakable } from '@/ai/ahmed';
import { useAppStore, useIsNight, type AhmedResult } from '@/store/useAppStore';
import { usePrefs } from '@/store/prefs';
import { useAhmedSession } from '@/store/ahmedSession';
import { destById } from '@/data/destinations';
import { optionOf } from '@/data/routes';
import { crossingsNearTrack } from '@/data/layer';
import { liveRouteById } from '@/features/routing/live';
import { ThinkingTrace } from '@/features/ahmed/ThinkingTrace';
import { ChipRow, HandoffCard, ListeningMeter, MicButton, ReplyBubble, StageTrigger, TalkingAvatar, type Suggestion } from '@/features/ahmed/parts';
import { Orb, type OrbState } from '@/components/Orb';
import { CircleButton, Icon, Txt } from '@/components/ui';
import { PressableScale, SPRING, enter, useTypewriter } from '@/motion';
import { say, stop, useVoice, VOICE_RECORDING } from '@/voice';
import { COMMON } from '@/voice/lines/common';
import { getWeather } from '@/utils/weather';
import { log } from '@/utils/log';
import { useTheme } from '@/hooks/useTheme';
import { C, F, R, shadow } from '@/theme';

type Phase = 'idle' | 'listening' | 'thinking' | 'answer';

const MIN_THINK_MS = 1200;
const AUDIO_MIME = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function readBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result).split(',')[1] ?? '');
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  }
  const { File } = await import('expo-file-system');
  return await new File(uri).base64();
}

export default function AhmedScreen() {
  const params = useLocalSearchParams<{ mode?: string; demo?: string; q?: string }>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const t = useTheme();
  const night = useIsNight();
  const aiEnabled = useAppStore((s) => s.aiEnabled);
  const setLastAhmed = useAppStore((s) => s.setLastAhmed);
  const setTimeMode = useAppStore((s) => s.setTimeMode);
  const setProfile = useAppStore((s) => s.setProfile);
  const steps = useAhmedSession((s) => s.steps);

  const [phase, setPhaseState] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');
  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };
  const [textMode, setTextMode] = useState(params.mode === 'text');
  const [input, setInput] = useState('');
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<AhmedResult | null>(null);
  const [handoffMs, setHandoffMs] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const busy = useRef(false);
  const leaving = useRef(false);
  const handoffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recStart = useRef(0);
  const scrollRef = useRef<ScrollViewInstance>(null);

  const recorder = useAudioRecorder(VOICE_RECORDING);
  const voice = useVoice();
  const orbLevel = useSharedValue(0);
  const speakingSV = useSharedValue(0);
  useEffect(() => {
    speakingSV.value = voice.speaking ? 1 : 0;
    if (!voice.speaking && phaseRef.current !== 'listening') orbLevel.value = 0;
  }, [voice.speaking, speakingSV, orbLevel]);
  useAnimatedReaction(
    () => voice.level.value,
    (v) => {
      if (speakingSV.value) orbLevel.value = v;
    },
  );

  const [typed] = useTypewriter(transcript, 55);

  // ---------- lifecycle ----------
  useEffect(() => {
    // warm the weather cache + spatial index while Əhməd is idle (tools answer instantly later)
    getWeather().catch(() => {});
    const id = setTimeout(() => {
      try {
        crossingsNearTrack([], 0);
      } catch {}
    }, 900);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (params.demo === '1' || params.q) return;
    const s = useAhmedSession.getState();
    if (s.greeted) return;
    const id = setTimeout(() => {
      if (phaseRef.current !== 'idle' || busy.current) return;
      useAhmedSession.getState().markGreeted();
      say(night ? COMMON.greetNight : COMMON.greet);
    }, 650);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (handoffTimer.current) clearTimeout(handoffTimer.current);
      if (!leaving.current) stop();
      try {
        if (recorder.isRecording) recorder.stop();
      } catch {}
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ---------- navigation ----------
  const routeHref = (r: AhmedResult) => {
    if (r.liveRouteId) return `/results/live:${r.liveRouteId}?from=ahmed&speak=0`;
    if (r.profile === 'scooter') return '/scooter';
    return `/results/${r.destId}?kind=${r.preference}&from=ahmed&speak=0`;
  };

  const openRoute = useCallback((r: AhmedResult) => {
    if (leaving.current) return;
    leaving.current = true;
    if (handoffTimer.current) clearTimeout(handoffTimer.current);
    router.replace(routeHref(r) as never);
  }, []);

  const scheduleOpen = (r: AhmedResult, ms: number) => {
    if (leaving.current) return;
    if (handoffTimer.current) clearTimeout(handoffTimer.current);
    handoffTimer.current = setTimeout(() => openRoute(r), ms);
    setHandoffMs(ms);
  };

  // ---------- the run ----------
  const finish = (r: AhmedResult) => {
    const steps = useAhmedSession.getState().steps;
    const full: AhmedResult = { ...r, steps };
    setResult(full);
    setTranscript(r.transcript || transcriptRef.current);
    if (r.intent !== 'unclear') setLastAhmed(full);
    if (r.timeOfDay) setTimeMode(r.timeOfDay);
    if (r.intent === 'route') setProfile(r.profile === 'family' ? 'daily' : r.profile);
    if (r.transcript && r.reply) useAhmedSession.getState().remember(r.transcript, r.reply);
    setPhase('answer');
    Haptics.notificationAsync(r.intent === 'unclear' ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success).catch(() => {});
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);

    const navigates = r.intent === 'route' && (!!r.liveRouteId || (!!r.destId && !!destById(r.destId)));
    if (navigates) {
      // open the cards while Əhməd keeps talking; never wait forever for the voice
      scheduleOpen(r, 7000);
      let started = false;
      say(speakable(r.reply), {
        maxWaitMs: 6000,
        onStart: () => {
          started = true;
          scheduleOpen(r, 2600);
        },
        onDone: () => {
          if (!started) scheduleOpen(r, 2200);
        },
      });
    } else {
      say(speakable(r.reply), { maxWaitMs: 6000 });
    }
  };

  const transcriptRef = useRef('');
  const run = async (payload: { text?: string; audioB64?: string; mime?: string }, opts: { asVoice?: boolean } = {}) => {
    if (busy.current) return;
    busy.current = true;
    stop();
    Keyboard.dismiss();
    leaving.current = false;
    if (handoffTimer.current) clearTimeout(handoffTimer.current);
    setHandoffMs(null);
    setHint(null);
    setResult(null);
    useAhmedSession.getState().resetSteps();
    const typedText = payload.text && !opts.asVoice ? payload.text : '';
    transcriptRef.current = typedText;
    setTranscript(typedText);
    setPhase('thinking');
    const started = Date.now();
    let r: AhmedResult;
    try {
      r = await askAhmed(payload, {
        aiEnabled,
        night,
        asVoice: opts.asVoice,
        history: useAhmedSession.getState().history,
        onStep: (op) => useAhmedSession.getState().push(op),
        onTranscript: (tx) => {
          transcriptRef.current = tx;
          setTranscript(tx);
        },
      });
    } catch (e) {
      log('[Əhməd] unexpected', String(e));
      r = { transcript: typedText, destId: null, timeOfDay: null, profile: 'daily', preference: 'safest', companions: [], reply: COMMON.didntHear, source: 'fallback', intent: 'unclear' };
    }
    // stage safety: a failed recording runs the prepared sentence (only when enabled in the hidden panel)
    if (payload.audioB64 && r.intent === 'unclear' && r.error && usePrefs.getState().stageFallback) {
      busy.current = false;
      return run({ text: DEMO_SENTENCE }, { asVoice: true });
    }
    await useAhmedSession.getState().settled();
    const left = MIN_THINK_MS - (Date.now() - started);
    if (left > 0) await wait(left);
    busy.current = false;
    finish(r);
  };

  const runDemo = useCallback(() => {
    run({ text: DEMO_SENTENCE }, { asVoice: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (params.demo === '1') {
      const id = setTimeout(runDemo, 600);
      return () => clearTimeout(id);
    }
    if (params.q) {
      const id = setTimeout(() => run({ text: String(params.q) }), 400);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.demo, params.q]);

  // ---------- voice capture ----------
  const startListening = async () => {
    if (busy.current) return;
    stop();
    if (handoffTimer.current) clearTimeout(handoffTimer.current);
    setHandoffMs(null);
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setTextMode(true);
        setHint(AHMED_SAY.noMic);
        say(AHMED_SAY.noMic);
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recStart.current = Date.now();
      setResult(null);
      setHint(null);
      useAhmedSession.getState().resetSteps();
      setTranscript('');
      setPhase('listening');
    } catch (e) {
      log('[Əhməd] record start failed', String(e));
      setTextMode(true);
      setHint('Hazırda mikrofon açılmadı. Yazaraq soruş, dərhal cavab verim.');
    }
  };

  const stopRecorder = async () => {
    try {
      await recorder.stop();
    } catch {}
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {}
  };

  const sendRecording = async () => {
    if (phaseRef.current !== 'listening') return;
    const dur = Date.now() - recStart.current;
    await stopRecorder();
    orbLevel.value = withSpring(0, SPRING.gentle);
    const uri = recorder.uri;
    if (!uri || dur < 600) {
      setPhase('idle');
      setHint(COMMON.tooShort);
      say(COMMON.tooShort);
      return;
    }
    try {
      const b64 = await readBase64(uri);
      if (!b64) throw new Error('empty recording');
      run({ audioB64: b64, mime: AUDIO_MIME });
    } catch (e) {
      log('[Əhməd] read recording failed', String(e));
      if (usePrefs.getState().stageFallback) return runDemo();
      setPhase('idle');
      setHint(COMMON.didntHear);
      say(COMMON.didntHear);
    }
  };

  const cancel = async () => {
    if (phaseRef.current === 'listening') await stopRecorder();
    orbLevel.value = withSpring(0, SPRING.gentle);
    stop();
    if (handoffTimer.current) clearTimeout(handoffTimer.current);
    setHandoffMs(null);
    useAhmedSession.getState().resetSteps();
    setResult(null);
    setTranscript('');
    setHint(null);
    setPhase('idle');
  };

  const close = () => {
    stop();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const submitText = () => {
    const q = input.trim();
    if (!q) return;
    setInput('');
    run({ text: q });
  };

  // ---------- derived UI ----------
  const orbState: OrbState = phase === 'listening' ? 'listening' : phase === 'thinking' ? 'thinking' : voice.speaking ? 'speaking' : 'idle';
  const compact = phase === 'thinking' || phase === 'answer';
  const orbSize = Math.min(width * 0.64, height * 0.34, 280);
  const orbBox = useSharedValue(1);
  useEffect(() => {
    orbBox.value = withSpring(compact ? 0 : 1, SPRING.gentle);
  }, [compact, orbBox]);
  const smallOrb = 112;
  const orbWrap = useAnimatedStyle(() => ({ height: smallOrb + (orbSize - smallOrb) * orbBox.value + 8 }));
  const orbInner = useAnimatedStyle(() => {
    const h = smallOrb + (orbSize - smallOrb) * orbBox.value;
    return { transform: [{ translateY: h / 2 - orbSize / 2 }, { scale: h / orbSize }] };
  });

  const status =
    phase === 'listening' ? 'Dinləyir' : phase === 'thinking' ? 'Düşünür' : voice.speaking ? 'Danışır' : 'Hazırdır';
  const statusColor = phase === 'listening' ? C.danger : phase === 'thinking' ? C.ai : C.brand;

  const suggestions: Suggestion[] = useMemo(
    () => [
      { label: 'Gecə Hilton-a, uşaq arabası ilə', icon: 'weather-night', onPress: () => run({ text: 'Gecədir, uşaq arabası ilə Hilton-a getmək istəyirəm' }) },
      { label: 'İçərişəhərə ən ucuz yol', icon: 'cash', onPress: () => run({ text: 'İçərişəhərə ən ucuz yol' }) },
      { label: 'Tələsirəm, Gənclik Mall-a', icon: 'lightning-bolt-outline', onPress: () => run({ text: 'Tələsirəm, Gənclik Mall-a' }) },
      { label: 'Nizami ətrafı gecə necədir?', icon: 'shield-half-full', onPress: () => run({ text: 'Gecə Nizami metrosu ətrafı təhlükəsizdir?' }) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aiEnabled, night],
  );

  const followUps: Suggestion[] = useMemo(() => {
    if (!result) return [];
    const out: Suggestion[] = [];
    if (result.intent === 'question') {
      const d = result.destId ? destById(result.destId) : null;
      if (d) out.push({ label: `${d.short} — marşrut`, icon: 'map-marker-path', onPress: () => openRoute({ ...result, intent: 'route' }) });
      const tx = result.transcript.replace(/\?+$/, '');
      if (/gecə/i.test(tx)) out.push({ label: 'Bəs gündüz?', icon: 'white-balance-sunny', onPress: () => run({ text: `${tx.replace(/gecə/gi, 'gündüz')}?` }) });
      else out.push({ label: 'Bəs gecə?', icon: 'weather-night', onPress: () => run({ text: `Gecə ${tx.charAt(0).toLowerCase()}${tx.slice(1)}?` }) });
      out.push({ label: 'Yeni sual', icon: 'plus', onPress: cancel });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const routeCard = useMemo(() => {
    if (!result || result.intent !== 'route') return null;
    if (result.liveRouteId) {
      const lr = liveRouteById(result.liveRouteId);
      return { title: lr?.place.name ?? 'Marşrut hazırdır', sub: 'Ən az riskli variant seçildi' };
    }
    const d = result.destId ? destById(result.destId) : null;
    if (!d) return null;
    const o = optionOf(d.id, result.preference) ?? optionOf(d.id, 'safest');
    const kind = result.preference === 'cheapest' ? 'Ən sərfəli' : result.preference === 'fastest' ? 'Ən sürətli' : 'Ən az riskli';
    return { title: d.name, sub: o ? `${kind} · ${o.durationMin} dəq · ${o.price}` : kind };
  }, [result]);

  const showDock = phase === 'idle' || phase === 'listening' || phase === 'answer';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#EEF5FF', '#FFFFFF', '#FFFFFF']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />

      <View style={{ flex: 1, paddingTop: insets.top + 6 }}>
        {/* header */}
        <Animated.View entering={enter(0, 'down')} style={styles.header}>
          <CircleButton icon="chevron-down" size={46} onPress={close} label="Bağla" style={shadow(1)} bg="#FFFFFF" />
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Txt v="label" color={C.ink}>
              Əhməd
            </Txt>
            <Txt v="label" color={C.muted}>
              · {status}
            </Txt>
          </View>
          <CircleButton
            icon={textMode ? 'microphone-outline' : 'keyboard-outline'}
            size={46}
            bg="#FFFFFF"
            style={shadow(1)}
            onPress={() => {
              if (phase === 'listening') cancel();
              setTextMode((v) => !v);
            }}
          />
        </Animated.View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 20, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* orb + Əhməd */}
          <Animated.View style={[{ width: orbSize, alignItems: 'center', justifyContent: 'flex-start', marginTop: 6 }, orbWrap]}>
            <Animated.View style={[{ width: orbSize, height: orbSize }, orbInner]}>
              <Orb size={orbSize} level={orbLevel} state={orbState} />
              <StageTrigger onFire={runDemo} style={[styles.badge, { right: orbSize * 0.04, bottom: orbSize * 0.04 }]}>
                <TalkingAvatar size={38} level={voice.level} speaking={voice.speaking} />
              </StageTrigger>
            </Animated.View>
          </Animated.View>

          {phase === 'idle' ? (
            <View style={{ alignItems: 'center', alignSelf: 'stretch' }}>
              <Animated.View entering={enter(1, 'up')}>
                <Txt v="h1" center color={C.ink} accessibilityRole="header" style={{ marginTop: 6 }}>
                  Hara gedirsən?
                </Txt>
              </Animated.View>
              <Animated.View entering={enter(2, 'up')}>
                <Txt v="body" center color={C.muted} style={{ marginTop: 8, maxWidth: 300 }}>
                  {hint ?? 'Səslə de və ya yaz,\nən az riskli yolu mən tapım.'}
                </Txt>
              </Animated.View>
              {!textMode || !t.simple ? (
                <View style={{ marginTop: 20 }}>
                  <ChipRow items={suggestions} base={160} />
                </View>
              ) : null}
            </View>
          ) : null}

          {phase === 'listening' ? (
            <Animated.View entering={FadeIn.duration(200)} style={{ alignItems: 'center' }}>
              <Txt v="h1" center color={C.ink} style={{ marginTop: 6 }}>
                Dinləyirəm…
              </Txt>
              <Txt v="body" center color={C.muted} style={{ marginTop: 8, maxWidth: 300 }}>
                Məsələn: “Gecə Hilton-a necə gedim?”
              </Txt>
            </Animated.View>
          ) : null}

          {compact ? (
            <View style={{ alignSelf: 'stretch', gap: 14, marginTop: 4 }}>
              {transcript ? (
                <Animated.View entering={FadeIn.duration(180)} style={styles.youRow}>
                  <Txt v="overline" color={C.muted}>
                    Sən
                  </Txt>
                  <Txt v="h3" color={C.ink} lh={25} style={{ marginTop: 3 }}>
                    “{typed}
                    {typed.length >= transcript.length ? '”' : ''}
                  </Txt>
                </Animated.View>
              ) : null}

              <ThinkingTrace
                steps={steps}
                done={phase === 'answer'}
                composing={
                  phase !== 'thinking' || !steps.length || steps.some((s) => s.state === 'run')
                    ? null
                    : steps.length === 1
                      ? steps[0].state === 'done'
                        ? 'Nəyi yoxlayacağımı seçirəm…'
                        : null
                      : 'Cavabı hazırlayıram…'
                }
              />

              {phase === 'answer' && result ? (
                <>
                  <ReplyBubble text={result.reply} level={voice.level} speaking={voice.speaking} />
                  {routeCard && !leaving.current ? (
                    <HandoffCard title={routeCard.title} sub={routeCard.sub} ms={handoffMs ?? 7000} onOpen={() => openRoute(result)} />
                  ) : null}
                  {followUps.length ? <ChipRow items={followUps} base={200} /> : null}
                  {result.intent === 'unclear' || (result.intent === 'route' && !routeCard) ? <ChipRow items={suggestions.slice(0, 3)} base={200} /> : null}
                </>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        {/* dock */}
        {textMode ? (
          <Animated.View entering={enter(0, 'up')} style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Məs: Gecə Hilton-a necə gedim?"
              placeholderTextColor={C.faint}
              style={[styles.input, { fontSize: t.font(16) }]}
              returnKeyType="send"
              onSubmitEditing={submitText}
              autoFocus={params.mode === 'text'}
              editable={phase !== 'thinking'}
              accessibilityLabel="Əhmədə yaz"
            />
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Göndər"
              haptic="medium"
              onPress={submitText}
              disabled={!input.trim() || phase === 'thinking'}
              style={[styles.send, { opacity: input.trim() && phase !== 'thinking' ? 1 : 0.45 }]}
            >
              <Icon name="arrow-up" size={24} color="#FFFFFF" />
            </PressableScale>
          </Animated.View>
        ) : showDock ? (
          <Animated.View entering={enter(1, 'up')} exiting={FadeOut.duration(120)} style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            {phase === 'listening' ? <ListeningMeter recorder={recorder} level={orbLevel} onLimit={sendRecording} /> : null}
            <View style={styles.dockRow}>
              <View style={styles.side}>
                {phase === 'listening' ? <CircleButton icon="close" size={52} onPress={cancel} label="Ləğv et" bg="#FFFFFF" style={shadow(1)} /> : null}
              </View>
              <MicButton listening={phase === 'listening'} onPress={phase === 'listening' ? sendRecording : startListening} />
              <View style={styles.side} />
            </View>
            <Txt v="caption" color={C.muted} center>
              {phase === 'listening' ? 'Bitirəndə toxun' : phase === 'answer' ? 'Yenə soruş' : 'Toxun və danış'}
            </Txt>
          </Animated.View>
        ) : (
          <View style={{ height: Math.max(insets.bottom, 14) + 8 }} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: R.pill,
    backgroundColor: '#FFFFFF',
    ...shadow(1),
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  badge: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(2),
  },
  youRow: { alignSelf: 'stretch', paddingHorizontal: 4 },
  dock: { alignItems: 'center', gap: 2, paddingTop: 6 },
  dockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  side: { width: 60, alignItems: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 8 },
  input: {
    flex: 1,
    minWidth: 0,
    height: 54,
    borderRadius: R.pill,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    fontFamily: F.med,
    color: C.ink,
    borderWidth: 1,
    borderColor: C.line,
    ...shadow(1),
  },
  send: { width: 54, height: 54, borderRadius: 27, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', ...shadow(2) },
});
