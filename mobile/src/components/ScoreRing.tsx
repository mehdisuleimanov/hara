import React, { memo } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { C, scoreColor } from '@/theme';
import { Icon, Txt } from './ui';
import { useCountUp } from './anim';

/** Circular 0–100 safety score; the ring sweeps in and the number counts up. */
export const ScoreRing = memo(function ScoreRing({
  score,
  size = 64,
  stroke,
  dark,
  showShield = true,
}: {
  score: number;
  size?: number;
  stroke?: number;
  dark?: boolean;
  showShield?: boolean;
}) {
  const shown = useCountUp(score, 900);
  const sw = stroke ?? Math.max(4, size * 0.085);
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const color = scoreColor(score);
  const dash = (Math.max(0, Math.min(100, shown)) / 100) * circ;
  return (
    <View
      accessible
      accessibilityLabel={`Təhlükəsizlik balı ${Math.round(score)} / 100`}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={dark ? 'rgba(255,255,255,0.14)' : C.line} strokeWidth={sw} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={sw}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
        />
      </Svg>
      {showShield && size >= 56 ? <Icon name="shield-check-outline" size={size * 0.2} color={dark ? '#fff' : C.ink2} /> : null}
      <Txt w="xbold" size={size * (showShield && size >= 56 ? 0.28 : 0.34)} color={dark ? '#fff' : C.ink} ls={-0.5}>
        {Math.round(shown)}
      </Txt>
    </View>
  );
});
