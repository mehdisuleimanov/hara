import React, { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '@/theme';
import { useFx } from '@/hooks/useTheme';

/** Shimmer placeholder block. Static in lite mode. */
export function Skeleton({ width = '100%', height = 16, radius = 10, style }: { width?: number | `${number}%`; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { lite } = useFx();
  const x = useSharedValue(-1);
  useEffect(() => {
    if (lite) return;
    x.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, false);
  }, [lite, x]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * 220 }] }));
  return (
    <View style={[{ width, height, borderRadius: radius, backgroundColor: C.bg2, overflow: 'hidden' }, style]}>
      {lite ? null : (
        <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, width: 160 }, a]}>
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      )}
    </View>
  );
}
