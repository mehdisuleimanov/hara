import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { HaraWordmark } from '@/components/Brand';
import { DevTrigger } from '@/components/DevTrigger';
import { PillButton, Txt } from '@/components/ui';
import { PressableScale, enter } from '@/motion';
import { usePrefs } from '@/store/prefs';
import { stop } from '@/voice';
import { C } from '@/theme';
import { AdaptsToYou, MeetAhmed, SaferRoute } from './pages';
import { Permissions } from './Permissions';

const PAGES = 3;
const TINTS = ['#E3FAF1', '#E8F1FF', '#EEEEFF'];

function Tint({ i, scrollX, w }: { i: number; scrollX: SharedValue<number>; w: number }) {
  const a = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, [(i - 1) * w, i * w, (i + 1) * w], [0, 1, 0], 'clamp'),
  }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, a]}>
      <LinearGradient colors={[TINTS[i], '#FFFFFF']} locations={[0, 0.62]} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

function Dot({ i, scrollX, w }: { i: number; scrollX: SharedValue<number>; w: number }) {
  const a = useAnimatedStyle(() => {
    const r = [(i - 1) * w, i * w, (i + 1) * w];
    return {
      width: interpolate(scrollX.value, r, [8, 26, 8], 'clamp'),
      backgroundColor: interpolateColor(scrollX.value, r, [C.line, C.navy, C.line]),
    };
  });
  return <Animated.View style={[styles.dot, a]} />;
}

/** First run: three swipeable pages with parallax, then permission primers. Skippable. */
export function Onboarding() {
  const insets = useSafeAreaInsets();
  const [w, setW] = useState(0);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<'pages' | 'perms'>('pages');
  const scrollX = useSharedValue(0);
  const ref = useAnimatedRef<Animated.ScrollView>();

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  const onIndex = useCallback((i: number) => {
    setIdx(i);
    Haptics.selectionAsync().catch(() => {});
  }, []);

  useAnimatedReaction(
    () => (w > 0 ? Math.round(scrollX.value / w) : 0),
    (cur, prev) => {
      if (prev !== null && cur !== prev) runOnJS(onIndex)(cur);
    },
    [w],
  );

  useEffect(() => () => stop(), []);

  const finish = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    stop();
    usePrefs.getState().setOnboarded(true);
    router.replace('/');
  }, []);

  const next = () => {
    if (phase === 'perms') return finish();
    if (idx < PAGES - 1) {
      ref.current?.scrollTo({ x: (idx + 1) * w, animated: true });
      return;
    }
    stop();
    setPhase('perms');
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const nw = Math.round(e.nativeEvent.layout.width);
    if (nw && nw !== w) setW(nw);
  };

  return (
    <View style={styles.root} onLayout={onLayout}>
      {w > 0 && phase === 'pages' ? [0, 1, 2].map((i) => <Tint key={i} i={i} scrollX={scrollX} w={w} />) : null}
      {phase === 'perms' ? (
        <Animated.View entering={FadeIn.duration(400)} pointerEvents="none" style={StyleSheet.absoluteFill}>
          <LinearGradient colors={['#E8F1FF', '#FFFFFF']} locations={[0, 0.5]} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeIn.duration(500)} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <DevTrigger>
          <HaraWordmark width={74} />
        </DevTrigger>
        {phase === 'pages' ? (
          <PressableScale accessibilityRole="button" accessibilityLabel="Keç" onPress={finish} hitSlop={12} style={styles.skip}>
            <Txt w="semi" size={15} color={C.muted}>
              Keç
            </Txt>
          </PressableScale>
        ) : null}
      </Animated.View>

      <View style={{ flex: 1 }}>
        {w > 0 && phase === 'pages' ? (
          <Animated.ScrollView
            ref={ref}
            horizontal
            pagingEnabled
            bounces={false}
            overScrollMode="never"
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={onScroll}
            exiting={FadeOut.duration(220)}
            style={{ flex: 1 }}
          >
            <MeetAhmed scrollX={scrollX} w={w} active={idx === 0} />
            <SaferRoute scrollX={scrollX} w={w} active={idx === 1} />
            <AdaptsToYou scrollX={scrollX} w={w} active={idx === 2} />
          </Animated.ScrollView>
        ) : null}
        {phase === 'perms' ? (
          <Animated.View entering={SlideInRight.springify().damping(20).stiffness(170)} style={{ flex: 1 }}>
            <Permissions />
          </Animated.View>
        ) : null}
      </View>

      <Animated.View entering={enter(2, 'up', 200)} style={[styles.footer, { paddingBottom: insets.bottom + 18 }]}>
        <View style={[styles.dots, phase === 'perms' && { opacity: 0 }]} accessibilityLabel={`Səhifə ${idx + 1} / ${PAGES}`}>
          {w > 0 ? [0, 1, 2].map((i) => <Dot key={i} i={i} scrollX={scrollX} w={w} />) : null}
        </View>
        <PillButton
          label={phase === 'perms' ? 'Başla' : 'Davam et'}
          icon={phase === 'perms' ? 'check' : 'arrow-right'}
          variant={phase === 'perms' ? 'brand' : 'black'}
          onPress={next}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 6, zIndex: 2 },
  skip: { height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: 24, gap: 16 },
  dots: { flexDirection: 'row', gap: 6, alignSelf: 'center', height: 8 },
  dot: { height: 8, borderRadius: 4 },
});
