import React, { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useIsNight } from '@/store/useAppStore';
import { useTheme } from '@/hooks/useTheme';
import { optionOf } from '@/data/routes';
import { AhmedAvatar } from '@/components/Brand';
import { DevTrigger } from '@/components/DevTrigger';
import { Pulse } from '@/components/anim';
import { Icon, Txt } from '@/components/ui';
import { useTabBarSpace } from '@/components/TabBar';
import { PressableScale, enter } from '@/motion';
import { say } from '@/voice';
import { A11Y } from '@/voice/lines/a11y';
import { C, C_HC, R, shadow } from '@/theme';
import { USER_NAME, greeting } from '@/features/home/context';
import { TopFade } from '@/features/home/TopFade';
import { morphTo } from './morph';
import { ModePicker } from './ModePicker';
import { Speak, pointOf, speakText } from './Speak';

const PLACES = [
  { id: 'ev', title: 'Ev', sub: 'Əhmədli', icon: 'home-variant', line: A11Y.goHome },
  { id: 'hilton', title: 'Hilton', sub: 'Azadlıq pr.', icon: 'office-building', line: A11Y.goHilton },
  { id: 'icherisheher', title: 'Nənənin evi', sub: 'İçərişəhər', icon: 'heart', line: A11Y.goNene },
] as const;

const CONTACTS = [
  { name: 'Murad', rel: 'Oğlun', tel: '+994502113456', initial: 'M', bg: C.purpleLight },
  { name: 'Leyla', rel: 'Qızın', tel: '+994556401822', initial: 'L', bg: C.brandSoft },
];

/**
 * Sadə rejim: voice-first home for seniors and low vision. Giant targets, three places,
 * family call, "take me home". Every text block reads itself aloud on tap.
 */
export function SimpleHome() {
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const P = t.C;
  const night = useIsNight();
  const bottom = useTabBarSpace();
  const [callOpen, setCallOpen] = useState(false);
  const border = t.hc ? { borderWidth: 2, borderColor: C_HC.line } : null;
  const hello = `${greeting()}, ${USER_NAME}!`;

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: bottom + 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* header: Əhməd + one-tap way back */}
        <Animated.View entering={enter(0, 'fade')} style={styles.head}>
          <DevTrigger>
            <View style={[styles.avatar, { backgroundColor: t.hc ? '#FFFFFF' : C.brandSoft }, border]}>
              <AhmedAvatar size={44} />
            </View>
          </DevTrigger>
          <PressableScale
            haptic="medium"
            accessibilityRole="button"
            accessibilityLabel="Standart görünüşə qayıt"
            onPress={(e) => morphTo('standard', pointOf(e))}
            style={[styles.back, { minHeight: t.hit }, border]}
          >
            <Icon name="arrow-u-left-top" size={20} color={C.ink} />
            <Txt w="bold" size={14}>
              Adi görünüş
            </Txt>
          </PressableScale>
        </Animated.View>

        <Animated.View entering={enter(1)}>
          <Speak text={A11Y.simpleHello} style={{ marginTop: 14, padding: 4, marginHorizontal: -4 }}>
            <Txt v="h1">{hello}</Txt>
            <Txt w="semi" size={17} color={C.ink2} style={{ marginTop: 6 }}>
              Mən Əhmədəm. Hara getmək istəyirsən?
            </Txt>
          </Speak>
        </Animated.View>

        {/* giant mic */}
        <Animated.View entering={enter(2)}>
          <PressableScale
            haptic="medium"
            scaleTo={0.97}
            accessibilityRole="button"
            accessibilityLabel="Əhmədlə danış"
            onPress={() => router.push('/ahmed')}
            style={[styles.mic, { backgroundColor: P.brand }, border, !t.hc && shadow(2)]}
          >
            <View style={styles.micDisc}>
              <Pulse size={84} color="#FFFFFF" />
              <View style={styles.micInner}>
                <Icon name="microphone" size={40} color={P.brand} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Txt v="h1" color="#FFFFFF">
                Əhmədlə danış
              </Txt>
              <Txt w="semi" size={15} color="rgba(255,255,255,0.9)" style={{ marginTop: 4 }}>
                Toxun, mən dinləyirəm
              </Txt>
            </View>
          </PressableScale>
        </Animated.View>

        {/* places */}
        <Animated.View entering={enter(3)}>
          <Speak text={A11Y.whereTo} style={{ marginTop: 24, marginBottom: 10, alignSelf: 'flex-start', paddingHorizontal: 4, marginLeft: -4 }}>
            <Txt v="h2">Hara gedirsən?</Txt>
          </Speak>
        </Animated.View>
        <View style={{ gap: 10 }}>
          {PLACES.map((p, i) => {
            const o = optionOf(p.id, 'safest');
            const sc = o ? (night ? o.scoreNight : o.scoreDay) : null;
            return (
              <Animated.View key={p.id} entering={enter(4 + i)}>
                <PressableScale
                  haptic="medium"
                  scaleTo={0.98}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.title}. ${o ? `${o.durationMin} dəqiqə` : ''}`}
                  onPress={() => {
                    say(p.line);
                    router.push(`/results/${p.id}`);
                  }}
                  style={[styles.place, { backgroundColor: P.surface, minHeight: t.hit + 40 }, border]}
                >
                  <View style={[styles.placeIcon, { backgroundColor: t.hc ? C.navy : '#FFFFFF' }]}>
                    <Icon name={p.icon} size={30} color={t.hc ? '#FFFFFF' : p.id === 'icherisheher' ? C.danger : C.ink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt w="xbold" size={21} numberOfLines={1}>
                      {p.title}
                    </Txt>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <Icon name="shield-check" size={18} color={C.safe} />
                      <Txt w="semi" size={14} color={C.ink2} numberOfLines={2} style={{ flexShrink: 1 }}>
                        {o ? `${o.durationMin} dəq · ${sc != null && sc >= 75 ? 'ən az riskli yol' : p.sub}` : p.sub}
                      </Txt>
                    </View>
                  </View>
                  <Icon name="chevron-right" size={28} color={C.ink} />
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>

        {/* family + home */}
        <Animated.View entering={enter(7)} style={styles.duo}>
          <PressableScale
            haptic="medium"
            accessibilityRole="button"
            accessibilityLabel="Ailəmə zəng"
            onPress={() => {
              setCallOpen(true);
              say(A11Y.whoToCall);
            }}
            style={[styles.big, { backgroundColor: C.navy, minHeight: t.hit + 64 }, border]}
          >
            <View style={[styles.bigDisc, { backgroundColor: '#FFFFFF' }]}>
              <Icon name="phone" size={28} color={C.navy} />
            </View>
            <Txt w="xbold" size={18} color="#FFFFFF" center>
              Ailəmə zəng
            </Txt>
          </PressableScale>
          <PressableScale
            haptic="medium"
            accessibilityRole="button"
            accessibilityLabel="Evə apar"
            onPress={() => {
              say(A11Y.takeHome);
              router.push('/navigate?dest=ev&kind=safest');
            }}
            style={[styles.big, { backgroundColor: t.hc ? '#FFFFFF' : C.brandSoft, minHeight: t.hit + 64 }, border]}
          >
            <View style={[styles.bigDisc, { backgroundColor: P.brand }]}>
              <Icon name="home-variant" size={28} color="#FFFFFF" />
            </View>
            <Txt w="xbold" size={18} center>
              Evə apar
            </Txt>
          </PressableScale>
        </Animated.View>

        {/* appearance */}
        <Animated.View entering={enter(8)}>
          <Speak text={A11Y.appearance} style={{ marginTop: 26, marginBottom: 10, padding: 4, marginHorizontal: -4 }}>
            <Txt v="h3">Görünüş</Txt>
            <Txt w="med" size={14} color={C.muted} style={{ marginTop: 2 }}>
              Yazıların ölçüsünü və rəngini seç
            </Txt>
          </Speak>
          <ModePicker />
        </Animated.View>

        <Pressable accessibilityRole="button" onPress={() => speakText(A11Y.tapHint)} style={styles.hint}>
          <Icon name="gesture-tap" size={18} color={C.muted} />
          <Txt w="med" size={13.5} color={C.muted}>
            Hər yazıya toxun — Əhməd səsli oxuyacaq
          </Txt>
        </Pressable>
      </ScrollView>
      <TopFade />

      <Modal visible={callOpen} transparent animationType="fade" onRequestClose={() => setCallOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setCallOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 18 }, border]} onPress={() => {}}>
            <View style={styles.grab} />
            <Txt v="h2" style={{ marginBottom: 14 }}>
              Kimə zəng edək?
            </Txt>
            {CONTACTS.map((c) => (
              <PressableScale
                key={c.name}
                haptic="medium"
                accessibilityRole="button"
                accessibilityLabel={`${c.name}, ${c.rel.toLowerCase()}. Zəng et`}
                onPress={() => {
                  setCallOpen(false);
                  Linking.openURL(`tel:${c.tel}`).catch(() => {});
                }}
                style={[styles.contact, { minHeight: t.hit + 24 }, border]}
              >
                <View style={[styles.initial, { backgroundColor: c.bg }]}>
                  <Txt w="xbold" size={22}>
                    {c.initial}
                  </Txt>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt w="xbold" size={20}>
                    {c.name}
                  </Txt>
                  <Txt w="semi" size={14} color={C.muted}>
                    {c.rel}
                  </Txt>
                </View>
                <View style={[styles.callDisc, { backgroundColor: P.brand }]}>
                  <Icon name="phone" size={24} color="#FFFFFF" />
                </View>
              </PressableScale>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, borderRadius: R.pill, backgroundColor: C.surface },
  mic: { marginTop: 18, borderRadius: 36, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 150 },
  micDisc: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  micInner: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  place: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: R.lg, padding: 14 },
  placeIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  safe: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 28, paddingHorizontal: 9, borderRadius: R.pill },
  duo: { flexDirection: 'row', gap: 10, marginTop: 14 },
  big: { flex: 1, borderRadius: R.lg, padding: 16, alignItems: 'center', justifyContent: 'center', gap: 10 },
  bigDisc: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 22, paddingVertical: 8 },
  scrim: { flex: 1, backgroundColor: C.scrim, justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 18, gap: 10 },
  grab: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: C.line, marginBottom: 12 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surface, borderRadius: R.lg, padding: 12 },
  initial: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  callDisc: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
