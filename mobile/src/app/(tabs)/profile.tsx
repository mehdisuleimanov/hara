import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { Avatar } from '@/components/Brand';
import { CircleButton, Heading, Icon, Txt } from '@/components/ui';
import { FadeIn, Pop, useCountUp } from '@/components/anim';
import { AreaChart, BarChart, Donut } from '@/components/charts';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { C, R } from '@/theme';

const WEEK = [5, 8, 3, 9, 7, 4, 10];
const DAYS = ['B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş', 'B'];
const SCORE_30 = [71, 73, 72, 75, 74, 77, 76, 78, 80, 79, 81, 80, 82, 84, 83, 85, 84, 86, 85, 87, 88, 86, 88, 89, 88, 90, 89, 91, 90, 92];
const MODES = [
  { label: 'Piyada', value: 46, color: C.route },
  { label: 'Metro', value: 31, color: C.brand },
  { label: 'Avtobus', value: 15, color: '#7FB0FF' },
  { label: 'Skuter', value: 8, color: C.faint },
];
const BADGES = [
  { icon: 'weather-night', label: 'Gecə qoruyucusu' },
  { icon: 'elevator-passenger-outline', label: 'Lift ovçusu' },
  { icon: 'leaf', label: 'Yaşıl addım' },
];

function Stat({ value, suffix = '', label, decimals = 0, delay = 0 }: { value: number; suffix?: string; label: string; decimals?: number; delay?: number }) {
  const v = useCountUp(value, 1000, delay);
  const text = decimals ? v.toFixed(decimals).replace('.', ',') : Math.round(v).toLocaleString('en-US');
  return (
    <View style={styles.stat}>
      <Txt w="black" size={30}>
        {text}
        {suffix}
      </Txt>
      <Txt w="med" size={13.5} color={C.muted}>
        {label}
      </Txt>
    </View>
  );
}

export default function Profile() {
  const insets = useSafeAreaInsets();
  const points = useAppStore((s) => s.points);
  const reportsMade = useAppStore((s) => s.reportsMade);
  const helped = useAppStore((s) => s.helped);
  const familySubscribed = useAppStore((s) => s.familySubscribed);
  const setDemo = useAppStore((s) => s.setDemoPanelOpen);
  const levelMax = 2000;
  const shownPts = useCountUp(points, 1100);
  const prog = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(prog, { toValue: Math.min(1, points / levelMax), duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [points, prog]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: TAB_BAR_SPACE + 24 }}
      showsVerticalScrollIndicator={false}
    >
      <FadeIn index={0}>
        <View style={styles.row}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Avatar size={72} />
            <View>
              <Txt w="black" size={30}>
                Aysel
              </Txt>
              <Txt w="med" size={14.5} color={C.muted}>
                Bakı · 2026-dan bəri
              </Txt>
            </View>
          </View>
          <CircleButton icon="cog-outline" size={52} onLongPress={() => setDemo(true)} />
        </View>
      </FadeIn>

      <FadeIn index={1}>
        <View style={styles.level}>
          <View style={styles.levelGlow} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Pop delay={300}>
              <View style={styles.medal}>
                <Icon name="medal-outline" size={30} color={C.navy} />
              </View>
            </Pop>
            <View style={{ flex: 1 }}>
              <Heading light="Şəhər" bold="Qəhrəmanı" size={22} color={C.ink} />
              <Txt w="semi" size={14} color={C.muted}>
                Səviyyə 4
              </Txt>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: prog.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
          </View>
          <Txt w="semi" size={13.5} color={C.muted} style={{ marginTop: 8 }}>
            {Math.round(shownPts).toLocaleString('en-US')} / {levelMax.toLocaleString('en-US')} xal · növbəti: Səviyyə 5
          </Txt>
        </View>
      </FadeIn>

      <FadeIn index={2}>
        <View style={styles.grid}>
          <Stat value={reportsMade} label="bildiriş" />
          <Stat value={helped} label="nəfərə kömək" delay={80} />
          <Stat value={17} label="təhlükəli keçiddən yan keçdin" delay={160} />
          <Stat value={6.4} decimals={1} suffix=" kq" label="CO₂ qənaət" delay={240} />
        </View>
      </FadeIn>

      <FadeIn index={3}>
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Heading bold="Bu həftə" size={20} />
            <Txt w="semi" size={13} color={C.muted}>
              46 səfər
            </Txt>
          </View>
          <BarChart data={WEEK} labels={DAYS} a11y={`Bu həftə səfərlər: ${WEEK.join(', ')}`} />
        </View>
      </FadeIn>

      <FadeIn index={4}>
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Heading bold="Təhlükəsizlik balı" size={20} />
            <Txt w="bold" size={13} color={C.safe}>
              +21 · 30 gün
            </Txt>
          </View>
          <AreaChart values={SCORE_30} height={120} a11y="Son 30 gündə orta təhlükəsizlik balı 71-dən 92-yə qalxdı" />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Txt w="semi" size={11.5} color={C.muted}>
              14 okt
            </Txt>
            <Txt w="semi" size={11.5} color={C.muted}>
              bu gün · 92
            </Txt>
          </View>
        </View>
      </FadeIn>

      <FadeIn index={5}>
        <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 18 }]}>
          <Donut
            segments={MODES}
            size={132}
            thickness={18}
            center={
              <View style={{ alignItems: 'center' }}>
                <Txt w="black" size={22}>
                  92%
                </Txt>
                <Txt w="semi" size={11} color={C.muted}>
                  yaşıl
                </Txt>
              </View>
            }
          />
          <View style={{ flex: 1, gap: 8 }}>
            <Heading bold="Səfər növləri" size={18} />
            {MODES.map((m) => (
              <View key={m.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: m.color }} />
                <Txt w="semi" size={14} style={{ flex: 1 }}>
                  {m.label}
                </Txt>
                <Txt w="bold" size={14}>
                  {m.value}%
                </Txt>
              </View>
            ))}
          </View>
        </View>
      </FadeIn>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 }}>
        {BADGES.map((b, i) => (
          <View key={b.label} style={{ alignItems: 'center', flex: 1, gap: 8 }}>
            <Pop delay={500 + i * 120}>
              <View style={styles.badge}>
                <Icon name={b.icon} size={30} color={C.navy} />
              </View>
            </Pop>
            <Txt w="semi" size={13} center>
              {b.label}
            </Txt>
          </View>
        ))}
      </View>

      <FadeIn index={7}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/family')} style={styles.family}>
          <View style={styles.familyIcon}>
            <Icon name="account-group" size={26} color={C.navy} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt w="xbold" size={17} color={C.ink}>
              Hara Ailə
            </Txt>
            <Txt w="med" size={13.5} color={C.muted}>
              {familySubscribed ? 'Aktivdir · 2 üzv' : 'Uşaq və yaşlıların səfərini izlə · 3,99 ₼/ay'}
            </Txt>
          </View>
          <Icon name="chevron-right" size={26} color={C.ink} />
        </Pressable>
      </FadeIn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  level: { marginTop: 20, borderRadius: R.card, padding: 20, backgroundColor: C.purple, overflow: 'hidden' },
  levelGlow: { position: 'absolute', right: -50, top: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(18,183,106,0.16)' },
  medal: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 12, borderRadius: 6, backgroundColor: C.purpleLight, marginTop: 18, overflow: 'hidden' },
  progressFill: { height: 12, borderRadius: 6, backgroundColor: C.brand },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  stat: { width: '48.5%', flexGrow: 1, backgroundColor: C.surface, borderRadius: R.lg, padding: 16, minHeight: 104 },
  card: { backgroundColor: C.surface, borderRadius: R.card, padding: 20, marginTop: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  badge: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  family: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.purple, borderRadius: R.lg, padding: 16, marginTop: 22 },
  familyIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
});
