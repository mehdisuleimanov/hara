import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronFlow, FadeIn, Float, MarchingPath, Pulse } from '@/components/anim';
import { useAppStore, useIsNight } from '@/store/useAppStore';
import { DESTINATIONS, RECENT_IDS, destById } from '@/data/destinations';
import { optionOf } from '@/data/routes';
import { AhmedAvatar, Avatar, HaraWordmark } from '@/components/Brand';
import { ScoreRing } from '@/components/ScoreRing';
import { Chevrons, Chip, CircleButton, Heading, Icon, Tag, Txt, tap } from '@/components/ui';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { fmtDist } from '@/utils/geo';
import { C, R } from '@/theme';
import type { Profile } from '@/data/types';

const MODES: { id: Profile; label: string; icon: string; route?: string }[] = [
  { id: 'daily', label: 'Piyada', icon: 'walk' },
  { id: 'accessible', label: 'Əlçatan', icon: 'wheelchair-accessibility', route: '/accessible' },
  { id: 'scooter', label: 'Skuter', icon: 'scooter', route: '/scooter' },
  { id: 'family', label: 'Ailə', icon: 'account-group-outline', route: '/family' },
];

export default function Home() {
  const insets = useSafeAreaInsets();
  const night = useIsNight();
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  const hero = destById('hilton')!;
  const opt = optionOf('hilton', 'safest');
  const heroScore = opt ? (night ? opt.scoreNight : opt.scoreDay) : 92;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: TAB_BAR_SPACE + 24, paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false}
    >
      {/* top bar: gray menu circle · pill with "··" + avatar */}
      <View style={styles.row}>
        <CircleButton icon="menu" size={56} bg={C.bg2} onPress={() => router.navigate('/profile')} />
        <HaraWordmark width={96} />
        <View style={styles.topRight}>
          <CircleButton icon="dots-horizontal" size={52} bg={C.bg2} label="Daha çox" onPress={() => router.navigate('/map')} />
          <Avatar size={56} />
        </View>
      </View>

      {/* greeting + heading + tall search pill */}
      <FadeIn index={0}>
      <View style={[styles.row, { marginTop: 22, alignItems: 'center' }]}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Txt w="semi" size={15} color={C.ink2}>
            Salam, Aysel
          </Txt>
          <Heading light="Bakıda Təhlükəsiz" bold="Yol Tap" size={34} newline style={{ marginTop: 8 }} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Axtar"
          onPress={() => {
            tap();
            router.push('/ahmed?mode=text');
          }}
          style={({ pressed }) => [styles.searchPill, { opacity: pressed ? 0.75 : 1 }]}
        >
          <Icon name="magnify" size={26} />
        </Pressable>
      </View>
      </FadeIn>

      {/* modes: active = white pill with amber disc; others = round */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 20, marginHorizontal: -16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
        {MODES.map((m) => (
          <Chip
            key={m.id}
            label={m.label}
            icon={m.icon}
            active={profile === m.id}
            onPress={() => {
              setProfile(m.id);
              if (m.route) router.push(m.route as never);
            }}
          />
        ))}
      </ScrollView>

      {/* purple hero card */}
      <FadeIn index={2}>
      <View style={styles.hero}>
        <View style={styles.row}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Tag label={`${opt?.durationMin ?? 14} dəq`} bg={C.purpleLight} color={C.ink} style={styles.heroTag} />
            <Tag label={night ? 'Gecə rejimi' : 'Ən təhlükəsiz'} bg={C.purpleLight} color={C.ink} style={styles.heroTag} />
          </View>
          <CircleButton icon="arrow-top-right" size={52} onPress={() => router.push('/results/hilton')} />
        </View>

        <View style={{ marginTop: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="map-marker-outline" size={16} />
            <Txt w="semi" size={13.5} color={C.ink2}>
              Bakı · {hero.district.split(' · ')[0]}
            </Txt>
          </View>
          <Heading light={hero.name.split(' ')[0]} bold={hero.name.split(' ').slice(1).join(' ')} size={32} newline style={{ marginTop: 4 }} />
        </View>

        {/* illustration panel (reference: 3D bus) — Əhməd + dashed path + pin */}
        <View style={styles.illu}>
          <MarchingPath d="M4 62 C 40 60, 60 20, 100 26 S 138 12, 142 10" width={150} height={70} />
          <View style={styles.illuPin}>
            <Icon name="map-marker" size={30} color={C.ink} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
            <Float>
              <AhmedAvatar size={104} full />
            </Float>
            <View style={{ paddingBottom: 12 }}>
              <ScoreRing score={heroScore} size={62} />
            </View>
          </View>
        </View>

        {/* reference bottom row: amber slider · ››› · white disc · black clock disc · hours/km */}
        <View style={styles.heroBottom}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Əhmədə səslə de"
            onPress={() => {
              tap();
              router.push('/ahmed');
            }}
            style={styles.slideKnobWrap}
          >
            <Pulse size={52} color={C.navy} style={{ right: 6 }} />
            <View style={styles.slideKnob}>
              <Icon name="microphone" size={24} />
            </View>
          </Pressable>
          <ChevronFlow color={C.ink} />
          <CircleButton icon="map-marker-path" size={52} label="Marşrutlar" onPress={() => router.push('/results/hilton')} />
          <View style={styles.clock}>
            <Icon name="clock-outline" size={24} color={C.brand} />
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Txt w="med" size={12.5} color={C.ink2}>
              {opt?.durationMin ?? 14} dəqiqə
            </Txt>
            <Txt w="bold" size={15}>
              {fmtDist(opt?.distanceM ?? 1100)}
            </Txt>
          </View>
        </View>
      </View>
      </FadeIn>

      {/* reference second row: "12 days · Both Ways ↗" */}
      <FadeIn index={3}>
      <View style={styles.subRow}>
        <Tag label={night ? 'İşıqlı küçələr' : 'İşıqforlu keçidlər'} bg={C.bg2} color={C.ink} style={styles.subTag} />
        <Tag label="Pilləkənsiz" bg={C.bg2} color={C.ink} style={styles.subTag} />
        <View style={{ flex: 1 }} />
        <CircleButton icon="arrow-top-right" size={48} bg={C.bg2} onPress={() => router.push('/accessible')} />
      </View>
      </FadeIn>

      {/* recents */}
      <View style={[styles.row, { marginTop: 24, marginBottom: 12 }]}>
        <Heading bold="Son yerlər" size={22} />
        <Pressable accessibilityRole="button" onPress={() => router.push('/ahmed?mode=text')} hitSlop={8} style={styles.allBtn}>
          <Txt w="semi" size={13.5}>
            Hamısı
          </Txt>
          <Icon name="arrow-right" size={16} />
        </Pressable>
      </View>
      <View style={{ gap: 10 }}>
        {[...RECENT_IDS, ...DESTINATIONS.filter((d) => !RECENT_IDS.includes(d.id) && d.id !== 'hilton').map((d) => d.id).slice(0, 2)].map((id, idx) => {
          const d = destById(id)!;
          const o = optionOf(id, 'safest');
          return (
            <FadeIn key={id} index={4 + idx}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${d.name}, ${d.district}`}
              onPress={() => {
                tap();
                router.push(`/results/${id}`);
              }}
              style={({ pressed }) => [styles.place, { opacity: pressed ? 0.85 : 1 }]}
            >
              <View style={styles.placeIcon}>
                <Icon name={d.icon} size={24} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt w="bold" size={16}>
                  {d.name}
                </Txt>
                <Txt w="med" size={13.5} color={C.muted}>
                  {d.district}
                </Txt>
              </View>
              {o ? <ScoreRing score={night ? o.scoreNight : o.scoreDay} size={44} showShield={false} /> : null}
              <View style={styles.arrow}>
                <Icon name="arrow-top-right" size={20} color={C.brand} />
              </View>
            </Pressable>
            </FadeIn>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topRight: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg2, borderRadius: R.pill, paddingLeft: 2 },
  searchPill: {
    width: 64,
    height: 100,
    borderRadius: 32,
    backgroundColor: C.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { marginTop: 18, borderRadius: R.card, padding: 16, backgroundColor: C.purple },
  heroTag: { height: 40, paddingHorizontal: 16 },
  illu: {
    marginTop: 14,
    height: 132,
    borderRadius: 26,
    backgroundColor: C.purpleLight,
    paddingHorizontal: 16,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  illuPin: { position: 'absolute', right: 14, top: 0 },
  heroBottom: {
    marginTop: 12,
    height: 64,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 14,
  },
  slideKnobWrap: { height: 64, width: 108, borderRadius: R.pill, backgroundColor: C.brand, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 6 },
  slideKnob: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  clock: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.black, alignItems: 'center', justifyContent: 'center' },
  subRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface, borderRadius: R.pill, padding: 8 },
  subTag: { height: 44, paddingHorizontal: 18 },
  allBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.surface, borderRadius: R.pill, paddingHorizontal: 14, height: 40 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surface, borderRadius: R.lg, padding: 10 },
  placeIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  arrow: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.black, alignItems: 'center', justifyContent: 'center' },
});
