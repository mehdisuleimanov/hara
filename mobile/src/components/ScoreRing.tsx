import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { C, scoreColor } from '@/theme';
import { Icon, Txt } from './ui';

/** Circular 0–100 safety score with a shield icon (green / amber / red). */
export function ScoreRing({
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
  const sw = stroke ?? Math.max(4, size * 0.085);
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const color = scoreColor(score);
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circ;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={dark ? 'rgba(255,255,255,0.12)' : C.line}
          strokeWidth={sw}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={sw}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {showShield && size >= 56 ? (
        <Icon name="shield-check-outline" size={size * 0.2} color={dark ? '#fff' : C.ink2} />
      ) : null}
      <Txt w="xbold" size={size * (showShield && size >= 56 ? 0.28 : 0.34)} color={dark ? '#fff' : C.ink} ls={-0.5}>
        {Math.round(score)}
      </Txt>
    </View>
  );
}
