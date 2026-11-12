import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Soft fade under the (edge-to-edge) status bar so scrolled content never collides with it. */
export function TopScrim({ color = '#FFFFFF' }: { color?: string }) {
  const insets = useSafeAreaInsets();
  if (!insets.top) return null;
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[color, `${color}00`]}
      locations={[0.55, 1]}
      style={[StyleSheet.absoluteFill, { bottom: undefined, height: insets.top + 14 }]}
    />
  );
}
