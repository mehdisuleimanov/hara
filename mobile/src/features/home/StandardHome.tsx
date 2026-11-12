import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAppStore, useIsNight } from '@/store/useAppStore';
import { useWeather } from '@/utils/weather';
import { Avatar, HaraWordmark } from '@/components/Brand';
import { DevTrigger } from '@/components/DevTrigger';
import { Icon, Txt } from '@/components/ui';
import { useTabBarSpace } from '@/components/TabBar';
import { PressableScale, Skeleton, enter } from '@/motion';
import { C, R } from '@/theme';
import { AhmedHero } from './AhmedHero';
import { FeatureGrid } from './FeatureGrid';
import { RiskInsight } from './RiskInsight';
import { RecentPlaces } from './RecentPlaces';
import { TopFade } from './TopFade';
import { SuggestionCard } from './SuggestionCard';
import { USER_NAME, ahmedLine, greeting, nearbyReports } from './context';
import { upperAz } from '@/features/a11y/text';

const fmt1 = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

function weatherIcon(w: { isDay: boolean; precipitation: number; windSpeed: number }) {
  if (w.precipitation > 0.2) return 'weather-pouring';
  if (w.windSpeed >= 8) return 'weather-windy';
  return w.isDay ? 'weather-sunny' : 'weather-night';
}

/** AI-first home: Əhməd is the hero, the map is one tap away (not the other way round). */
export function StandardHome() {
  const insets = useSafeAreaInsets();
  const night = useIsNight();
  const weather = useWeather();
  const reports = useAppStore((s) => s.reports);
  const nearby = useMemo(() => nearbyReports(reports).length, [reports]);
  const line = ahmedLine(weather, night);
  const tabSpace = useTabBarSpace();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: tabSpace + 12, paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false}
    >
      {/* top bar */}
      <Animated.View entering={enter(0, 'fade')} style={styles.top}>
        <DevTrigger style={{ paddingVertical: 6 }}>
          <HaraWordmark width={88} />
        </DevTrigger>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {weather ? (
            <View style={styles.weather} accessible accessibilityLabel={`Bakı: ${weather.tempC} dərəcə, külək ${fmt1(weather.windSpeed)} metr saniyədə`}>
              <Icon name={weatherIcon(weather)} size={18} color={weather.windSpeed >= 8 ? C.route : C.ink} />
              <Txt w="bold" size={14}>
                {weather.tempC}°
              </Txt>
              <View style={styles.dot} />
              <Txt w="semi" size={13} color={C.ink2}>
                {fmt1(weather.windSpeed)} m/s
              </Txt>
            </View>
          ) : (
            <Skeleton width={112} height={40} radius={20} />
          )}
          <PressableScale accessibilityRole="button" accessibilityLabel="Profil" scaleTo={0.9} onPress={() => router.navigate('/profile')}>
            <Avatar size={44} />
          </PressableScale>
        </View>
      </Animated.View>

      {/* greeting */}
      <Animated.View entering={enter(0)} style={{ marginTop: 18 }}>
        <Txt v="overline" color={C.muted}>
          {upperAz(`${greeting()}, ${USER_NAME}`)}
        </Txt>
        <Txt v="hero" style={{ marginTop: 6 }} accessibilityRole="header">
          Hara gedirsən?
        </Txt>
      </Animated.View>

      <View style={{ marginTop: 16 }}>
        <AhmedHero line={line} />
      </View>

      {/* live context */}
      <Animated.View entering={enter(2)}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginHorizontal: -16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          <View style={styles.chip}>
            <Icon name={night ? 'weather-night' : 'white-balance-sunny'} size={16} color={night ? C.ai : C.warn} />
            <Txt w="semi" size={13}>
              {night ? 'Gecə · işıqlı yollar seçilir' : 'Gündüz · bütün yollar açıq'}
            </Txt>
          </View>
          <View style={styles.chip}>
            <Icon name="weather-windy" size={16} color={C.route} />
            <Txt w="semi" size={13}>
              {weather ? `Külək ${fmt1(weather.windSpeed)} m/s` : 'Külək yoxlanılır'}
            </Txt>
          </View>
          <PressableScale scaleTo={0.95} accessibilityRole="button" onPress={() => router.navigate('/map')} style={styles.chip}>
            <Icon name="bell-alert-outline" size={16} color={C.danger} />
            <Txt w="semi" size={13}>
              Yaxınlıqda {nearby} bildiriş
            </Txt>
          </PressableScale>
        </ScrollView>
      </Animated.View>

      {/* proactive tip */}
      <View style={{ marginTop: 14 }}>
        <SuggestionCard night={night} base={3} />
      </View>

      {/* features */}
      <Animated.View entering={enter(3)} style={styles.section}>
        <Txt v="h3">Əhməd daha nə bacarır</Txt>
      </Animated.View>
      <FeatureGrid base={3} />

      {/* safety-layer insight */}
      <View style={{ marginTop: 22 }}>
        <RiskInsight night={night} base={6} />
      </View>

      {/* recents */}
      <Animated.View entering={enter(7)} style={[styles.section, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <Txt v="h3">Son yerlər</Txt>
        <PressableScale scaleTo={0.94} accessibilityRole="button" onPress={() => router.navigate('/map')} style={styles.all}>
          <Txt w="semi" size={13}>
            Xəritə
          </Txt>
          <Icon name="arrow-right" size={15} />
        </PressableScale>
      </Animated.View>
      <RecentPlaces night={night} base={8} />
    </ScrollView>
    <TopFade />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weather: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: R.pill, backgroundColor: C.surface },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.faint },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 38, paddingHorizontal: 14, borderRadius: R.pill, backgroundColor: C.surface },
  section: { marginTop: 24, marginBottom: 12 },
  all: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.surface, borderRadius: R.pill, paddingHorizontal: 14, height: 36 },
});
