import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppStore } from '@/store/useAppStore';
import { Avatar } from '@/components/Brand';
import { CircleButton, Icon, Txt } from '@/components/ui';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { C, R } from '@/theme';

const WEEK = [5, 8, 3, 9, 7, 4, 10];
const DAYS = ['B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş', 'B'];
const BADGES = [
  { icon: 'weather-night', label: 'Gecə qoruyucusu', color: C.brand },
  { icon: 'elevator-passenger-outline', label: 'Lift ovçusu', color: C.ink },
  { icon: 'leaf', label: 'Yaşıl addım', color: C.safe },
];

export default function Profile() {
  const insets = useSafeAreaInsets();
  const points = useAppStore((s) => s.points);
  const reportsMade = useAppStore((s) => s.reportsMade);
  const helped = useAppStore((s) => s.helped);
  const familySubscribed = useAppStore((s) => s.familySubscribed);
  const setDemo = useAppStore((s) => s.setDemoPanelOpen);
  const levelMax = 2000;
  const pct = Math.min(1, points / levelMax);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: TAB_BAR_SPACE + 20 }}
    >
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
        <CircleButton icon="cog-outline" size={50} onLongPress={() => setDemo(true)} />
      </View>

      <LinearGradient colors={[C.brand, '#FF7A2B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.level}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={styles.medal}>
            <Icon name="medal-outline" size={30} color={C.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt w="black" size={22} color="#fff">
              Şəhər Qəhrəmanı
            </Txt>
            <Txt w="semi" size={14} color="rgba(255,255,255,0.85)">
              Səviyyə 4
            </Txt>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
        </View>
        <Txt w="semi" size={13.5} color="rgba(255,255,255,0.9)" style={{ marginTop: 8 }}>
          {points.toLocaleString('en-US')} / {levelMax.toLocaleString('en-US')} xal · növbəti: Səviyyə 5
        </Txt>
      </LinearGradient>

      <View style={styles.grid}>
        {[
          { n: String(reportsMade), l: 'bildiriş' },
          { n: helped.toLocaleString('en-US'), l: 'nəfərə kömək' },
          { n: '17', l: 'təhlükəli keçiddən yan keçdin' },
          { n: '6,4 kq', l: 'CO₂ qənaət' },
        ].map((s) => (
          <View key={s.l} style={styles.stat}>
            <Txt w="black" size={30}>
              {s.n}
            </Txt>
            <Txt w="med" size={13.5} color={C.muted}>
              {s.l}
            </Txt>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Txt w="xbold" size={20}>
          Bu həftə
        </Txt>
        <View style={styles.chart}>
          {WEEK.map((v, i) => (
            <View key={i} style={{ alignItems: 'center', gap: 6, flex: 1 }}>
              <View style={[styles.bar, { height: 14 + v * 9, backgroundColor: i === WEEK.length - 1 ? C.brand : C.brandSoft }]} />
              <Txt w="semi" size={11.5} color={C.muted}>
                {DAYS[i]}
              </Txt>
            </View>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 }}>
        {BADGES.map((b) => (
          <View key={b.label} style={{ alignItems: 'center', flex: 1, gap: 8 }}>
            <View style={styles.badge}>
              <Icon name={b.icon} size={30} color={b.color} />
            </View>
            <Txt w="semi" size={13} center>
              {b.label}
            </Txt>
          </View>
        ))}
      </View>

      <Pressable onPress={() => router.push('/family')} style={styles.family}>
        <View style={styles.familyIcon}>
          <Icon name="account-group" size={26} color={C.black} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt w="xbold" size={17} color="#fff">
            Hara Ailə
          </Txt>
          <Txt w="med" size={13.5} color="rgba(255,255,255,0.65)">
            {familySubscribed ? 'Aktivdir · 2 üzv' : 'Uşaq və yaşlıların səfərini izlə · 3,99 ₼/ay'}
          </Txt>
        </View>
        <Icon name="chevron-right" size={26} color="#fff" />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  level: { marginTop: 20, borderRadius: R.card, padding: 20 },
  medal: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.3)', marginTop: 18, overflow: 'hidden' },
  progressFill: { height: 12, borderRadius: 6, backgroundColor: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  stat: { width: '48.5%', flexGrow: 1, backgroundColor: C.surface, borderRadius: R.lg, padding: 16, minHeight: 104 },
  card: { backgroundColor: C.surface, borderRadius: R.card, padding: 20, marginTop: 12 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 130, marginTop: 14 },
  bar: { width: 22, borderRadius: 11 },
  badge: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  family: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.black,
    borderRadius: R.lg,
    padding: 16,
    marginTop: 22,
  },
  familyIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
});
