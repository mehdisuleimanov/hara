import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { C } from '@/theme';
import { Icon } from './ui';

/**
 * Motion kit built on RN Animated (no extra native deps; works in Expo Go, APK and web).
 * Transform/opacity animations use the native driver. Respects "reduce motion".
 */

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled?.()
  .then((v) => (reduceMotion = !!v))
  .catch(() => {});

export const MOTION = { fast: 180, base: 280, slow: 520, stagger: 70 };

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
  const v = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(v, {
      toValue: 1,
      duration: MOTION.base + 120,
      delay: delay + index * MOTION.stagger,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v, delay, index]);
  return (
    <Animated.View
      style={[
        style,
        { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Spring "pop" in (success icons, badges). */
export function Pop({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    Animated.spring(v, { toValue: 1, delay, speed: 14, bounciness: 14, useNativeDriver: true }).start();
  }, [v, delay]);
  return <Animated.View style={[style, { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }]}>{children}</Animated.View>;
}

/** Slide up from below (sheets / cards). */
export function SlideUp({ children, style, distance = 80 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; distance?: number }) {
  const v = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    Animated.spring(v, { toValue: 1, speed: 12, bounciness: 5, useNativeDriver: true }).start();
  }, [v]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }]}>{children}</Animated.View>;
}

/** Looping radar/pulse ring (live location, listening mic). */
export function Pulse({ size = 80, color = C.brand, duration = 1800, style }: { size?: number; color?: string; duration?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v, duration]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
        {
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.4] }) }],
        },
      ]}
    />
  );
}

/** Gentle floating bob (mascot). */
export function Float({ children, amplitude = 5, duration = 2200 }: { children: React.ReactNode; amplitude?: number; duration?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: duration / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: duration / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, duration]);
  return <Animated.View style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -amplitude] }) }] }}>{children}</Animated.View>;
}

/** Animated "›››" — a light sweeps left→right like "slide to start". */
export function ChevronFlow({ color = C.ink }: { color?: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 3, duration: 1400, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={{
            marginLeft: i ? -10 : 0,
            opacity: v.interpolate({ inputRange: [i - 1, i, i + 1, 3], outputRange: [0.25, 1, 0.25, 0.25], extrapolate: 'clamp' }),
          }}
        >
          <Icon name="chevron-right" size={18} color={color} />
        </Animated.View>
      ))}
    </View>
  );
}

/** Count-up number (JS-driven; cheap). */
export function useCountUp(target: number, duration = 900, delay = 0) {
  const [val, setVal] = useState(reduceMotion ? target : 0);
  useEffect(() => {
    if (reduceMotion) return setVal(target);
    let raf = 0;
    const t0 = setTimeout(() => {
      const start = Date.now(); // wall clock: robust across platforms
      const step = () => {
        const p = Math.min(1, (Date.now() - start) / duration);
        setVal(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(t0);
      cancelAnimationFrame(raf);
    };
  }, [target, duration, delay]);
  return val;
}

/** Confetti-like burst of palette dots (success moments). */
export function Burst({ size = 200, count = 14 }: { size?: number; count?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v]);
  const colors = [C.brand, C.navy, C.brandDark, C.safe];
  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: count }).map((_, i) => {
        const a = (i / count) * Math.PI * 2;
        const r = size / 2 - 10 - (i % 3) * 12;
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              width: i % 2 ? 10 : 7,
              height: i % 2 ? 10 : 14,
              borderRadius: 4,
              backgroundColor: colors[i % colors.length],
              opacity: v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(a) * r] }) },
                { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(a) * r] }) },
                { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(i % 2 ? 1 : -1) * 220}deg`] }) },
              ],
            }}
          />
        );
      })}
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
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', right: 18, top: 8 }}>
      <AnimatedPath
        d={d}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray="5 6"
        strokeDashoffset={v.interpolate({ inputRange: [0, 1], outputRange: [11, 0] })}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}
