import React, { memo, useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { C, scoreColor } from '@/theme';
import { useCountUp } from '@/motion/AnimatedNumber';
import { useFx } from '@/hooks/useTheme';
import { Icon, Txt } from './ui';

const ACircle = Animated.createAnimatedComponent(Circle);

/**
 * Circular 0–100 safety score. The ring sweeps on the UI thread, the number counts up. When `score` changes (day ⇄ night) both
 * animate from the previous value. `animate={false}` renders the final state at once.
 */
export const ScoreRing = memo(function ScoreRing({
  score,
  size = 64,
  stroke,
  dark,
  showShield = true,
  animate = true,
  delay = 0,
}: {
  score: number;
  size?: number;
  stroke?: number;
  dark?: boolean;
  showShield?: boolean;
  animate?: boolean;
  delay?: number;
}) {
  const { lite } = useFx();
  const still = !animate || lite;
  const target = Math.max(0, Math.min(100, score));
  const shown = useCountUp(target, { duration: still ? 1 : 900, delay: still ? 0 : delay });
  const sw = stroke ?? Math.max(4, size * 0.085);
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const p = useSharedValue(still ? target : 0);
  useEffect(() => {
    p.value = still ? target : withDelay(delay, withTiming(target, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [target, still, delay, p]);
  const ap = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - p.value / 100),
  }));
  const num = still ? target : shown;
  return (
    <View
      accessible
      accessibilityLabel={`Təhlükəsizlik balı ${Math.round(target)} / 100`}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={dark ? 'rgba(255,255,255,0.14)' : C.line} strokeWidth={sw} fill="none" />
        <ACircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={scoreColor(target)}
          strokeWidth={sw}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          animatedProps={ap}
        />
      </Svg>
      {showShield && size >= 56 ? <Icon name="shield-check-outline" size={size * 0.2} color={dark ? '#fff' : C.ink2} /> : null}
      <Txt w="xbold" size={size * (showShield && size >= 56 ? 0.28 : 0.34)} color={dark ? '#fff' : C.ink} ls={-0.5} style={{ fontVariant: ['tabular-nums'] }}>
        {Math.round(num)}
      </Txt>
    </View>
  );
});
