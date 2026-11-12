import React, { useRef } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '@/store/useAppStore';

/**
 * Hidden developer-panel trigger: TWO long-presses (≥1.2 s each) within 4 s.
 * The first only gives a soft haptic tick, so judges can never open it by accident.
 * Wrap a non-interactive element (logo, avatar) with it.
 */
export function DevTrigger({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const first = useRef(0);
  const setOpen = useAppStore((s) => s.setDemoPanelOpen);
  return (
    <Pressable
      style={style}
      delayLongPress={1200}
      accessible={false}
      onLongPress={() => {
        const now = Date.now();
        if (now - first.current < 4000) {
          first.current = 0;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setOpen(true);
        } else {
          first.current = now;
          Haptics.selectionAsync().catch(() => {});
        }
      }}
    >
      {children}
    </Pressable>
  );
}
