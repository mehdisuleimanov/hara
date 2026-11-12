import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { SPRING } from './springs';

const APressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** scale while pressed (default 0.96) */
  scaleTo?: number;
  /** haptic on press-in: 'light' (default) | 'medium' | false */
  haptic?: 'light' | 'medium' | false;
  children?: React.ReactNode;
};

/** Pressable that springs down on touch — the base of every tappable surface. */
export function PressableScale({ style, scaleTo = 0.96, haptic = 'light', onPressIn, onPressOut, disabled, children, ...rest }: PressableScaleProps) {
  const sc = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <APressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        sc.value = withSpring(scaleTo, SPRING.snappy);
        if (haptic && !disabled) {
          Haptics.impactAsync(haptic === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        sc.value = withSpring(1, SPRING.bouncy);
        onPressOut?.(e);
      }}
      style={[style, a]}
    >
      {children}
    </APressable>
  );
}
