import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { C, R, shadow } from '@/theme';
import { Icon, Txt, tap } from './ui';

const META: Record<string, { icon: string; label: string }> = {
  index: { icon: 'walk', label: 'Yol' },
  map: { icon: 'map-outline', label: 'Xəritə' },
  report: { icon: 'plus', label: 'Bildir' },
  profile: { icon: 'account-outline', label: 'Profil' },
};

/** Floating white pill tab bar; active tab = black pill, "Bildir" = orange disc. */
export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <View style={styles.bar}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const meta = META[route.name] ?? { icon: 'circle', label: route.name };
          const onPress = () => {
            tap();
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          if (route.name === 'report') {
            return (
              <Pressable key={route.key} onPress={onPress} style={styles.reportBtn}>
                <Icon name="plus" size={30} color="#fff" />
              </Pressable>
            );
          }
          return (
            <Pressable key={route.key} onPress={onPress} style={[styles.item, focused && styles.itemActive]}>
              <Icon name={meta.icon} size={23} color={focused ? '#fff' : C.ink2} />
              {focused ? (
                <Txt w="semi" size={14} color="#fff">
                  {meta.label}
                </Txt>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.surface,
    borderRadius: R.pill,
    padding: 7,
    ...shadow(3),
  },
  item: {
    height: 54,
    minWidth: 54,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  itemActive: { backgroundColor: C.black, paddingHorizontal: 20 },
  reportBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
});

export const TAB_BAR_SPACE = 110;
