import { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { prefs } from '@/store/prefs';

export type EnterKind = 'up' | 'down' | 'fade' | 'pop';

/**
 * Staggered layout entrance for <Animated.View entering={enter(i)} />.
 * Lite mode → short plain fade (cheap on weak phones).
 */
export function enter(i = 0, kind: EnterKind = 'up', base = 0) {
  const delay = base + i * 60;
  if (prefs().liteFx) return FadeIn.duration(140).delay(Math.min(delay, 240));
  switch (kind) {
    case 'fade':
      return FadeIn.duration(320).delay(delay);
    case 'down':
      return FadeInUp.springify().damping(18).stiffness(170).delay(delay);
    case 'pop':
      return ZoomIn.springify().damping(13).stiffness(220).delay(delay);
    case 'up':
    default:
      return FadeInDown.springify().damping(18).stiffness(170).delay(delay);
  }
}
