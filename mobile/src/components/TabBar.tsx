import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { C, shadow } from '@/theme';
import { Icon, tap } from './ui';

const META: Record<string, { icon: string; label: string }> = {
  index: { icon: 'magnify', label: 'Yol tap' },
  map: { icon: 'layers-outline', label: 'Təhlükəsizlik xəritəsi' },
  report: { icon: 'plus-box-outline', label: 'Bildir' },
  profile: { icon: 'account-circle-outline', label: 'Profil' },
};

const PAD = 10;
const ITEM = 58;

/** Glass icon bar; the active white square springs between tabs (native driver). */
export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const n = state.routes.length;
  const slot = w ? (w - PAD * 2) / n : 0;
  const placed = useRef(false);

  useEffect(() => {
    if (!slot) return;
    const target = PAD + slot * (state.index + 0.5) - ITEM / 2;
    if (!placed.current) {
      placed.current = true; // first layout: jump, don't slide from 0
      x.setValue(target);
      return;
    }
    Animated.spring(x, { toValue: target, speed: 16, bounciness: 9, useNativeDriver: true }).start();
  }, [state.index, slot, x]);

  return (
    <BlurView
      intensity={55}
      tint="light"
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      style={[styles.bar, { bottom: Math.max(insets.bottom, 12) }]}
    >
      {slot ? <Animated.View style={[styles.indicator, { transform: [{ translateX: x }] }]} /> : null}
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const meta = META[route.name] ?? { icon: 'circle-outline', label: route.name };
        const onPress = () => {
          tap();
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={meta.label}
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            style={styles.item}
          >
            <Icon name={meta.icon} size={27} color={focused ? '#FFFFFF' : C.ink} />
          </Pressable>
        );
      })}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 76,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PAD,
    ...shadow(2),
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: (76 - ITEM) / 2,
    width: ITEM,
    height: ITEM,
    borderRadius: 18,
    backgroundColor: C.route,
    ...shadow(1),
  },
  item: { flex: 1, height: ITEM, alignItems: 'center', justifyContent: 'center' },
});

export const TAB_BAR_SPACE = 104;
