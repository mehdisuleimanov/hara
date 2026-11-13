import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { AnimatedNumber } from '@/motion';
import { Icon, Txt } from '@/components/ui';
import { C, scoreColor } from '@/theme';
import { Pop } from '@/components/anim';

const ACircle = Animated.createAnimatedComponent(Circle);

/** 0–100 ring that sweeps on the UI thread while the number counts up. */
export function ScoreDial({ score, size = 112, delay = 0 }: { score: number; size?: number; delay?: number }) {
  const sw = 10;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    p.value = withDelay(delay, withTiming(score / 100, { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [score, delay, p]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - p.value) }));
  const col = scoreColor(score);
  return (
    <View accessible accessibilityLabel={`Qiymət ${score} / 100`} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.bg2} strokeWidth={sw} fill="none" />
        <ACircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={col}
          strokeWidth={sw}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          animatedProps={props}
        />
      </Svg>
      <AnimatedNumber value={score} delay={delay} duration={1100} v="num" size={size * 0.3} color={C.ink} />
      <Txt w="semi" size={11} color={C.muted} style={{ marginTop: -2 }}>
        / 100
      </Txt>
    </View>
  );
}

/** 1–5 stars; filled stars pop in one by one. */
export function Stars({ stars, delay = 0, size = 22 }: { stars: number; delay?: number; size?: number }) {
  const col = stars >= 4 ? C.brand : stars === 3 ? C.warn : C.danger;
  return (
    <View accessible accessibilityLabel={`${stars} ulduz, 5 ulduzdan`} style={{ flexDirection: 'row', gap: 3 }}>
      {[0, 1, 2, 3, 4].map((i) =>
        i < stars ? (
          <Pop key={i} delay={delay + i * 130}>
            <Icon name="star" size={size} color={col} />
          </Pop>
        ) : (
          <Icon key={i} name="star-outline" size={size} color={C.faint} />
        ),
      )}
    </View>
  );
}
