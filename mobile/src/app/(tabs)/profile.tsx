import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { usePrefs } from '@/store/prefs';
import { useTheme } from '@/hooks/useTheme';
import { Avatar } from '@/components/Brand';
import { Pop } from '@/components/anim';
import { AreaChart, BarChart } from '@/components/charts';
import { Icon, Txt } from '@/components/ui';
import { useTabBarSpace } from '@/components/TabBar';
import { AnimatedNumber, PressableScale, enter } from '@/motion';
import { SPRING } from '@/motion/springs';
import { ModePicker } from '@/features/a11y/ModePicker';
import { TopFade } from '@/features/home/TopFade';
import { USER_NAME } from '@/features/home/context';
import { stop as stopVoice } from '@/voice';
import { C, C_HC, R, shadow } from '@/theme';
import { upperAz } from '@/features/a11y/text';

const WEEK = [5, 8, 3, 9, 7, 4, 10];
const DAYS = ['B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş', 'B'];
const SCORE_30 = [71, 73, 72, 75, 74, 77, 76, 78, 80, 79, 81, 80, 82, 84, 83, 85, 84, 86, 85, 87, 88, 86, 88, 89, 88, 90, 89, 91, 90, 92];
const BADGES = [
  { icon: 'weather-night', label: 'Gecə qoruyucusu', bg: C.aiSoft, color: C.ai },
  { icon: 'elevator-passenger-outline', label: 'Lift ovçusu', bg: C.purple, color: C.route },
  { icon: 'leaf', label: 'Yaşıl addım', bg: C.brandSoft, color: C.brandDark },
];
const LEVEL_MAX = 2000;

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  const v = useSharedValue(on ? 1 : 0);
  const t = useTheme();
  useEffect(() => {
    v.value = withSpring(on ? 1 : 0, SPRING.snappy);
  }, [on, v]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: 3 + v.value * 22 }] }));
  const track = useAnimatedStyle(() => ({ opacity: 0.35 + 0.65 * v.value }));
  return (
    <PressableScale
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      haptic="medium"
      scaleTo={0.92}
      onPress={() => onChange(!on)}
      hitSlop={10}
      style={[styles.track, { backgroundColor: C.bg2 }, t.hc && { borderWidth: 2, borderColor: C_HC.line }]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 18, backgroundColor: t.hc ? C_HC.brand : C.brand }, track]} />
      <Animated.View style={[styles.knob, knob]} />
    </PressableScale>
  );
}

function Row({ icon, title, sub, tint, bg, onPress, right }: { icon: string; title: string; sub: string; tint: string; bg: string; onPress?: () => void; right?: React.ReactNode }) {
  const t = useTheme();
  return (
    <PressableScale scaleTo={0.98} accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`} onPress={onPress} disabled={!onPress && !right} style={[styles.row, { minHeight: t.hit + 22 }, t.hc && styles.hcBorder]}>
      <View style={[styles.rowIcon, { backgroundColor: bg }]}>
        <Icon name={icon} size={22} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt w="bold" size={15.5}>
          {title}
        </Txt>
        <Txt w="med" size={12.5} color={C.muted} numberOfLines={2}>
          {sub}
        </Txt>
      </View>
      {right ?? <Icon name="chevron-right" size={22} color={C.ink} />}
    </PressableScale>
  );
}

function Stat({ value, decimals = 0, suffix, label, icon, tint, delay }: { value: number; decimals?: number; suffix?: string; label: string; icon: string; tint: string; delay: number }) {
  const t = useTheme();
  return (
    <View style={[styles.stat, t.hc && styles.hcBorder]}>
      <Icon name={icon} size={20} color={tint} />
      <AnimatedNumber value={value} decimals={decimals} suffix={suffix} v="num" delay={delay} style={{ marginTop: 8 }} />
      <Txt w="med" size={12.5} color={C.muted} style={{ marginTop: 2 }}>
        {label}
      </Txt>
    </View>
  );
}

export default function Profile() {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const t = useTheme();
  const points = useAppStore((s) => s.points);
  const reportsMade = useAppStore((s) => s.reportsMade);
  const helped = useAppStore((s) => s.helped);
  const familySubscribed = useAppStore((s) => s.familySubscribed);
  const voiceMuted = usePrefs((p) => p.voiceMuted);
  const setVoiceMuted = usePrefs((p) => p.setVoiceMuted);

  const prog = useSharedValue(0);
  useEffect(() => {
    prog.value = withDelay(250, withTiming(Math.min(1, points / LEVEL_MAX), { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [points, prog]);
  const fill = useAnimatedStyle(() => ({ width: `${prog.value * 100}%` }));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: tabSpace + 12 }}
        showsVerticalScrollIndicator={false}
      >
        {/* identity */}
        <Animated.View entering={enter(0)} style={styles.head}>
          <LinearGradient colors={[C.brand, C.route, C.ai]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
            <View style={styles.ringInner}>
              <Avatar size={74} />
            </View>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Txt v="h1">{USER_NAME}</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Icon name="map-marker-outline" size={15} color={C.muted} />
              <Txt w="med" size={13.5} color={C.muted}>
                Bakı · 2026-dan bəri
              </Txt>
            </View>
          </View>
        </Animated.View>

        {/* level */}
        <Animated.View entering={enter(1)}>
          <LinearGradient colors={[C.navy, '#18294A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.level, !t.hc && shadow(2)]}>
            <View style={styles.levelGlow} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Txt v="overline" color="rgba(255,255,255,0.7)">
                  {upperAz('Səviyyə 4 · Şəhər qəhrəmanı')}
                </Txt>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                  <AnimatedNumber value={points} v="hero" color="#FFFFFF" duration={1100} />
                  <Txt w="bold" size={16} color={C.brand}>
                    xal
                  </Txt>
                </View>
              </View>
              <Pop delay={350}>
                <View style={styles.medal}>
                  <Icon name="medal" size={30} color="#FFFFFF" />
                </View>
              </Pop>
            </View>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, fill]} />
            </View>
            <Txt w="semi" size={13} color="rgba(255,255,255,0.75)" style={{ marginTop: 10 }}>
              Səviyyə 5-ə {Math.max(0, LEVEL_MAX - points).toLocaleString('en-US').replace(/,/g, ' ')} xal qalıb
            </Txt>
          </LinearGradient>
        </Animated.View>

        {/* impact */}
        <Animated.View entering={enter(2)} style={styles.grid}>
          <Stat value={reportsMade} label="bildiriş göndərdin" icon="bullhorn-outline" tint={C.route} delay={150} />
          <Stat value={helped} label="nəfərə kömək etdin" icon="account-group-outline" tint={C.brandDark} delay={230} />
          <Stat value={17} label="riskli keçiddən yan keçdin" icon="shield-check-outline" tint={C.safe} delay={310} />
          <Stat value={6.4} decimals={1} suffix=" kq" label="CO₂ qənaəti" icon="leaf" tint={C.brandDark} delay={390} />
        </Animated.View>

        {/* appearance */}
        <Animated.View entering={enter(3)} style={styles.section}>
          <Txt v="h3">Görünüş</Txt>
          <Txt w="med" size={13} color={C.muted} style={{ marginTop: 2, marginBottom: 12 }}>
            Bir toxunuşla bütün tətbiq dəyişir
          </Txt>
          <ModePicker />
        </Animated.View>

        {/* voice */}
        <Animated.View entering={enter(4)} style={{ marginTop: 10 }}>
          <Row
            icon={voiceMuted ? 'volume-off' : 'account-voice'}
            title="Əhmədin səsi"
            sub={voiceMuted ? 'Söndürülüb · yalnız yazı ilə' : 'Açıqdır · Azərbaycan dilində danışır'}
            tint={C.ai}
            bg={C.aiSoft}
            onPress={() => {
              if (!voiceMuted) stopVoice();
              setVoiceMuted(!voiceMuted);
            }}
            right={
              <Toggle
                label="Əhmədin səsi"
                on={!voiceMuted}
                onChange={(on) => {
                  if (!on) stopVoice();
                  setVoiceMuted(!on);
                }}
              />
            }
          />
        </Animated.View>

        {/* charts */}
        <Animated.View entering={enter(5)} style={[styles.card, t.hc && styles.hcBorder]}>
          <View style={styles.cardHead}>
            <Txt v="h3">Bu həftə</Txt>
            <Txt w="semi" size={13} color={C.muted}>
              46 səfər
            </Txt>
          </View>
          <BarChart data={WEEK} labels={DAYS} a11y={`Bu həftə səfərlər: ${WEEK.join(', ')}`} />
        </Animated.View>

        <Animated.View entering={enter(6)} style={[styles.card, t.hc && styles.hcBorder]}>
          <View style={styles.cardHead}>
            <Txt v="h3">Təhlükəsizlik balın</Txt>
            <View style={styles.delta}>
              <Icon name="trending-up" size={15} color={C.safe} />
              <Txt w="bold" size={12.5} color={C.safe}>
                +21 · 30 gün
              </Txt>
            </View>
          </View>
          <AreaChart values={SCORE_30} height={110} a11y="Son 30 gündə orta təhlükəsizlik balı 71-dən 92-yə qalxdı" />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Txt w="semi" size={11.5} color={C.muted}>
              14 okt
            </Txt>
            <Txt w="semi" size={11.5} color={C.muted}>
              bu gün · 92
            </Txt>
          </View>
        </Animated.View>

        {/* badges */}
        <View style={styles.badges}>
          {BADGES.map((b, i) => (
            <View key={b.label} style={{ alignItems: 'center', flex: 1, gap: 8 }}>
              <Pop delay={500 + i * 120}>
                <View style={[styles.badge, { backgroundColor: b.bg }, t.hc && styles.hcBorder]}>
                  <Icon name={b.icon} size={28} color={b.color} />
                </View>
              </Pop>
              <Txt w="semi" size={12.5} center>
                {b.label}
              </Txt>
            </View>
          ))}
        </View>

        {/* more */}
        <Animated.View entering={enter(7)} style={[styles.section, { gap: 8 }]}>
          <Txt v="h3" style={{ marginBottom: 4 }}>
            Daha çox
          </Txt>
          <Row icon="cube-scan" title="AI Göz" sub="Keçidi kameraya göstər, Əhməd riskini qiymətləndirsin" tint="#FFFFFF" bg={C.navy} onPress={() => router.push('/scan')} />
          <Row icon="city-variant-outline" title="Şəhər paneli" sub="Bakının ən riskli keçidləri və piyada axını" tint={C.route} bg={C.purple} onPress={() => router.push('/city')} />
          <Row
            icon="account-heart-outline"
            title="Hara Ailə"
            sub={familySubscribed ? 'Aktivdir · 2 üzv izlənir' : 'Uşaq və yaşlıların yolunu izlə · 3,99 ₼/ay'}
            tint={C.brandDark}
            bg={C.brandSoft}
            onPress={() => router.push('/family')}
          />
          <Row icon="wheelchair-accessibility" title="Əlçatan marşrut" sub="Pilləkənsiz yol, lift statusu, metroda müşayiət" tint={C.ai} bg={C.aiSoft} onPress={() => router.push('/accessible')} />
        </Animated.View>
      </ScrollView>
      <TopFade />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ring: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  ringInner: { width: 82, height: 82, borderRadius: 41, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  level: { marginTop: 18, borderRadius: R.card, padding: 20, overflow: 'hidden' },
  levelGlow: { position: 'absolute', right: -60, top: -70, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(18,183,106,0.22)' },
  medal: { width: 60, height: 60, borderRadius: 30, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)' },
  progressTrack: { height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.14)', marginTop: 18, overflow: 'hidden' },
  progressFill: { height: 10, borderRadius: 5, backgroundColor: C.brand },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  stat: { width: '48%', flexGrow: 1, backgroundColor: C.surface, borderRadius: R.lg, padding: 16, minHeight: 118 },
  section: { marginTop: 26 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surface, borderRadius: R.lg, paddingHorizontal: 12, paddingVertical: 10 },
  rowIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  track: { width: 52, height: 32, borderRadius: 18, justifyContent: 'center', overflow: 'hidden' },
  knob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF', ...shadow(1) },
  card: { backgroundColor: C.surface, borderRadius: R.card, padding: 18, marginTop: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.safeSoft, borderRadius: R.pill, paddingHorizontal: 10, height: 28 },
  badges: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  badge: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  hcBorder: { borderWidth: 2, borderColor: C_HC.line },
});
