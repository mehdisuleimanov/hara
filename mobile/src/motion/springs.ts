import { Easing } from 'react-native-reanimated';

/** Shared motion language. Springs feel physical; durations for fades only. */
export const SPRING = {
  snappy: { damping: 20, stiffness: 300, mass: 0.8 },
  gentle: { damping: 18, stiffness: 160, mass: 1 },
  bouncy: { damping: 12, stiffness: 220, mass: 0.9 },
  sheet: { damping: 26, stiffness: 260, mass: 1 },
} as const;

export const DUR = { fast: 160, base: 240, slow: 420 } as const;

export const EASE = Easing.bezier(0.2, 0, 0, 1);
export const EASE_OUT = Easing.out(Easing.cubic);
