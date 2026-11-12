import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { destById, RECENT_IDS } from '@/data/destinations';
import { optionOf } from '@/data/routes';
import { ScoreRing } from '@/components/ScoreRing';
import { Icon, Txt } from '@/components/ui';
import { PressableScale, enter } from '@/motion';
import { C, R } from '@/theme';

const IDS = [...RECENT_IDS.filter((id) => id !== 'hilton'), 'hilton', 'icherisheher'].slice(0, 4);

/** Recent places with the safest option's live day/night score ring. */
export function RecentPlaces({ night, base = 0 }: { night: boolean; base?: number }) {
  return (
    <View style={{ gap: 8 }}>
      {IDS.map((id, i) => {
        const d = destById(id);
        if (!d) return null;
        const o = optionOf(id, 'safest');
        const sc = o ? (night ? o.scoreNight : o.scoreDay) : null;
        return (
          <Animated.View key={id} entering={enter(base + i)}>
            <PressableScale
              scaleTo={0.98}
              accessibilityRole="button"
              accessibilityLabel={`${d.name}. ${o ? `${o.durationMin} dəqiqə, bal ${sc}` : d.district}`}
              onPress={() => router.push(`/results/${id}`)}
              style={styles.row}
            >
              <View style={styles.icon}>
                <Icon name={d.icon} size={24} color={C.ink} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt w="bold" size={16} numberOfLines={1}>
                  {d.name}
                </Txt>
                <Txt w="med" size={13} color={C.muted} numberOfLines={1}>
                  {o ? `${o.durationMin} dəq · ${o.price === "0 ₼" ? "pulsuz" : o.price} · ən az riskli` : d.district}
                </Txt>
              </View>
              {sc != null ? <ScoreRing score={sc} size={46} showShield={false} /> : null}
            </PressableScale>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: R.lg, padding: 10, paddingRight: 12 },
  icon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});
