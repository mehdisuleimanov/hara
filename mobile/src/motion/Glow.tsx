import React, { useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { C } from '@/theme';
import { useFx } from '@/hooks/useTheme';

/** 0→1 looping shared value (period ms). Frozen at 0 in lite mode. */
export function usePulse(period = 1800) {
  const { lite } = useFx();
  const v = useSharedValue(0);
  useEffect(() => {
    if (lite) {
      v.value = 0;
      return;
    }
    v.value = withRepeat(withTiming(1, { duration: period, easing: Easing.out(Easing.quad) }), -1, false);
  }, [lite, period, v]);
  return v;
}

/** 0↔1 breathing shared value. */
export function useBreath(period = 2600) {
  const { lite } = useFx();
  const v = useSharedValue(0);
  useEffect(() => {
    if (lite) return;
    v.value = withRepeat(
      withSequence(
        withTiming(1, { duration: period / 2, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: period / 2, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [lite, period, v]);
  return v;
}

/**
 * Soft radial glow (static SVG gradient) whose scale/opacity animate on the UI thread.
 * Pass `level` (0..1 shared value) to drive it from audio, or let it breathe.
 */
export function Glow({
  size = 240,
  color = C.route,
  intensity = 0.55,
  level,
  style,
}: {
  size?: number;
  color?: string;
  intensity?: number;
  level?: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
}) {
  const breath = useBreath();
  const a = useAnimatedStyle(() => {
    const l = level ? level.value : breath.value * 0.5;
    return { opacity: intensity * (0.7 + 0.3 * l), transform: [{ scale: 0.92 + 0.16 * l }] };
  });
  const id = `g${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style, a]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.9} />
            <Stop offset="0.45" stopColor={color} stopOpacity={0.35} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={size} height={size} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}
