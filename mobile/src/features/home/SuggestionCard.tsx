import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { optionOf, summary } from '@/data/routes';
import { ScoreRing } from '@/components/ScoreRing';
import { Icon, Txt } from '@/components/ui';
import { PressableScale, enter } from '@/motion';
import { upperAz } from '@/features/a11y/text';
import { C, R } from '@/theme';

/**
 * Proactive tip from Əhməd for the most frequent trip: the safest option, and why the
 * "fastest" taxi is a trap (drop-off on the far side of a 6-lane avenue). Data-driven.
 */
export function SuggestionCard({ night, base = 0 }: { night: boolean; base?: number }) {
  const safe = optionOf('hilton', 'safest');
  const taxi = optionOf('hilton', 'fastest');
  if (!safe) return null;
  const sc = night ? safe.scoreNight : safe.scoreDay;
  return (
    <Animated.View entering={enter(base)}>
      <PressableScale
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={`Əhmədin təklifi: Hiltona ${summary(safe)}, ${safe.durationMin} dəqiqə`}
        onPress={() => router.push('/results/hilton')}
        style={styles.card}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="creation" size={15} color={C.ai} />
              <Txt v="overline" color={C.ai}>
                {upperAz('Əhmədin təklifi')}
              </Txt>
            </View>
            <Txt w="xbold" size={18} style={{ marginTop: 6 }}>
              {night ? 'Bu gecə Hiltona' : 'Bu gün Hiltona'}
            </Txt>
            <Txt w="semi" size={13.5} color={C.ink2} style={{ marginTop: 2 }} numberOfLines={1}>
              {summary(safe)}
            </Txt>
          </View>
          <ScoreRing score={sc} size={58} />
        </View>
        <View style={styles.tags}>
          <View style={styles.tag}>
            <Icon name="clock-outline" size={14} color={C.ink} />
            <Txt w="bold" size={12.5}>
              {safe.durationMin} dəq
            </Txt>
          </View>
          <View style={styles.tag}>
            <Icon name="ticket-outline" size={14} color={C.ink} />
            <Txt w="bold" size={12.5}>
              {safe.price === '0 ₼' ? 'pulsuz' : safe.price}
            </Txt>
          </View>
          <View style={[styles.tag, { backgroundColor: C.safeSoft }]}>
            <Icon name="shield-check" size={14} color={C.safe} />
            <Txt w="bold" size={12.5} color={C.safe}>
              ən az riskli
            </Txt>
          </View>
        </View>
        {taxi?.warning ? (
          <View style={styles.warn}>
            <Icon name="taxi" size={18} color={C.danger} />
            <Txt w="semi" size={13} color={C.ink2} style={{ flex: 1 }}>
              Taksi daha tez çatdırır, amma səni Azadlıq prospektinin o biri tərəfində düşürür — 6 zolaq.
            </Txt>
            <Icon name="arrow-right" size={18} color={C.ink} />
          </View>
        ) : null}
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: R.card, padding: 16, borderWidth: 1.5, borderColor: C.line },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingHorizontal: 10, borderRadius: R.pill, backgroundColor: C.surface },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, backgroundColor: C.dangerSoft, borderRadius: R.md, padding: 10 },
});
