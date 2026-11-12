import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { RouteKind, RouteOption } from '@/data/types';
import { SPRING } from '@/motion/springs';
import { C, R } from '@/theme';
import { ScoreRing } from './ScoreRing';
import { Icon, Txt, tap } from './ui';

/** Product wording: never "100% safe" — the safest option is "ən az riskli". */
export const KIND_LABEL: Record<RouteKind, string> = {
  safest: 'Ən az riskli',
  cheapest: 'Ən sərfəli',
  fastest: 'Ən sürətli',
};

const MODE_ICON: Record<string, string> = {
  walk: 'walk',
  metro: 'subway-variant',
  bus: 'bus',
  taxi: 'taxi',
  scooter: 'scooter',
  bike: 'bike',
};
const MODE_TINT: Record<string, { bg: string; fg: string }> = {
  walk: { bg: C.bg2, fg: C.ink },
  metro: { bg: '#F5E9EF', fg: C.underground },
  bus: { bg: '#EAF2FF', fg: C.route },
  taxi: { bg: C.bg2, fg: C.navy },
  scooter: { bg: C.brandSoft, fg: C.brandDark },
  bike: { bg: C.brandSoft, fg: C.brandDark },
};

/** "Qarşı tərəfdə düşürür · 6 zolaq" when the last-meters analysis flags the drop-off. */
export function lastMetersLabel(o: RouteOption) {
  const lm = o.lastMeters;
  if (!lm) return null;
  if (lm.wrongSide) return `Qarşı tərəfdə düşürür · ${lm.lanes} zolaq`;
  return null;
}

function ModeChain({ option, color = C.muted }: { option: RouteOption; color?: string }) {
  const legs = option.legs.filter((l, i) => l.mode !== 'walk' || l.distanceM >= 60 || option.legs.length === 1 || i === 0);
  return (
    <View style={styles.chain}>
      {legs.map((l, i) => {
        const t = MODE_TINT[l.mode] ?? MODE_TINT.walk;
        return (
          <React.Fragment key={i}>
            {i > 0 ? <Icon name="chevron-right" size={14} color={C.faint} /> : null}
            <View style={[styles.mode, { backgroundColor: t.bg }]}>
              <Icon name={MODE_ICON[l.mode] ?? 'walk'} size={15} color={t.fg} />
              <Txt w="bold" size={11.5} color={t.fg}>
                {Math.max(1, Math.round(l.durationMin))}
              </Txt>
            </View>
          </React.Fragment>
        );
      })}
      <Txt w="med" size={12.5} color={color} numberOfLines={1} style={{ flexShrink: 1, marginLeft: 2 }}>
        {option.co2g > 0 ? `${option.co2g} q CO₂` : '0 q CO₂'}
      </Txt>
    </View>
  );
}

function RiskChip({ label, tone, onPress }: { label: string; tone: 'danger' | 'warn' | 'safe'; onPress?: () => void }) {
  const bg = tone === 'danger' ? C.dangerSoft : tone === 'warn' ? C.warnSoft : C.safeSoft;
  const fg = tone === 'danger' ? '#B4232A' : tone === 'warn' ? '#8A5A00' : '#0A7A47';
  const icon = tone === 'safe' ? 'shield-check-outline' : 'alert-outline';
  const body = (
    <>
      <Icon name={icon} size={14} color={fg} />
      <Txt w="semi" size={12.5} color={fg} numberOfLines={1} style={{ flexShrink: 1 }}>
        {label}
      </Txt>
      {onPress ? <Icon name="chevron-right" size={15} color={fg} /> : null}
    </>
  );
  if (onPress)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}. Son 50 metrə bax`}
        hitSlop={6}
        onPress={() => {
          tap();
          onPress();
        }}
        style={({ pressed }) => [styles.chip, { backgroundColor: bg, borderColor: fg + '33', opacity: pressed ? 0.8 : 1 }]}
      >
        {body}
      </Pressable>
    );
  return <View style={[styles.chip, { backgroundColor: bg }]}>{body}</View>;
}

/**
 * Premium route card: score ring, kind, mode chain with minutes, price, CO₂ and risk chips.
 * Selected state springs (lift + blue outline). Taxi cards with a last-meters warning get a
 * tappable chip that opens the "Son 50 metr" view.
 */
export const RouteCard = React.memo(function RouteCard({
  option,
  night,
  selected,
  recommended,
  onPress,
  onLastMeters,
  ringDelay = 0,
}: {
  option: RouteOption;
  night: boolean;
  selected: boolean;
  recommended?: boolean;
  onPress: () => void;
  onLastMeters?: () => void;
  ringDelay?: number;
}) {
  const s = night ? option.scoreNight : option.scoreDay;
  const v = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    v.value = withSpring(selected ? 1 : 0, SPRING.bouncy);
  }, [selected, v]);
  const a = useAnimatedStyle(() => ({
    borderColor: interpolateColor(v.value, [0, 1], ['rgba(31,111,235,0)', C.route]),
    backgroundColor: interpolateColor(v.value, [0, 1], [C.surface, '#F2F7FF']),
    transform: [{ scale: interpolate(v.value, [0, 1], [0.985, 1]) }],
  }));
  const lm = lastMetersLabel(option);
  const chip: { label: string; tone: 'danger' | 'warn' | 'safe'; press?: () => void } | null = lm
    ? { label: lm, tone: 'danger', press: onLastMeters }
    : option.warning
      ? { label: option.warning, tone: option.kind === 'fastest' ? 'warn' : 'danger' }
      : option.unsignalized === 0
        ? { label: option.avoided > 0 ? `${option.avoided} riskli keçiddən yan keçir` : 'İşıqforsuz keçid yoxdur', tone: 'safe' }
        : option.reasons.length
          ? { label: option.reasons[option.reasons.length - 1], tone: 'safe' }
          : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${KIND_LABEL[option.kind]}, ${option.durationMin} dəqiqə, ${option.price}, bal ${s}`}
      onPress={() => {
        tap();
        onPress();
      }}
    >
      <Animated.View style={[styles.card, a]}>
        <ScoreRing score={s} size={58} showShield={false} delay={ringDelay} />
        <View style={{ flex: 1, gap: 7 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Txt w="xbold" size={16.5} numberOfLines={1} style={{ flexShrink: 1 }}>
              {KIND_LABEL[option.kind]}
            </Txt>
            {recommended ? (
              <View style={styles.rec}>
                <Icon name="star-four-points" size={11} color={C.onBrand} />
                <Txt w="bold" size={10.5} color={C.onBrand} ls={0.6}>
                  ƏHMƏD SEÇDİ
                </Txt>
              </View>
            ) : null}
          </View>
          <ModeChain option={option} />
          {chip ? <RiskChip label={chip.label} tone={chip.tone} onPress={chip.press} /> : null}
        </View>
        <View style={{ alignItems: 'flex-end', minWidth: 64 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
            <Txt v="num" size={26} lh={30}>
              {option.durationMin}
            </Txt>
            <Txt w="semi" size={13} color={C.muted}>
              dəq
            </Txt>
          </View>
          <Txt w="bold" size={14} color={C.ink2} style={{ marginTop: 2 }}>
            {option.price}
          </Txt>
        </View>
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: R.lg,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 2,
  },
  chain: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'nowrap' },
  mode: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 24, paddingHorizontal: 6, borderRadius: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rec: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 20, paddingHorizontal: 7, borderRadius: 10, backgroundColor: C.ai },
});
