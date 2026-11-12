import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { Icon, Txt } from '@/components/ui';
import { AnimatedNumber, PressableScale, Skeleton, enter } from '@/motion';
import { C, R } from '@/theme';
import { riskiestCrossings, type RiskSpot } from './context';

/** "Bu gecə ən riskli 3 keçid" — computed on-device from the real safety layer. */
export function RiskInsight({ night, base = 0 }: { night: boolean; base?: number }) {
  const [data, setData] = useState<{ spots: RiskSpot[]; total: number } | null>(null);
  useEffect(() => {
    let alive = true;
    // the 1.6 MB layer parses lazily — let the entrance animations finish first
    const id = setTimeout(() => {
      try {
        const r = riskiestCrossings(3, true);
        if (alive) setData(r);
      } catch {
        if (alive) setData({ spots: [], total: 0 });
      }
    }, 650);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, []);

  return (
    <Animated.View entering={enter(base)}>
      <PressableScale
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel="Bu gecə ən riskli 3 keçid. Xəritədə bax"
        onPress={() => router.navigate('/map')}
        style={styles.card}
      >
        <View style={styles.head}>
          <View style={styles.disc}>
            <Icon name="alert-octagon-outline" size={22} color={C.danger} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt v="overline" color={C.muted}>
              Təhlükəsizlik qatı
            </Txt>
            <Txt w="xbold" size={17} style={{ marginTop: 2 }}>
              {night ? 'Bu gecə ən riskli 3 keçid' : 'Bu axşam ən riskli 3 keçid'}
            </Txt>
          </View>
        </View>

        <View style={{ marginTop: 12, gap: 8 }}>
          {data
            ? data.spots.map((s, i) => (
                <Animated.View key={`${s.lat},${s.lon}`} entering={enter(i, 'fade')} style={styles.row}>
                  <View style={styles.rank}>
                    <Txt w="xbold" size={13} color={C.ink}>
                      {i + 1}
                    </Txt>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt w="bold" size={15} numberOfLines={1}>
                      {s.near}
                    </Txt>
                    <Txt w="med" size={12.5} color={C.muted} numberOfLines={1}>
                      {s.type}
                      {s.lanes ? ` · ${s.lanes} zolaq` : ''} · {s.distM < 1000 ? `${Math.round(s.distM / 10) * 10} m` : `${(s.distM / 1000).toFixed(1).replace('.', ',')} km`}
                    </Txt>
                  </View>
                  <View style={styles.score}>
                    <AnimatedNumber value={s.score} v="label" color={C.danger} delay={200 + i * 120} />
                    <Txt w="semi" size={11} color={C.danger}>
                      /100
                    </Txt>
                  </View>
                </Animated.View>
              ))
            : [0, 1, 2].map((i) => (
                <View key={i} style={styles.row}>
                  <Skeleton width={28} height={28} radius={14} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Skeleton width="62%" height={13} />
                    <Skeleton width="40%" height={10} />
                  </View>
                  <Skeleton width={56} height={28} radius={14} />
                </View>
              ))}
        </View>

        <View style={styles.foot}>
          <Txt w="med" size={12.5} color={C.muted} style={{ flex: 1 }} numberOfLines={1}>
            {data?.total ? `${data.total.toLocaleString('en-US').replace(/,/g, ' ')} keçid yoxlanıldı` : 'Keçidlər yoxlanılır…'}
          </Txt>
          <Txt w="bold" size={13.5} color={C.route}>
            Xəritədə bax
          </Txt>
          <Icon name="arrow-right" size={16} color={C.route} />
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: R.card, padding: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  disc: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 10 },
  rank: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.bg2, alignItems: 'center', justifyContent: 'center' },
  score: { flexDirection: 'row', alignItems: 'baseline', gap: 1, backgroundColor: C.dangerSoft, borderRadius: R.pill, paddingHorizontal: 10, height: 30, alignSelf: 'center', paddingTop: 5 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 2 },
});
