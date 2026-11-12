import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInRight,
  LinearTransition,
  ZoomIn,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Icon, Txt } from '@/components/ui';
import { useFx, useTheme } from '@/hooks/useTheme';
import type { AhmedStep } from '@/store/useAppStore';
import { C, R } from '@/theme';

/**
 * Əhməd's live reasoning: one row per real step (understanding + every tool call).
 * spinner → spring check / amber warn / red fail; value slides in when it arrives.
 */
export function ThinkingTrace({ steps, done, composing }: { steps: AhmedStep[]; done?: boolean; composing?: string | null }) {
  const t = useTheme();
  if (!steps.length) return null;
  return (
    <Animated.View entering={FadeIn.duration(220)} layout={t.lite ? undefined : LinearTransition.springify().damping(20)} style={[styles.card, t.hc && styles.hc]}>
      <View style={styles.head}>
        <View style={[styles.headDot, { backgroundColor: done ? C.brand : C.ai }]} />
        <Txt v="overline" color={done ? C.brandDark : C.ai}>
          {done ? 'Əhməd yoxladı' : 'Əhməd düşünür'}
        </Txt>
      </View>
      {steps.map((s, i) => (
        <Row key={s.id} step={s} last={i === steps.length - 1} />
      ))}
      {composing ? (
        <Animated.View entering={FadeIn.duration(260)} style={styles.composing}>
          <PulseLabel text={composing} pulsing />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const Row = React.memo(function Row({ step, last }: { step: AhmedStep; last: boolean }) {
  const { lite } = useFx();
  return (
    <Animated.View entering={lite ? FadeIn.duration(140) : FadeInDown.springify().damping(18).stiffness(180)} style={styles.row}>
      <View style={styles.rail}>
        <StatusIcon state={step.state} />
        {!last ? <View style={styles.line} /> : null}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : 12, paddingTop: 1 }}>
        <PulseLabel text={step.label} pulsing={step.state === 'run' && step.id === 'understand'} />
        {step.value ? (
          <Animated.View key={step.value} entering={lite ? FadeIn.duration(120) : FadeInRight.springify().damping(17).stiffness(170)}>
            <Txt v="title" color={valueColor(step.state)} numberOfLines={2} style={{ marginTop: 1 }}>
              {step.value}
            </Txt>
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );
});

function valueColor(s: AhmedStep['state']) {
  if (s === 'warn') return '#B45309';
  if (s === 'fail') return C.danger;
  return C.ink;
}

function PulseLabel({ text, pulsing }: { text: string; pulsing: boolean }) {
  const { lite } = useFx();
  const o = useSharedValue(1);
  useEffect(() => {
    if (pulsing && !lite) {
      o.value = withRepeat(withSequence(withTiming(0.4, { duration: 520 }), withTiming(1, { duration: 520 })), -1, false);
    } else {
      cancelAnimation(o);
      o.value = withTiming(1, { duration: 150 });
    }
  }, [pulsing, lite, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={a}>
      <Txt v="label" color={C.muted}>
        {text}
      </Txt>
    </Animated.View>
  );
}

function StatusIcon({ state }: { state: AhmedStep['state'] }) {
  const { lite } = useFx();
  if (state === 'run') return <Spinner />;
  const bg = state === 'done' ? C.brand : state === 'warn' ? C.warn : C.danger;
  const icon = state === 'done' ? 'check' : state === 'warn' ? 'exclamation' : 'close';
  return (
    <Animated.View key={state} entering={lite ? undefined : ZoomIn.springify().damping(11).stiffness(260)} style={[styles.icon, { backgroundColor: bg }]}>
      <Icon name={icon} size={15} color="#FFFFFF" />
    </Animated.View>
  );
}

function Spinner() {
  const { lite } = useFx();
  const r = useSharedValue(0);
  useEffect(() => {
    if (lite) return;
    r.value = withRepeat(withTiming(360, { duration: 850, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(r);
  }, [lite, r]);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <View style={[styles.icon, { backgroundColor: C.aiSoft }]}>
      <Animated.View style={a}>
        <Svg width={22} height={22}>
          <Circle cx={11} cy={11} r={8} stroke={C.ai} strokeOpacity={0.18} strokeWidth={2.5} fill="none" />
          <Circle cx={11} cy={11} r={8} stroke={C.ai} strokeWidth={2.5} fill="none" strokeDasharray="14 40" strokeLinecap="round" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    backgroundColor: C.surface,
    borderRadius: R.lg,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  hc: { borderWidth: 2, borderColor: '#0F1B2D' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  headDot: { width: 7, height: 7, borderRadius: 4 },
  row: { flexDirection: 'row', gap: 12 },
  rail: { width: 26, alignItems: 'center' },
  icon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  composing: { marginTop: 12, paddingLeft: 38 },
  line: { flex: 1, width: 2, borderRadius: 1, backgroundColor: C.line, marginTop: 4 },
});
