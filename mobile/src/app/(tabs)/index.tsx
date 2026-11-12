import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppStore, useIsNight } from '@/store/useAppStore';
import { DESTINATIONS, RECENT_IDS, destById } from '@/data/destinations';
import { optionOf } from '@/data/routes';
import { AhmedAvatar, Avatar } from '@/components/Brand';
import { ScoreRing } from '@/components/ScoreRing';
import { Chip, CircleButton, Icon, Tag, Txt, tap } from '@/components/ui';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { C, R, shadow } from '@/theme';
import type { Profile } from '@/data/types';

const MODES: { id: Profile; label: string; icon: string; route?: string }[] = [
  { id: 'daily', label: 'Gündəlik', icon: 'walk' },
  { id: 'accessible', label: 'Əlçatan', icon: 'wheelchair-accessibility', route: '/accessible' },
  { id: 'scooter', label: 'Skuter', icon: 'scooter', route: '/scooter' },
  { id: 'family', label: 'Ailə', icon: 'account-group-outline', route: '/family' },
];

export default function Home() {
  const insets = useSafeAreaInsets();
  const night = useIsNight();
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  const setDemo = useAppStore((s) => s.setDemoPanelOpen);
  const wind = useAppStore((s) => s.windSpeed);
  const reports = useAppStore((s) => s.reports);
  const hilton = optionOf('hilton', 'safest');
  const heroScore = hilton ? (night ? hilton.scoreNight : hilton.scoreDay) : 92;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: TAB_BAR_SPACE + 20, paddingHorizontal: 18 }}
      showsVerticalScrollIndicator={false}
    >
      {/* top bar */}
      <View style={styles.row}>
        <CircleButton icon="menu" size={54} onLongPress={() => setDemo(true)} onPress={() => router.navigate('/profile')} />
        <View style={styles.topRight}>
          <CircleButton icon="bell-outline" size={44} bg={C.bg} onPress={() => router.push('/map')} />
          <Avatar size={44} />
        </View>
      </View>

      {/* greeting + search */}
      <View style={[styles.row, { marginTop: 20, alignItems: 'flex-end' }]}>
        <View style={{ flex: 1 }}>
          <Txt w="semi" size={16} color={C.ink2}>
            Salam, Aysel 👋
          </Txt>
          <Txt w="black" size={38} lh={42} style={{ marginTop: 6 }}>
            Bu gün{'\n'}hara gedirsən?
          </Txt>
        </View>
        <Pressable
          onPress={() => {
            tap();
            router.push('/ahmed?mode=text');
          }}
          style={styles.searchPill}
        >
          <Icon name="magnify" size={26} />
        </Pressable>
      </View>

      {/* modes */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 20, marginHorizontal: -18 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 18 }}>
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

      {/* hero card */}
      <LinearGradient colors={[C.brand, '#FF7A2B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.row}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Tag label={night ? 'Gecə rejimi' : 'Gündüz rejimi'} icon={night ? 'weather-night' : 'white-balance-sunny'} bg="rgba(255,255,255,0.22)" color="#fff" />
            <Tag label={`${wind} m/s külək`} icon="weather-windy" bg="rgba(255,255,255,0.22)" color="#fff" />
          </View>
          <CircleButton icon="arrow-top-right" size={46} onPress={() => router.push('/results/hilton')} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 14 }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="map-marker" size={16} color="rgba(255,255,255,0.9)" />
              <Txt w="semi" size={13.5} color="rgba(255,255,255,0.9)">
                Bakı · 28 May m. yaxınlığı
              </Txt>
            </View>
            <Txt w="black" size={30} lh={34} color="#fff" style={{ marginTop: 6 }}>
              {night ? 'Yalnız işıqlı\nküçələrlə' : 'Ən təhlükəsiz\nyolla get'}
            </Txt>
            <Txt w="med" size={14} color="rgba(255,255,255,0.9)" style={{ marginTop: 8 }}>
              {night ? 'İşıqforlu keçidlər, işıqlı səkilər' : 'Keçidlər, işıqfor və səkilər yoxlanılır'}
            </Txt>
          </View>
          <View style={styles.heroRing}>
            <ScoreRing score={heroScore} size={74} />
          </View>
        </View>

        {/* talk to Əhməd slider-like pill */}
        <Pressable
          onPress={() => {
            tap();
            router.push('/ahmed');
          }}
          style={styles.talk}
        >
          <View style={styles.talkMic}>
            <Icon name="microphone" size={26} color="#fff" />
          </View>
          <Txt w="bold" size={18} color={C.brand} style={{ letterSpacing: 2 }}>
            ›››
          </Txt>
          <View style={styles.talkAhmed}>
            <AhmedAvatar size={34} />
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end', paddingRight: 8 }}>
            <Txt w="bold" size={15} color={C.ink}>
              Əhmədə de
            </Txt>
            <Txt w="med" size={12.5} color={C.muted}>
              səslə və ya yazı ilə
            </Txt>
          </View>
        </Pressable>
      </LinearGradient>

      {/* recents */}
      <View style={[styles.row, { marginTop: 26, marginBottom: 12 }]}>
        <Txt w="xbold" size={22}>
          Son yerlər
        </Txt>
        <Pressable onPress={() => router.push('/ahmed?mode=text')}>
          <Txt w="semi" size={14} color={C.brand}>
            Hamısı
          </Txt>
        </Pressable>
      </View>
      <View style={{ gap: 10 }}>
        {RECENT_IDS.map((id) => {
          const d = destById(id)!;
          const o = optionOf(id, 'safest');
          return (
            <Pressable
              key={id}
              onPress={() => {
                tap();
                router.push(`/results/${id}`);
              }}
              style={styles.place}
            >
              <View style={styles.placeIcon}>
                <Icon name={d.icon} size={24} color={C.ink} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt w="bold" size={16.5}>
                  {d.name}
                </Txt>
                <Txt w="med" size={13.5} color={C.muted}>
                  {d.district}
                </Txt>
              </View>
              {o ? <ScoreRing score={night ? o.scoreNight : o.scoreDay} size={42} showShield={false} /> : null}
              <View style={styles.arrow}>
                <Icon name="arrow-top-right" size={20} color="#fff" />
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* nearby reports */}
      <Pressable onPress={() => router.push('/map')} style={styles.nearby}>
        <View style={styles.dot} />
        <View style={{ flex: 1 }}>
          <Txt w="bold" size={16} color="#fff">
            Yaxınlıqda {Math.min(3, reports.length)} yeni bildiriş
          </Txt>
          <Txt w="med" size={13} color="rgba(255,255,255,0.65)">
            AI təsdiqlədi · 5 dəq əvvəl
          </Txt>
        </View>
        <Icon name="chevron-right" size={24} color="#fff" />
      </Pressable>

      {/* all destinations */}
      <Txt w="xbold" size={22} style={{ marginTop: 26, marginBottom: 12 }}>
        Populyar
      </Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -18 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 18 }}>
        {DESTINATIONS.filter((d) => !RECENT_IDS.includes(d.id)).map((d) => (
          <Pressable key={d.id} onPress={() => router.push(`/results/${d.id}`)} style={styles.popular}>
            <View style={styles.placeIcon}>
              <Icon name={d.icon} size={22} />
            </View>
            <Txt w="bold" size={15} style={{ marginTop: 12 }} numberOfLines={1}>
              {d.short}
            </Txt>
            <Txt w="med" size={12.5} color={C.muted} numberOfLines={1}>
              {d.district.split(' · ')[0]}
            </Txt>
          </Pressable>
        ))}
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.surface, borderRadius: R.pill, padding: 5 },
  searchPill: {
    width: 64,
    height: 92,
    borderRadius: 32,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  hero: { marginTop: 18, borderRadius: 34, padding: 18, paddingBottom: 14 },
  heroRing: { backgroundColor: '#fff', borderRadius: 50, padding: 6, ...shadow(2) },
  talk: {
    marginTop: 18,
    height: 64,
    borderRadius: R.pill,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    gap: 10,
  },
  talkMic: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  talkAhmed: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' },
  place: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.surface,
    borderRadius: R.lg,
    padding: 10,
    paddingRight: 10,
  },
  placeIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  arrow: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.black, alignItems: 'center', justifyContent: 'center' },
  nearby: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.black,
    borderRadius: R.lg,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.brand },
  popular: { width: 140, backgroundColor: C.surface, borderRadius: R.lg, padding: 14 },
});
