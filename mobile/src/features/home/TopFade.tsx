import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Soft white fade under the status bar so scrolled content never collides with it. */
export function TopFade({ color = '255,255,255' }: { color?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[`rgba(${color},1)`, `rgba(${color},0.85)`, `rgba(${color},0)`]}
      locations={[0, 0.6, 1]}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 14 }}
    />
  );
}
