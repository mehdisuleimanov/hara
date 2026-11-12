import React from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { Icon, Txt } from '@/components/ui';
import { PressableScale, enter } from '@/motion';
import { morphTo } from '@/features/a11y/morph';
import { pointOf } from '@/features/a11y/Speak';
import { C, R } from '@/theme';

type Tile = {
  key: string;
  title: string;
  sub: string;
  icon: string;
  bg: string;
  disc: string;
  iconColor: string;
  fg: string;
  subFg: string;
  tag?: string;
  onPress: (e?: GestureResponderEvent) => void;
};

const TILES: Tile[] = [
  {
    key: 'scan',
    title: 'AI Göz',
    sub: 'Keçidi kameraya göstər, riskini deyim',
    icon: 'cube-scan',
    bg: C.navy,
    disc: C.brand,
    iconColor: '#FFFFFF',
    fg: '#FFFFFF',
    subFg: 'rgba(255,255,255,0.72)',
    tag: 'Yeni',
    onPress: () => router.push('/scan'),
  },
  {
    key: 'simple',
    title: 'Sadə rejim',
    sub: 'Bir toxunuşla böyük yazı və səs',
    icon: 'human-cane',
    bg: C.brandSoft,
    disc: '#FFFFFF',
    iconColor: C.brandDark,
    fg: C.ink,
    subFg: C.ink2,
    onPress: (e) => morphTo('senior', pointOf(e)),
  },
  {
    key: 'city',
    title: 'Şəhər paneli',
    sub: 'Bakının ən riskli keçidləri',
    icon: 'city-variant-outline',
    bg: C.purple,
    disc: '#FFFFFF',
    iconColor: C.route,
    fg: C.ink,
    subFg: C.ink2,
    onPress: () => router.push('/city'),
  },
  {
    key: 'family',
    title: 'Ailə',
    sub: 'Yaxınların yolda, sən rahat',
    icon: 'account-heart-outline',
    bg: C.aiSoft,
    disc: '#FFFFFF',
    iconColor: C.ai,
    fg: C.ink,
    subFg: C.ink2,
    onPress: () => router.push('/family'),
  },
];

/** "Əhməd daha nə bacarır" — 2×2 feature tiles. */
export function FeatureGrid({ base = 0 }: { base?: number }) {
  return (
    <View style={styles.grid}>
      {TILES.map((t, i) => (
        <Animated.View key={t.key} entering={enter(base + i)} style={styles.cell}>
          <PressableScale
            haptic={t.key === 'simple' ? 'medium' : 'light'}
            accessibilityRole="button"
            accessibilityLabel={`${t.title}. ${t.sub}`}
            onPress={(e) => t.onPress(e)}
            style={[styles.tile, { backgroundColor: t.bg }]}
          >
            <View style={styles.top}>
              <View style={[styles.disc, { backgroundColor: t.disc }]}>
                <Icon name={t.icon} size={24} color={t.iconColor} />
              </View>
              {t.tag ? (
                <View style={styles.tag}>
                  <Txt w="bold" size={11} color={C.navy}>
                    {t.tag}
                  </Txt>
                </View>
              ) : (
                <Icon name="arrow-top-right" size={20} color={t.fg} style={{ opacity: 0.55 }} />
              )}
            </View>
            <Txt w="xbold" size={17} color={t.fg} style={{ marginTop: 14 }} numberOfLines={1}>
              {t.title}
            </Txt>
            <Txt w="med" size={12.5} lh={17} color={t.subFg} style={{ marginTop: 3 }} numberOfLines={2}>
              {t.sub}
            </Txt>
          </PressableScale>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '48.5%', flexGrow: 1 },
  tile: { borderRadius: R.lg, padding: 14, minHeight: 142 },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  disc: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  tag: { backgroundColor: C.brand, borderRadius: R.pill, paddingHorizontal: 10, height: 24, alignItems: 'center', justifyContent: 'center' },
});
