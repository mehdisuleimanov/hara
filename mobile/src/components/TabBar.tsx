import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useTheme } from '@/hooks/useTheme';
import { SPRING } from '@/motion/springs';
import { PressableScale } from '@/motion/PressableScale';
import { C, C_HC, shadow } from '@/theme';
import { AhmedAvatar } from './Brand';
import { Icon, Txt, tap } from './ui';

type Slot =
  | { kind: 'tab'; name: string; icon: string; iconOn: string; label: string }
  | { kind: 'center'; name: string; icon: string; label: string }
  | { kind: 'ahmed'; label: string };

/** 5 slots: two tabs · central "Bildir" action · Əhməd shortcut · profile. */
const SLOTS: Slot[] = [
  { kind: 'tab', name: 'index', icon: 'home-variant-outline', iconOn: 'home-variant', label: 'Ana' },
  { kind: 'tab', name: 'map', icon: 'map-outline', iconOn: 'map', label: 'Xəritə' },
  { kind: 'center', name: 'report', icon: 'plus', label: 'Bildir' },
  { kind: 'ahmed', label: 'Əhməd' },
  { kind: 'tab', name: 'profile', icon: 'account-circle-outline', iconOn: 'account-circle', label: 'Profil' },
];

const PAD = 6;

function dims(simple: boolean) {
  return { barH: simple ? 84 : 70, center: simple ? 66 : 60 };
}

/** Bottom padding a tab screen needs so content clears the floating bar. */
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  const { simple } = useTheme();
  return dims(simple).barH + Math.max(insets.bottom, 12) + 18;
}

function TabItem({
  slot,
  focused,
  simple,
  hc,
  onPress,
}: {
  slot: Extract<Slot, { kind: 'tab' } | { kind: 'ahmed' }>;
  focused: boolean;
  simple: boolean;
  hc: boolean;
  onPress: () => void;
}) {
  const f = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    f.value = withSpring(focused ? 1 : 0, SPRING.snappy);
  }, [focused, f]);
  const showAll = simple;
  const iconA = useAnimatedStyle(() => ({ transform: [{ translateY: showAll ? 0 : -6 * f.value }, { scale: 1 + 0.06 * f.value }] }));
  const labelA = useAnimatedStyle(() => ({
    opacity: showAll ? 1 : f.value,
    transform: [{ translateY: showAll ? 0 : interpolate(f.value, [0, 1], [6, 0]) }],
  }));
  const fg = focused ? '#FFFFFF' : hc ? C_HC.ink : C.ink;
  const isAhmed = slot.kind === 'ahmed';
  return (
    <Pressable
      accessibilityRole={isAhmed ? 'button' : 'tab'}
      accessibilityLabel={slot.label}
      accessibilityState={isAhmed ? undefined : { selected: focused }}
      onPress={onPress}
      style={styles.item}
    >
      <Animated.View style={[{ alignItems: 'center' }, iconA]}>
        {isAhmed ? (
          <View style={[styles.ahmedDisc, simple && { width: 38, height: 38, borderRadius: 19 }]}>
            <AhmedAvatar size={simple ? 30 : 26} />
          </View>
        ) : (
          <Icon name={focused ? slot.iconOn : slot.icon} size={simple ? 26 : 24} color={fg} />
        )}
      </Animated.View>
      <Animated.View style={[showAll ? { marginTop: 3 } : styles.labelAbs, labelA]}>
        <Txt w="bold" size={simple ? 11.5 : 11} color={isAhmed ? (hc ? C_HC.ai : C.ai) : fg} numberOfLines={1}>
          {slot.label}
        </Txt>
      </Animated.View>
    </Pressable>
  );
}

/** Floating glass pill; the blue indicator springs between tabs, Bildir sits raised in the middle. */
export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const { barH, center } = dims(t.simple);
  const [w, setW] = useState(0);
  const slot = w ? (w - PAD * 2) / SLOTS.length : 0;
  const focusedName = state.routes[state.index]?.name;
  const activeSlot = SLOTS.findIndex((s) => s.kind === 'tab' && s.name === focusedName);
  const x = useSharedValue(0);
  const vis = useSharedValue(0);
  const placed = React.useRef(false);

  useEffect(() => {
    if (!slot) return;
    if (activeSlot >= 0) {
      const target = PAD + slot * activeSlot + 4;
      if (!placed.current) {
        placed.current = true;
        x.value = target;
      } else x.value = withSpring(target, SPRING.bouncy);
      vis.value = withTiming(1, { duration: 160 });
    } else vis.value = withTiming(0, { duration: 160 });
  }, [activeSlot, slot, x, vis]);

  const indA = useAnimatedStyle(() => ({ opacity: vis.value, transform: [{ translateX: x.value }, { scale: 0.85 + 0.15 * vis.value }] }));

  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    tap();
    const focused = route.name === focusedName;
    const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigateToTab(route.key);
  };

  const reportOn = focusedName === 'report';

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      style={[styles.bar, { height: barH, bottom: Math.max(insets.bottom, 12) }, !t.hc && shadow(3)]}
    >
      <View style={[StyleSheet.absoluteFill, styles.glassClip, t.hc && { borderWidth: 2, borderColor: C_HC.line }]}>
        {Platform.OS === 'ios' ? <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} /> : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: t.hc || Platform.OS !== 'ios' ? '#FFFFFF' : 'rgba(255,255,255,0.86)' }]} />
      </View>
      {slot ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            { width: slot - 8, top: 8, bottom: 8, backgroundColor: t.hc ? C_HC.route : C.route, borderRadius: (barH - 16) / 2.4 },
            indA,
          ]}
        />
      ) : null}
      {SLOTS.map((s) => {
        if (s.kind === 'center') {
          return (
            <View key="center" style={styles.item}>
              <PressableScale
                haptic="medium"
                scaleTo={0.9}
                accessibilityRole="tab"
                accessibilityLabel="Bildir"
                accessibilityState={{ selected: reportOn }}
                onPress={() => go(s.name)}
                style={[
                  styles.center,
                  { width: center, height: center, borderRadius: center / 2, marginTop: t.simple ? -20 : -26, backgroundColor: reportOn ? C.navy : t.hc ? C_HC.brand : C.brand },
                  !t.hc && shadow(2),
                ]}
              >
                <Icon name={reportOn ? 'alert-plus' : s.icon} size={t.simple ? 32 : 30} color="#FFFFFF" />
              </PressableScale>
              {t.simple ? (
                <Txt w="bold" size={11.5} style={{ marginTop: 2 }}>
                  {s.label}
                </Txt>
              ) : null}
            </View>
          );
        }
        if (s.kind === 'ahmed') {
          return (
            <TabItem
              key="ahmed"
              slot={s}
              focused={false}
              simple={t.simple}
              hc={t.hc}
              onPress={() => {
                tap();
                router.push('/ahmed');
              }}
            />
          );
        }
        return <TabItem key={s.name} slot={s} focused={s.name === focusedName} simple={t.simple} hc={t.hc} onPress={() => go(s.name)} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 14,
    right: 14,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PAD,
  },
  glassClip: { borderRadius: 30, overflow: 'hidden' },
  indicator: { position: 'absolute', left: 0 },
  item: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  labelAbs: { position: 'absolute', bottom: 9 },
  center: { alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#FFFFFF' },
  ahmedDisc: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.aiSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});

/** Legacy constant for screens that pad by a fixed amount (standard bar). */
export const TAB_BAR_SPACE = 104;
