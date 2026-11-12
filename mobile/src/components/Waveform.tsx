import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { C } from '@/theme';

/**
 * Live mic waveform: a scrolling history of real metering samples (newest on the right).
 * Bars animate on the UI thread; the parent only pushes a number when metering updates.
 */
export function Waveform({
  level,
  active,
  bars = 28,
  color = C.ink,
  height = 34,
}: {
  level: number;
  active: boolean;
  bars?: number;
  color?: string;
  height?: number;
}) {
  const hist = useSharedValue<number[]>(Array.from({ length: bars }, () => 0));
  useEffect(() => {
    if (!active) {
      hist.value = Array.from({ length: bars }, () => 0);
      return;
    }
    const next = hist.value.slice(1);
    next.push(Math.max(0, Math.min(1, level)));
    hist.value = next;
  }, [level, active, bars, hist]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: bars }).map((_, i) => (
        <Bar key={i} i={i} n={bars} hist={hist} color={color} height={height} />
      ))}
    </View>
  );
}

const Bar = React.memo(function Bar({ i, n, hist, color, height }: { i: number; n: number; hist: SharedValue<number[]>; color: string; height: number }) {
  const a = useAnimatedStyle(() => {
    const v = hist.value[i] ?? 0;
    // gentle shaping so quiet speech is still visible
    const h = 4 + (height - 4) * Math.min(1, Math.pow(v, 0.8) * 1.1);
    return { height: withTiming(h, { duration: 90 }) };
  });
  const fade = 0.25 + 0.75 * (i / (n - 1));
  return <Animated.View style={[{ width: 3.5, borderRadius: 2, backgroundColor: color, opacity: fade }, a]} />;
});
