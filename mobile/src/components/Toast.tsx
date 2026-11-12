import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/useAppStore';
import { C, R, shadow } from '@/theme';
import { Icon, Txt } from './ui';

export function ToastHost() {
  const toast = useAppStore((s) => s.toast);
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    if (!toast) return;
    Animated.sequence([
      Animated.spring(y, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 8 }),
      Animated.delay(2200),
      Animated.timing(y, { toValue: -140, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [toast, y]);

  if (!toast) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { top: insets.top + 8, transform: [{ translateY: y }] }]}
    >
      <Icon name={toast.icon ?? 'check-circle'} size={22} color={C.brand} />
      <Txt w="bold" size={15} color="#FFFFFF">
        {toast.text}
      </Txt>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.black,
    paddingHorizontal: 18,
    height: 50,
    borderRadius: R.pill,
    zIndex: 1000,
    ...shadow(3),
  },
});
