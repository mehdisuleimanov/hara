import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AudioModule, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/hooks/useTheme';
import { REPORT_META } from '@/data/reports-seed';
import type { ReportCategory } from '@/data/types';
import { ROUTES } from '@/data/routes';
import { geminiJson } from '@/ai/gemini';
import { log } from '@/utils/log';
import { AhmedAvatar } from '@/components/Brand';
import { Orb } from '@/components/Orb';
import { Burst, Pop, SlideUp } from '@/components/anim';
import { Icon, PillButton, Txt, tap } from '@/components/ui';
import { useTabBarSpace } from '@/components/TabBar';
import { AnimatedNumber, PressableScale, enter } from '@/motion';
import { say, VOICE_RECORDING } from '@/voice';
import { A11Y } from '@/voice/lines/a11y';
import { TopFade } from '@/features/home/TopFade';
import { distM, nearbyReports } from '@/features/home/context';
import { C, C_HC, R, shadow } from '@/theme';
import { upperAz } from '@/features/a11y/text';

const CATS = Object.keys(REPORT_META) as ReportCategory[];

type Flow =
  | { phase: 'checking'; transcript?: string }
  | { phase: 'pick'; transcript?: string }
  | { phase: 'done'; category: ReportCategory; transcript?: string; confidence?: number; merged: number }
  | null;

function ago(min: number) {
  if (min < 1) return 'indicə';
  if (min < 60) return `${min} dəq əvvəl`;
  const h = Math.floor(min / 60);
  return `${h} saat əvvəl`;
}

export default function Report() {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const t = useTheme();
  const addReport = useAppStore((s) => s.addReport);
  const addPoints = useAppStore((s) => s.addPoints);
  const showToast = useAppStore((s) => s.showToast);
  const aiEnabled = useAppStore((s) => s.aiEnabled);
  const reports = useAppStore((s) => s.reports);
  const points = useAppStore((s) => s.points);
  const [flow, setFlow] = useState<Flow>(null);
  const [listening, setListening] = useState(false);
  const recorder = useAudioRecorder(VOICE_RECORDING);
  const rec = useAudioRecorderState(recorder, 100);
  const level = rec.isRecording && rec.metering != null ? Math.max(0, Math.min(1, (rec.metering + 55) / 50)) : 0;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nearby = useMemo(() => nearbyReports(reports, 2500).sort((a, b) => a.minutesAgo - b.minutesAgo).slice(0, 3), [reports]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const submit = (category: ReportCategory, transcript?: string, confidence?: number) => {
    setFlow({ phase: 'checking', transcript });
    const lat = ROUTES.origin.lat + (Math.random() - 0.5) * 0.002;
    const lon = ROUTES.origin.lon + (Math.random() - 0.5) * 0.002;
    // real de-duplication against what is already on the map
    const merged = useAppStore.getState().reports.filter((r) => r.category === category && distM(lat, lon, r.lat, r.lon) < 1500).length;
    timer.current = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setFlow({ phase: 'done', category, transcript, confidence, merged });
      addReport({
        id: 'u' + Date.now(),
        category,
        lat,
        lon,
        minutesAgo: 0,
        aiConfidence: confidence ?? 90,
        count: 1,
        mine: true,
      });
      addPoints(10, 'Şəhər qəhrəmanı');
      say(A11Y.reportThanks);
    }, 1500);
  };

  const startVoice = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        showToast('Səsli bildiriş üçün mikrofona icazə ver', 'microphone-off');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setListening(true);
      tap(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      log('[Bildir] mic start', String(e));
      setFlow({ phase: 'pick' });
    }
  };

  const stopVoice = async () => {
    setListening(false);
    tap(Haptics.ImpactFeedbackStyle.Medium);
    let transcript: string | undefined;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (aiEnabled && recorder.uri && (rec.durationMillis ?? 0) > 600) {
        setFlow({ phase: 'checking' });
        const b64 = await new File(recorder.uri).base64();
        const r = await geminiJson<{ transcript: string; category: ReportCategory; confidence?: number }>({
          system:
            'You classify short Azerbaijani voice reports about street hazards in Baku. Categories: dark (unlit street / broken street light), car (car parked on sidewalk), lift (elevator/escalator not working), crossing (dangerous pedestrian crossing / no traffic light), sidewalk (no sidewalk / broken sidewalk), speed (speeding cars). Return the transcript in Azerbaijani Latin script, the best category and your confidence 0-100.',
          parts: [{ inlineData: { mimeType: 'audio/m4a', data: b64 } }, { text: 'Bu bildirişi təsnif et.' }],
          schema: {
            type: 'OBJECT',
            properties: {
              transcript: { type: 'STRING' },
              category: { type: 'STRING', enum: CATS },
              confidence: { type: 'INTEGER' },
            },
            required: ['transcript', 'category'],
          },
          timeoutMs: 9000,
        });
        transcript = r.transcript?.trim() || undefined;
        if (CATS.includes(r.category)) {
          const conf = typeof r.confidence === 'number' ? Math.max(55, Math.min(99, Math.round(r.confidence))) : undefined;
          submit(r.category, transcript, conf);
          return;
        }
      }
    } catch (e) {
      log('[Bildir] voice classify', String(e));
    }
    // could not classify on-device → let the person pick, never invent a category
    setFlow({ phase: 'pick', transcript });
    say(A11Y.reportPick);
  };

  const border = t.hc ? { borderWidth: 2, borderColor: C_HC.line } : null;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: tabSpace + 12 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={enter(0)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Txt v="overline" color={C.muted} style={{ flex: 1 }}>
              {upperAz('Bildir · şəhəri birlikdə qoruyaq')}
            </Txt>
            <View style={styles.points}>
              <Icon name="star-four-points" size={15} color={C.brandDark} />
              <Txt w="bold" size={13} color={C.brandDark}>
                +10 xal
              </Txt>
            </View>
          </View>
          <Txt v="hero" style={{ marginTop: 6 }} accessibilityRole="header">
            Nə görürsən?
          </Txt>
        </Animated.View>
        <Animated.View entering={enter(1)}>
          <Txt w="med" size={15} color={C.ink2} style={{ marginTop: 8 }}>
            Bir toxunuşla bildir. Əhməd yoxlayır, oxşarları birləşdirir və yoldan keçənlərə xəbər verir.
          </Txt>
        </Animated.View>

        {/* camera */}
        <Animated.View entering={enter(2)}>
          <PressableScale haptic="medium" scaleTo={0.98} accessibilityRole="button" accessibilityLabel="Kamera ilə bildir" onPress={() => router.push('/scan')} style={[styles.camera, border, !t.hc && shadow(2)]}>
            <View style={styles.camDisc}>
              <Icon name="cube-scan" size={28} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Txt w="xbold" size={17} color="#FFFFFF">
                Kamera ilə bildir
              </Txt>
              <Txt w="med" size={13} color="rgba(255,255,255,0.75)">
                AI Göz keçidi özü tanıyır və riskini ölçür
              </Txt>
            </View>
            <View style={styles.camArrow}>
              <Icon name="arrow-top-right" size={20} color={C.navy} />
            </View>
          </PressableScale>
        </Animated.View>

        {/* categories */}
        <View style={styles.grid}>
          {CATS.map((c, i) => {
            const m = REPORT_META[c];
            const danger = m.tone === 'danger';
            return (
              <Animated.View key={c} entering={enter(3 + i, 'pop')} style={{ width: t.simple ? '47%' : '31%', flexGrow: 1 }}>
                <PressableScale haptic="medium" accessibilityRole="button" accessibilityLabel={m.title} onPress={() => submit(c)} style={[styles.cat, { minHeight: t.hit + 70 }, border]}>
                  <View style={[styles.catIcon, { backgroundColor: danger ? C.dangerSoft : C.warnSoft }]}>
                    <Icon name={m.icon} size={28} color={danger ? C.danger : C.warn} />
                  </View>
                  <Txt w="bold" size={14} center numberOfLines={2}>
                    {m.title}
                  </Txt>
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>

        {/* voice */}
        <Animated.View entering={enter(9)} style={[styles.voice, border]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.ahmed}>
              <AhmedAvatar size={40} mood={listening ? 'talk' : 'smile'} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt w="bold" size={15.5}>
                {listening ? 'Dinləyirəm…' : 'Və ya Əhmədə de'}
              </Txt>
              <Txt w="med" size={13} color={C.muted}>
                {listening ? `${Math.floor((rec.durationMillis ?? 0) / 1000)} san · bitirmək üçün toxun` : '«Bu keçiddə işıq yanmır»'}
              </Txt>
            </View>
            <PressableScale
              haptic="medium"
              scaleTo={0.9}
              accessibilityRole="button"
              accessibilityLabel={listening ? 'Dayandır və göndər' : 'Səslə bildir'}
              onPress={listening ? stopVoice : startVoice}
              style={[styles.mic, { backgroundColor: listening ? C.navy : t.hc ? C_HC.brand : C.brand }]}
            >
              <Icon name={listening ? 'stop' : 'microphone'} size={28} color="#FFFFFF" />
            </PressableScale>
          </View>
          {listening ? (
            <View style={styles.meter}>
              {Array.from({ length: 24 }).map((_, i) => {
                const k = 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + (rec.durationMillis ?? 0) / 180));
                return <View key={i} style={[styles.meterBar, { height: 6 + level * 34 * k }]} />;
              })}
            </View>
          ) : null}
        </Animated.View>

        {/* nearby */}
        <Animated.View entering={enter(10)} style={{ marginTop: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
            <Txt v="h3" style={{ flex: 1 }}>
              Yaxınlıqda son bildirişlər
            </Txt>
            <PressableScale scaleTo={0.94} accessibilityRole="button" onPress={() => router.navigate('/map')} style={styles.all}>
              <Txt w="semi" size={13}>
                Xəritə
              </Txt>
              <Icon name="arrow-right" size={15} />
            </PressableScale>
          </View>
          <View style={{ gap: 8 }}>
            {nearby.length === 0 ? (
              <View style={[styles.near, border]}>
                <View style={[styles.nearIcon, { backgroundColor: C.safeSoft }]}>
                  <Icon name="shield-check-outline" size={20} color={C.safe} />
                </View>
                <Txt w="semi" size={14} color={C.ink2} style={{ flex: 1 }}>
                  Yaxınlıqda açıq bildiriş yoxdur. Nəsə görsən, ilk sən xəbər ver.
                </Txt>
              </View>
            ) : null}
            {nearby.map((r) => {
              const m = REPORT_META[r.category];
              const danger = m.tone === 'danger';
              return (
                <View key={r.id} style={[styles.near, border]}>
                  <View style={[styles.nearIcon, { backgroundColor: danger ? C.dangerSoft : C.warnSoft }]}>
                    <Icon name={m.icon} size={20} color={danger ? C.danger : C.warn} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt w="bold" size={14.5}>
                      {m.title}
                      {r.mine ? '  · sənin' : ''}
                    </Txt>
                    <Txt w="med" size={12.5} color={C.muted}>
                      {ago(r.minutesAgo)} · {r.count} nəfər təsdiqlədi
                    </Txt>
                  </View>
                  <View style={styles.conf}>
                    <Icon name="creation" size={13} color={C.ai} />
                    <Txt w="bold" size={12} color={C.ai}>
                      {r.aiConfidence}%
                    </Txt>
                  </View>
                </View>
              );
            })}
          </View>
        </Animated.View>

        <View style={styles.anon}>
          <Icon name="lock-outline" size={16} color={C.muted} />
          <Txt w="med" size={13} color={C.muted}>
            Anonimdir · yerin avtomatik əlavə olunur
          </Txt>
        </View>
      </ScrollView>
      <TopFade />

      <Modal visible={!!flow} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setFlow(null)}>
        <View style={styles.backdrop}>
          <SlideUp key={flow?.phase} style={[styles.modal, { paddingBottom: insets.bottom + 22 }, border]}>
            {flow?.phase === 'checking' ? (
              <View style={{ alignItems: 'center' }}>
                <Orb size={150} level={0.4} active />
                <Txt v="h2" style={{ marginTop: 8 }}>
                  Əhməd yoxlayır…
                </Txt>
                <Txt w="med" size={14} color={C.muted} center style={{ marginTop: 6 }}>
                  {flow.transcript ? `«${flow.transcript}»\n` : ''}Yaxınlıqdakı bildirişlərlə müqayisə edirəm
                </Txt>
              </View>
            ) : flow?.phase === 'pick' ? (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={styles.ahmed}>
                    <AhmedAvatar size={40} mood="talk" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt v="h3">Səsini eşitdim</Txt>
                    <Txt w="med" size={13.5} color={C.muted}>
                      {flow.transcript ? `«${flow.transcript}» — ` : ''}hansı növdür?
                    </Txt>
                  </View>
                </View>
                <View style={[styles.grid, { marginTop: 16 }]}>
                  {CATS.map((c) => {
                    const m = REPORT_META[c];
                    const danger = m.tone === 'danger';
                    return (
                      <PressableScale key={c} haptic="medium" accessibilityRole="button" onPress={() => submit(c, flow.transcript)} style={[styles.pick, { minHeight: t.hit + 8 }, border]}>
                        <Icon name={m.icon} size={20} color={danger ? C.danger : C.warn} />
                        <Txt w="bold" size={13.5} numberOfLines={1} style={{ flexShrink: 1 }}>
                          {m.title}
                        </Txt>
                      </PressableScale>
                    );
                  })}
                </View>
                <PillButton label="Ləğv et" variant="white" style={{ marginTop: 14 }} onPress={() => setFlow(null)} />
              </View>
            ) : flow?.phase === 'done' ? (
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
                  <Burst size={260} />
                  <Pop>
                    <View style={styles.okIcon}>
                      <Icon name="check-bold" size={42} color="#FFFFFF" />
                    </View>
                  </Pop>
                </View>
                <AnimatedNumber value={10} prefix="+" suffix=" xal" v="hero" color={C.brandDark} duration={700} style={{ marginTop: 12 }} />
                <Txt w="semi" size={13.5} color={C.muted} style={{ marginTop: 2 }}>
                  Cəmi{' '}
                  <AnimatedNumber value={points} v="label" color={C.ink} duration={900} delay={200} /> xal
                </Txt>
                <Txt v="h3" style={{ marginTop: 14 }}>
                  {REPORT_META[flow.category].title}
                </Txt>
                {flow.transcript ? (
                  <Txt w="med" size={14} color={C.ink2} center style={{ marginTop: 4 }}>
                    «{flow.transcript}»
                  </Txt>
                ) : null}
                <View style={[styles.verdict, { backgroundColor: flow.confidence ? C.aiSoft : C.safeSoft }]}>
                  <Icon name={flow.confidence ? 'creation' : flow.merged ? 'merge' : 'map-marker-check-outline'} size={16} color={flow.confidence ? C.ai : C.safe} />
                  <Txt w="bold" size={13} color={flow.confidence ? C.ai : C.safe}>
                    {flow.confidence
                      ? `Əhməd təsdiqlədi · ${flow.confidence}%`
                      : flow.merged
                        ? `${flow.merged} oxşar bildirişlə birləşdi`
                        : 'Xəritəyə yeni nöqtə əlavə olundu'}
                  </Txt>
                </View>
                <Txt w="med" size={13.5} color={C.muted} center style={{ marginTop: 10 }}>
                  Bu yerdən keçən piyadalar artıq xəbərdar edilir
                </Txt>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, alignSelf: 'stretch' }}>
                  <PillButton label="Bağla" variant="white" style={{ flex: 1 }} onPress={() => setFlow(null)} />
                  <PillButton
                    label="Xəritədə bax"
                    variant="black"
                    style={{ flex: 1 }}
                    onPress={() => {
                      setFlow(null);
                      router.navigate('/map');
                    }}
                  />
                </View>
              </View>
            ) : null}
          </SlideUp>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  points: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.brandSoft, borderRadius: R.pill, paddingHorizontal: 12, height: 32 },
  camera: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.navy, borderRadius: R.lg, padding: 14 },
  camDisc: { width: 54, height: 54, borderRadius: 27, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  camArrow: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  cat: { backgroundColor: C.surface, borderRadius: R.lg, paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', gap: 10 },
  catIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  voice: { marginTop: 14, backgroundColor: C.surface, borderRadius: R.lg, padding: 12 },
  ahmed: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  mic: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  meter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 48, marginTop: 8 },
  meterBar: { width: 4, borderRadius: 2, backgroundColor: C.brand },
  all: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.surface, borderRadius: R.pill, paddingHorizontal: 14, height: 36 },
  near: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: R.md, padding: 10 },
  nearIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  conf: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.aiSoft, borderRadius: R.pill, paddingHorizontal: 9, height: 26 },
  anon: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 22 },
  backdrop: { flex: 1, backgroundColor: C.scrim, justifyContent: 'flex-end' },
  modal: { backgroundColor: C.bg, borderTopLeftRadius: 34, borderTopRightRadius: 34, padding: 22 },
  okIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: C.safe, alignItems: 'center', justifyContent: 'center' },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, borderRadius: R.pill, paddingHorizontal: 14, height: 34 },
  pick: { width: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface, borderRadius: R.md, paddingHorizontal: 12 },
});
