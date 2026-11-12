import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { RouteOption } from '@/data/types';
import { KIND_TITLE, summary } from '@/data/routes';
import { C, R } from '@/theme';
import { ScoreRing } from './ScoreRing';
import { Icon, Tag, Txt, tap } from './ui';

const MODE_ICON: Record<string, string> = {
  walk: 'walk',
  metro: 'subway-variant',
  bus: 'bus',
  taxi: 'taxi',
  scooter: 'scooter',
  bike: 'bike',
};
const MODE_BG: Record<string, string> = {
  walk: C.brandSoft,
  metro: '#FDE3E6',
  bus: '#E3ECFD',
  taxi: '#EBEBEE',
  scooter: C.brandSoft,
  bike: C.brandSoft,
};

export const RouteCard = React.memo(function RouteCard({
  option,
  night,
  selected,
  recommended,
  onPress,
}: {
  option: RouteOption;
  night: boolean;
  selected: boolean;
  recommended?: boolean;
  onPress: () => void;
}) {
  const s = night ? option.scoreNight : option.scoreDay;
  const modes = option.legs.filter((l) => l.mode !== 'walk' || l.distanceM >= 60).map((l) => l.mode);
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={[styles.card, selected && styles.selected]}
    >
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {recommended ? <Tag label="TÖVSİYƏ" bg={C.brand} color={C.navy} style={{ height: 24 }} /> : null}
          <Txt w="xbold" size={19}>
            {KIND_TITLE[option.kind]}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {modes.map((m, i) => (
            <React.Fragment key={i}>
              {i > 0 ? <Icon name="plus" size={14} color={C.muted} /> : null}
              <View style={[styles.modeIcon, { backgroundColor: MODE_BG[m] }]}>
                <Icon name={MODE_ICON[m]} size={17} color={m === 'metro' ? C.metro : m === 'bus' ? C.bus : C.ink} />
              </View>
            </React.Fragment>
          ))}
          <Txt w="med" size={13.5} color={C.muted} style={{ flexShrink: 1 }} numberOfLines={1}>
            {summary(option)}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Txt w="xbold" size={17}>
            {option.durationMin} dəq · {option.price}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Icon name="leaf" size={14} color={option.co2g === 0 ? C.safe : C.muted} />
            <Txt w="semi" size={13} color={option.co2g === 0 ? C.safe : C.muted}>
              {option.co2g === 0 ? '0 CO₂' : `${option.co2g} q CO₂`}
            </Txt>
          </View>
        </View>
        {option.warning ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="alert-outline" size={16} color={C.danger} />
            <Txt w="semi" size={13.5} color={C.danger} style={{ flexShrink: 1 }}>
              {option.warning}
            </Txt>
          </View>
        ) : option.reasons.length ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="check-circle-outline" size={16} color={C.safe} />
            <Txt w="semi" size={13.5} color={C.safe} style={{ flexShrink: 1 }} numberOfLines={1}>
              {option.reasons[option.reasons.length - 1]}
            </Txt>
          </View>
        ) : null}
      </View>
      <ScoreRing score={s} size={70} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.surface,
    borderRadius: R.lg,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selected: { borderColor: C.brand, backgroundColor: C.brandSofter },
  modeIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
