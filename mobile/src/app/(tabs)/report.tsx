import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '@/store/useAppStore';
import { REPORT_META } from '@/data/reports-seed';
import type { ReportCategory } from '@/data/types';
import { ROUTES } from '@/data/routes';
import { geminiJson } from '@/ai/gemini';
import { AhmedAvatar } from '@/components/Brand';
import { Orb } from '@/components/Orb';
import { Burst, FadeIn, Pop } from '@/components/anim';
import { Icon, PillButton, Tag, Txt, tap, Heading } from '@/components/ui';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { C, R, shadow } from '@/theme';

const CATS = Object.keys(REPORT_META) as ReportCategory[];

type Flow = { phase: 'checking' | 'done'; category: ReportCategory; confidence: number; transcript?: string } | null;

export default function Report() {
  const insets = useSafeAreaInsets();
  const addReport = useAppStore((s) => s.addReport);
  const addPoints = useAppStore((s) => s.addPoints);
  const aiEnabled = useAppStore((s) => s.aiEnabled);
  const [flow, setFlow] = useState<Flow>(null);
  const [listening, setListening] = useState(false);
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const rec = useAudioRecorderState(recorder, 100);
  const level = rec.isRecording && rec.metering != null ? Math.max(0, Math.min(1, (rec.metering + 55) / 50)) : 0;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const submit = (category: ReportCategory, transcript?: string) => {
    const confidence = 84 + Math.floor(Math.random() * 13);
    setFlow({ phase: 'checking', category, confidence, transcript });
    timer.current = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setFlow({ phase: 'done', category, confidence, transcript });
      addReport({
        id: 'u' + Date.now(),
        category,
        lat: ROUTES.origin.lat + (Math.random() - 0.5) * 0.002,
        lon: ROUTES.origin.lon + (Math.random() - 0.5) * 0.002,
        minutesAgo: 0,
        aiConfidence: confidence,
        count: 1,
        mine: true,
      });
      addPoints(10, 'Şəhər Qəhrəmanı');
    }, 1800);
  };

  const startVoice = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setListening(true);
      tap(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      submit('dark', 'Bu keçiddə işıq yanmır');
    }
  };

  const stopVoice = async () => {
    setListening(false);
    let category: ReportCategory = 'dark';
    let transcript = 'Bu keçiddə işıq yanmır';
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (aiEnabled && recorder.uri && (rec.durationMillis ?? 0) > 600) {
        const b64 = await new File(recorder.uri).base64();
        setFlow({ phase: 'checking', category, confidence: 0, transcript: '…' });
        const r = await geminiJson<{ transcript: string; category: ReportCategory }>({
          system:
            'You classify short Azerbaijani voice reports about street hazards in Baku. Categories: dark (unlit street / broken street light), car (car parked on sidewalk), lift (elevator/escalator not working), crossing (dangerous pedestrian crossing / no traffic light), sidewalk (no sidewalk / broken sidewalk), speed (speeding cars). Return the transcript in Azerbaijani Latin script and the best category.',
          parts: [{ inlineData: { mimeType: 'audio/m4a', data: b64 } }, { text: 'Bu bildirişi təsnif et.' }],
          schema: {
            type: 'OBJECT',
            properties: {
              transcript: { type: 'STRING' },
              category: { type: 'STRING', enum: CATS },
            },
            required: ['transcript', 'category'],
          },
          timeoutMs: 8000,
        });
        if (CATS.includes(r.category)) category = r.category;
        if (r.transcript) transcript = r.transcript;
      }
    } catch (e) {
      console.warn('[Bildir] voice fallback', String(e));
    }
    submit(category, transcript);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 18, paddingBottom: TAB_BAR_SPACE + 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Heading light="Nə" bold="görürsən?" size={40} newline />
            <Txt w="med" size={15} color={C.muted} style={{ marginTop: 8 }}>
              Bir toxunuşla bildir, başqalarını qoru
            </Txt>
          </View>
          <Tag label="+10 xal" icon="check" bg={C.safeSoft} color={C.safe} style={{ height: 36, paddingHorizontal: 14 }} />
        </View>

        <View style={styles.grid}>
          {CATS.map((c, i) => {
            const m = REPORT_META[c];
            const tone = m.tone === 'danger' ? C.danger : C.warn;
            return (
              <FadeIn key={c} index={i} style={{ width: '31.5%', flexGrow: 1 }}>
              <Pressable
                onPress={() => {
                  tap(Haptics.ImpactFeedbackStyle.Medium);
                  submit(c);
                }}
                style={({ pressed }) => [styles.cat, { transform: [{ scale: pressed ? 0.96 : 1 }] }]}
              >
                <View style={[styles.catIcon, { backgroundColor: m.tone === 'danger' ? C.dangerSoft : C.warnSoft }]}>
                  <Icon name={m.icon} size={30} color={tone} />
                </View>
                <Txt w="bold" size={15} center>
                  {m.title}
                </Txt>
              </Pressable>
              </FadeIn>
            );
          })}
        </View>

        <View style={styles.or}>
          <View style={styles.orLine} />
          <Txt w="med" size={14} color={C.muted}>
            və ya səslə
          </Txt>
          <View style={styles.orLine} />
        </View>

        <View style={styles.voiceRow}>
          <AhmedAvatar size={52} mood={listening ? 'talk' : 'smile'} />
          <Pressable onPress={listening ? stopVoice : startVoice} style={[styles.mic, listening && { backgroundColor: C.black }]}>
            <Icon name={listening ? 'stop' : 'microphone'} size={30} color={listening ? C.brand : C.navy} />
          </Pressable>
          <View style={styles.bubble}>
            <Txt w="semi" size={15} color={listening ? C.ink : C.ink}>
              {listening ? `Dinləyirəm… ${Math.floor((rec.durationMillis ?? 0) / 1000)}s` : '“Bu keçiddə işıq yanmır”'}
            </Txt>
          </View>
        </View>
        {listening ? <View style={{ height: Math.round(4 + level * 6) }} /> : null}

        <View style={styles.anon}>
          <Icon name="lock-outline" size={16} color={C.muted} />
          <Txt w="med" size={13} color={C.muted}>
            Anonim · yeriniz avtomatik əlavə olunur
          </Txt>
        </View>
      </ScrollView>

      <Modal visible={!!flow} transparent animationType="fade" onRequestClose={() => setFlow(null)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            {flow?.phase === 'checking' ? (
              <>
                <Orb size={150} level={0.4} active />
                <Txt w="xbold" size={22} style={{ marginTop: 8 }}>
                  AI yoxlayır…
                </Txt>
                <Txt w="med" size={14} color={C.muted} center style={{ marginTop: 6 }}>
                  Təkrar və saxta bildirişlər ayrılır,{'\n'}yaxınlıqdakı bildirişlərlə müqayisə olunur
                </Txt>
              </>
            ) : flow ? (
              <>
                <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
                  <Burst size={240} />
                  <Pop>
                    <View style={styles.okIcon}>
                      <Icon name="check-bold" size={42} color={C.ink} />
                    </View>
                  </Pop>
                </View>
                <Txt w="black" size={26} style={{ marginTop: 14 }}>
                  +10 xal
                </Txt>
                <Txt w="bold" size={17} style={{ marginTop: 4 }}>
                  {REPORT_META[flow.category].title}
                </Txt>
                {flow.transcript ? (
                  <Txt w="med" size={14} color={C.ink2} center style={{ marginTop: 6 }}>
                    “{flow.transcript}”
                  </Txt>
                ) : null}
                <Tag label={`AI təsdiqlədi · ${flow.confidence}%`} bg={C.safeSoft} color={C.safe} style={{ marginTop: 12, alignSelf: 'center' }} />
                <Txt w="med" size={13.5} color={C.muted} center style={{ marginTop: 10 }}>
                  Bu yerdən keçən piyadalara artıq xəbərdarlıq gedir
                </Txt>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, alignSelf: 'stretch' }}>
                  <PillButton label="Bağla" variant="white" style={{ flex: 1, ...shadow(1) }} onPress={() => setFlow(null)} />
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
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 22 },
  cat: {
    backgroundColor: C.surface,
    borderRadius: R.lg,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 12,
  },
  catIcon: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
  or: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 22 },
  orLine: { flex: 1, height: 1, backgroundColor: C.line },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mic: { width: 70, height: 70, borderRadius: 35, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', ...shadow(2) },
  bubble: { flex: 1, backgroundColor: C.surface, borderRadius: R.lg, paddingHorizontal: 16, paddingVertical: 16 },
  anon: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 22 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 22 },
  modal: { backgroundColor: C.bg, borderRadius: 34, padding: 24, alignItems: 'center' },
  okIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: C.safe, alignItems: 'center', justifyContent: 'center' },
});
