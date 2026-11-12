import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Image, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { prefs } from '@/store/prefs';

/** Same artwork + size as the native splash (app.json: splash-icon.png, imageWidth 180, white). */
const SPLASH = require('../../../assets/splash-icon.png');
const SIZE = 180;
const DISC = SIZE * 0.92; // the navy disc inside splash-icon.png
const TOTAL = 880;

/**
 * Logo reveal right after the native splash: starts pixel-identical to the splash mark, dips,
 * then flies toward the viewer while a mint ring ripples out and the white veil lifts.
 * Mount it on top of the app (absolute fill); it calls onDone after ~0.9 s.
 */
export function BrandIntro({ onDone }: { onDone?: () => void }) {
  const t = useSharedValue(0);
  const veil = useSharedValue(1);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    let alive = true;
    const quick = prefs().liteFx;
    const finish = (ms: number) =>
      setTimeout(() => {
        if (alive) done.current?.();
      }, ms);
    let timer: ReturnType<typeof setTimeout>;
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.() ?? false)
      .catch(() => false)
      .then((reduce) => {
        if (!alive) return;
        if (quick || reduce) {
          veil.value = withTiming(0, { duration: 260 });
          t.value = withTiming(1, { duration: 260 });
          timer = finish(300);
          return;
        }
        t.value = withDelay(140, withTiming(1, { duration: TOTAL - 160, easing: Easing.linear }));
        veil.value = withDelay(500, withTiming(0, { duration: 360, easing: Easing.out(Easing.cubic) }));
        timer = finish(TOTAL + 40);
      });
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [t, veil]);

  const mark = useAnimatedStyle(() => {
    const p = t.value;
    // 0–0.3 dip to 0.9, 0.3–1 zoom to 2.6 and fade
    const dip = p < 0.3 ? 1 - 0.1 * Math.sin((p / 0.3) * (Math.PI / 2)) : 0.9;
    const z = p < 0.3 ? 0 : (p - 0.3) / 0.7;
    const ez = z * z * (3 - 2 * z);
    return {
      opacity: p < 0.45 ? 1 : Math.max(0, 1 - (p - 0.45) / 0.45),
      transform: [{ scale: dip + ez * 1.7 }],
    };
  });
  const ring = useAnimatedStyle(() => {
    const p = Math.max(0, (t.value - 0.28) / 0.6);
    return { opacity: p <= 0 ? 0 : 0.55 * (1 - Math.min(1, p)), transform: [{ scale: 0.95 + Math.min(1, p) * 1.9 }] };
  });
  const veilA = useAnimatedStyle(() => ({ opacity: veil.value }));

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.veil, veilA]} />
      <Animated.View style={[styles.ring, ring]} />
      <Animated.View style={mark}>
        <Image source={SPLASH} style={{ width: SIZE, height: SIZE }} fadeDuration={0} accessibilityLabel="Hara" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', zIndex: 1000, elevation: 1000 },
  veil: { backgroundColor: '#FFFFFF' },
  ring: {
    position: 'absolute',
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    borderWidth: 6,
    borderColor: '#71FAC8',
  },
});
