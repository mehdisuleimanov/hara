import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { usePrefs, type A11yMode } from '@/store/prefs';
import { registerMorph, type MorphOrigin } from './morph';
import { AhmedAvatar } from '@/components/Brand';
import { Icon, Txt } from '@/components/ui';
import { say } from '@/voice';
import { A11Y } from '@/voice/lines/a11y';
import { C, R, Z } from '@/theme';
import { upperAz } from './text';

/**
 * One-tap adaptive UI. morphTo(mode, tapPoint) grows a brand-colored circle from the
 * finger, switches the a11y mode while the screen is covered (every Txt re-scales and
 * re-colors underneath), introduces the new look with Əhməd, then fades away to reveal
 * the restyled app. Lite effects → quick crossfade.
 */

type Meta = { color: string; title: string; sub: string; line: string; perks: { icon: string; label: string }[] };

const META: Record<A11yMode, Meta> = {
  senior: {
    color: C.brand,
    title: 'Sadə rejim',
    sub: 'Böyük yazılar, böyük düymələr və səsli kömək',
    line: A11Y.seniorOn,
    perks: [
      { icon: 'format-size', label: 'Böyük yazı' },
      { icon: 'gesture-tap-button', label: 'Böyük düymə' },
      { icon: 'account-voice', label: 'Səsli oxu' },
    ],
  },
  lowVision: {
    color: '#0B1220',
    title: 'Yüksək kontrast',
    sub: 'Daha iri yazı, daha güclü rənglər və aydın sərhədlər',
    line: A11Y.hcOn,
    perks: [
      { icon: 'contrast-box', label: 'Kontrast' },
      { icon: 'format-size', label: 'İri yazı' },
      { icon: 'account-voice', label: 'Səsli oxu' },
    ],
  },
  standard: {
    color: C.route,
    title: 'Standart görünüş',
    sub: 'Bütün imkanlar yenidən əlinin altında',
    line: A11Y.standardOn,
    perks: [
      { icon: 'creation', label: 'Əhməd' },
      { icon: 'map-outline', label: 'Xəritə' },
      { icon: 'view-grid-outline', label: 'Hamısı' },
    ],
  },
};

const GROW_MS = 380;
const HOLD_MS = 1250;
const OUT_MS = 340;

type Run = { mode: A11yMode; ox: number; oy: number; radius: number; lite: boolean };

export function A11yMorphHost() {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [run, setRun] = useState<Run | null>(null);
  const busy = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const grow = useSharedValue(0); // circle scale 0..1
  const fade = useSharedValue(0); // whole overlay opacity
  const card = useSharedValue(0); // intro card in/out

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const start = useCallback(
    (mode: A11yMode, origin?: MorphOrigin) => {
      const p = usePrefs.getState();
      if (busy.current) return;
      if (p.a11yMode === mode) {
        Haptics.selectionAsync().catch(() => {});
        return;
      }
      busy.current = true;
      const { w, h } = sizeRef.current;
      const W = w || 400;
      const H = h || 800;
      const ox = Math.max(0, Math.min(W, origin?.x ?? W / 2));
      const oy = Math.max(0, Math.min(H, origin?.y ?? H / 2));
      const radius = Math.ceil(Math.max(Math.hypot(ox, oy), Math.hypot(W - ox, oy), Math.hypot(ox, H - oy), Math.hypot(W - ox, H - oy))) + 8;
      const lite = p.liteFx;
      grow.value = lite ? 1 : 0.01;
      fade.value = lite ? 0 : 1;
      card.value = 0;
      setRun({ mode, ox, oy, radius, lite });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      const cover = lite ? 150 : GROW_MS;
      // next frame: the overlay is mounted, start the motion
      requestAnimationFrame(() => {
        if (lite) fade.value = withTiming(1, { duration: cover });
        else grow.value = withTiming(1, { duration: cover, easing: Easing.bezier(0.45, 0, 0.2, 1) });
      });
      // fully covered → switch the whole app's look underneath
      later(() => {
        usePrefs.getState().setA11yMode(mode);
        card.value = lite ? withTiming(1, { duration: 120 }) : withSpring(1, { damping: 16, stiffness: 190 });
        say(META[mode].line);
      }, cover + 30);
      const hold = lite ? 900 : HOLD_MS;
      // reveal
      later(() => {
        card.value = withTiming(0, { duration: lite ? 120 : 200 });
        fade.value = withDelay(lite ? 60 : 120, withTiming(0, { duration: lite ? 180 : OUT_MS, easing: Easing.out(Easing.cubic) }));
        if (!lite) grow.value = withDelay(120, withTiming(1.08, { duration: OUT_MS }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }, cover + 30 + hold);
      later(() => {
        setRun(null);
        busy.current = false;
      }, cover + 30 + hold + (lite ? 260 : OUT_MS + 160));
    },
    [card, fade, grow],
  );

  useEffect(() => {
    registerMorph(start);
    const list = timers.current;
    return () => {
      registerMorph(null);
      list.forEach(clearTimeout);
    };
  }, [start]);

  const circleA = useAnimatedStyle(() => ({ transform: [{ scale: grow.value }] }));
  const fadeA = useAnimatedStyle(() => ({ opacity: fade.value }));
  const cardA = useAnimatedStyle(() => ({
    opacity: card.value,
    transform: [{ translateY: (1 - card.value) * 26 }, { scale: 0.92 + 0.08 * card.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };

  const m = run ? META[run.mode] : null;
  const dark = run?.mode === 'lowVision';

  return (
    <View pointerEvents={run ? 'auto' : 'none'} onLayout={onLayout} style={[StyleSheet.absoluteFill, { zIndex: Z.morph, elevation: Z.morph }]}>
      {run && m ? (
        <Animated.View style={[StyleSheet.absoluteFill, fadeA]}>
          {run.lite ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: m.color }]} />
          ) : (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  left: run.ox - run.radius,
                  top: run.oy - run.radius,
                  width: run.radius * 2,
                  height: run.radius * 2,
                  borderRadius: run.radius,
                  backgroundColor: m.color,
                },
                circleA,
              ]}
            />
          )}
          <View style={styles.center}>
            <Animated.View style={[styles.card, dark && styles.cardDark, cardA]}>
              <View style={[styles.mascot, { backgroundColor: dark ? '#1E2B40' : C.brandSofter }]}>
                <AhmedAvatar size={74} mood="talk" />
              </View>
              <Txt v="overline" color={dark ? '#FFFFFF' : C.muted} center style={{ marginTop: 18 }}>
                {upperAz('Görünüş dəyişdi')}
              </Txt>
              <Txt v="h1" color={dark ? '#FFFFFF' : C.ink} center style={{ marginTop: 6 }}>
                {m.title}
              </Txt>
              <Txt v="bodyS" color={dark ? '#FFFFFF' : C.ink2} center style={{ marginTop: 8 }}>
                {m.sub}
              </Txt>
              <View style={styles.perks}>
                {m.perks.map((pk) => (
                  <View key={pk.label} style={[styles.perk, dark && { backgroundColor: '#1E2B40', borderColor: '#FFFFFF' }]}>
                    <Icon name={pk.icon} size={18} color={dark ? '#FFFFFF' : m.color === C.route ? C.route : C.brandDark} />
                    <Txt w="semi" size={12.5} color={dark ? '#FFFFFF' : C.ink}>
                      {pk.label}
                    </Txt>
                  </View>
                ))}
              </View>
            </Animated.View>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: R.card,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
    alignItems: 'center',
  },
  cardDark: { backgroundColor: '#0F1B2D', borderWidth: 2, borderColor: '#FFFFFF' },
  mascot: { width: 108, height: 108, borderRadius: 54, alignItems: 'center', justifyContent: 'center' },
  perks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 18 },
  perk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
});
