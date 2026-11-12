import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { AhmedStep } from '@/store/useAppStore';
import type { RouteOption } from '@/data/types';
import { SPRING } from '@/motion/springs';
import { PressableScale } from '@/motion/PressableScale';
import { AhmedAvatar } from '@/components/Brand';
import { Icon, Txt, tap } from '@/components/ui';
import { C, R } from '@/theme';

const STEP_ICON: Record<AhmedStep['state'], { icon: string; color: string }> = {
  done: { icon: 'check-circle', color: C.ai },
  run: { icon: 'progress-clock', color: C.ai },
  warn: { icon: 'alert-circle', color: C.warn },
  fail: { icon: 'minus-circle-outline', color: C.faint },
};

/**
 * Əhməd's explanation on the results sheet: his reply (play/stop), and a compact
 * "Niyə?" expander with the agent's real steps and the selected route's reasons.
 */
export function AhmedExplain({
  reply,
  steps,
  option,
  speaking,
  onPlay,
  night,
}: {
  reply: string;
  steps?: AhmedStep[];
  option: RouteOption;
  speaking: boolean;
  onPlay: () => void;
  night: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = withSpring(open ? 1 : 0, SPRING.snappy);
  }, [open, rot]);
  const chev = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value * 180}deg` }] }));
  const realSteps = (steps ?? []).filter((s) => s.state !== 'fail').slice(0, 7);
  const reasons = [...option.reasons];
  if (option.avoided > 0 && !reasons.some((r) => /yan keç/i.test(r))) reasons.push(`${option.avoided} riskli keçiddən yan keçir`);
  if (night) reasons.push('Gecə üçün işıqlandırma nəzərə alınıb');

  return (
    <Animated.View layout={LinearTransition.springify().damping(22)} style={styles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={styles.avatar}>
          <AhmedAvatar size={32} mood={speaking ? 'talk' : 'smile'} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt v="overline" color={C.ai}>
            Əhməd
          </Txt>
          <Txt w="med" size={14} lh={20} color={C.ink} style={{ marginTop: 2 }} numberOfLines={open ? undefined : 3}>
            {reply}
          </Txt>
        </View>
        <PressableScale accessibilityRole="button" accessibilityLabel={speaking ? 'Dayandır' : 'Əhmədi dinlə'} scaleTo={0.88} onPress={onPlay} style={styles.play}>
          <Icon name={speaking ? 'stop' : 'play'} size={20} color="#FFFFFF" />
        </PressableScale>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          tap();
          setOpen((v) => !v);
        }}
        hitSlop={8}
        style={styles.why}
      >
        <Icon name="lightbulb-on-outline" size={15} color={C.ai} />
        <Txt w="bold" size={13} color={C.ai}>
          Niyə bu yol?
        </Txt>
        <Animated.View style={chev}>
          <Icon name="chevron-down" size={17} color={C.ai} />
        </Animated.View>
      </Pressable>
      {open ? (
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(140)} style={{ marginTop: 8, gap: 7 }}>
          {realSteps.map((s, i) => {
            const m = STEP_ICON[s.state];
            return (
              <View key={`${s.id}-${i}`} style={styles.row}>
                <Icon name={m.icon} size={16} color={m.color} />
                <Txt w="semi" size={13} color={C.ink} style={{ flexShrink: 1 }}>
                  {s.label}
                  {s.value ? (
                    <Txt w="med" size={13} color={C.muted}>
                      {'  '}
                      {s.value}
                    </Txt>
                  ) : null}
                </Txt>
              </View>
            );
          })}
          {realSteps.length ? <View style={styles.hr} /> : null}
          {reasons.map((r, i) => (
            <View key={`r${i}`} style={styles.row}>
              <Icon name="shield-check-outline" size={16} color={C.safe} />
              <Txt w="med" size={13} color={C.ink2} style={{ flexShrink: 1 }}>
                {r}
              </Txt>
            </View>
          ))}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.aiSoft, borderRadius: R.lg, padding: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  play: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.ai, alignItems: 'center', justifyContent: 'center' },
  why: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 10, marginLeft: 54 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  hr: { height: 1, backgroundColor: 'rgba(91,91,246,0.18)', marginVertical: 2 },
});
