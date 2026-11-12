import React, { useEffect } from 'react';
import { AccessibilityInfo, StyleProp, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { C } from '@/theme';
import { prefs } from '@/store/prefs';
import { Icon } from './ui';

/**
 * Motion kit (same API as before) — now on Reanimated: every animation runs on the
 * UI thread. Respects "reduce motion" and the Lite-effects preference.
 */

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled?.()
  .then((v) => (reduceMotion = !!v))
  .catch(() => {});

const still = () => reduceMotion || prefs().liteFx;

export const MOTION = { fast: 180, base: 280, slow: 520, stagger: 70 };

const OUT = Easing.out(Easing.cubic);

/** Fade + rise in on mount; use `index` for list stagger. */
export function FadeIn({
  children,
  delay = 0,
  index = 0,
  from = 16,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  index?: number;
  from?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const v = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    const d = delay + index * MOTION.stagger;
    v.value = prefs().liteFx
      ? withDelay(Math.min(d, 200), withTiming(1, { duration: 160 }))
      : withDelay(d, withSpring(1, { damping: 20, stiffness: 160, mass: 0.9 }));
  }, [v, delay, index]);
  const a = useAnimatedStyle(() => ({
    opacity: Math.min(1, v.value * 1.2),
    transform: [{ translateY: (1 - v.value) * from }],
  }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** Spring "pop" in (success icons, badges). */
export function Pop({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    v.value = still() ? withTiming(1, { duration: 140 }) : withDelay(delay, withSpring(1, { damping: 11, stiffness: 220 }));
  }, [v, delay]);
  const a = useAnimatedStyle(() => ({
    opacity: Math.min(1, v.value * 1.5),
    transform: [{ scale: 0.5 + 0.5 * v.value }],
  }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** Slide up from below (sheets / cards). */
export function SlideUp({ children, style, distance = 80 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; distance?: number }) {
  const v = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    v.value = still() ? withTiming(1, { duration: 160 }) : withSpring(1, { damping: 22, stiffness: 190 });
  }, [v]);
  const a = useAnimatedStyle(() => ({
    opacity: Math.min(1, v.value * 1.4),
    transform: [{ translateY: (1 - v.value) * distance }],
  }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** Looping radar/pulse ring (live location, listening mic). */
export function Pulse({ size = 80, color = C.brand, duration = 1800, style }: { size?: number; color?: string; duration?: number; style?: StyleProp<ViewStyle> }) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (still()) return;
    v.value = withRepeat(withTiming(1, { duration, easing: Easing.out(Easing.quad) }), -1, false);
  }, [v, duration]);
  const a = useAnimatedStyle(() => ({
    opacity: interpolate(v.value, [0, 1], [0.45, 0]),
    transform: [{ scale: interpolate(v.value, [0, 1], [0.5, 1.4]) }],
  }));
  if (still()) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style, a]}
    />
  );
}

/** Gentle floating bob (mascot). */
export function Float({ children, amplitude = 5, duration = 2200 }: { children: React.ReactNode; amplitude?: number; duration?: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (still()) return;
    v.value = withRepeat(
      withSequence(
        withTiming(1, { duration: duration / 2, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: duration / 2, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [v, duration]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: -amplitude * v.value }] }));
  return <Animated.View style={a}>{children}</Animated.View>;
}

function Chev({ i, v, color }: { i: number; v: SharedValue<number>; color: string }) {
  const a = useAnimatedStyle(() => ({
    opacity: interpolate(v.value, [i - 1, i, i + 1, 3], [0.25, 1, 0.25, 0.25], 'clamp'),
  }));
  return (
    <Animated.View style={[{ marginLeft: i ? -10 : 0 }, a]}>
      <Icon name="chevron-right" size={18} color={color} />
    </Animated.View>
  );
}

/** Animated "›››" — a light sweeps left→right like "slide to start". */
export function ChevronFlow({ color = C.ink }: { color?: string }) {
  const v = useSharedValue(still() ? 2 : 0);
  useEffect(() => {
    if (still()) return;
    v.value = withRepeat(withTiming(3, { duration: 1400, easing: Easing.linear }), -1, false);
  }, [v]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <Chev key={i} i={i} v={v} color={color} />
      ))}
    </View>
  );
}

export { useCountUp as useCountUpOpts } from '@/motion/AnimatedNumber';
import { useCountUp as useCountUpBase } from '@/motion/AnimatedNumber';

/** Count-up number (JS-driven; cheap). Legacy signature (target, duration, delay). */
export function useCountUp(target: number, duration = 900, delay = 0) {
  return useCountUpBase(target, { duration, delay });
}

function Particle({ i, count, size, v }: { i: number; count: number; size: number; v: SharedValue<number> }) {
  const colors = [C.brand, C.route, C.brandDark, C.warn, C.ai];
  const ang = (i / count) * Math.PI * 2;
  const r = size / 2 - 10 - (i % 3) * 12;
  const a = useAnimatedStyle(() => ({
    opacity: interpolate(v.value, [0, 0.7, 1], [1, 1, 0]),
    transform: [
      { translateX: Math.cos(ang) * r * v.value },
      { translateY: Math.sin(ang) * r * v.value + 30 * v.value * v.value },
      { rotate: `${(i % 2 ? 1 : -1) * 220 * v.value}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[
        { position: 'absolute', width: i % 2 ? 10 : 7, height: i % 2 ? 10 : 14, borderRadius: 4, backgroundColor: colors[i % colors.length] },
        a,
      ]}
    />
  );
}

/** Confetti-like burst of palette dots (success moments). */
export function Burst({ size = 200, count = 14 }: { size?: number; count?: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (still()) return;
    v.value = withTiming(1, { duration: 1000, easing: OUT });
  }, [v]);
  if (still()) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: count }).map((_, i) => (
        <Particle key={i} i={i} count={count} size={size} v={v} />
      ))}
    </View>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Dashed path whose dashes travel ("marching ants") — route preview graphics. */
export function MarchingPath({
  d,
  width,
  height,
  color = C.ink,
  strokeWidth = 2,
}: {
  d: string;
  width: number;
  height: number;
  color?: string;
  strokeWidth?: number;
}) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (still()) return;
    v.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.linear }), -1, false);
  }, [v]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: 11 - 11 * v.value }));
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', right: 18, top: 8 }}>
      <AnimatedPath d={d} stroke={color} strokeWidth={strokeWidth} strokeDasharray="5 6" animatedProps={props} fill="none" strokeLinecap="round" />
    </Svg>
  );
}
