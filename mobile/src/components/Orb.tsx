import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

/** Dotted gradient sphere (voice-chat reference), in brand orange tones. */

const STOPS = [
  [255, 196, 107], // warm amber (top-left)
  [255, 98, 3], // brand #FF6203
  [255, 61, 113], // pink-red (bottom-right)
];

function mix(t: number) {
  const seg = t < 0.5 ? 0 : 1;
  const lt = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
  const a = STOPS[seg];
  const b = STOPS[seg + 1];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * lt));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function buildDots(n: number) {
  const dots: { x: number; y: number; r: number; o: number; c: string }[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  // slight tilt so the pattern reads as a sphere
  const tilt = 0.45;
  for (let i = 0; i < n; i++) {
    const y0 = 1 - (i / (n - 1)) * 2;
    const rad = Math.sqrt(1 - y0 * y0);
    const th = golden * i;
    const x0 = Math.cos(th) * rad;
    const z0 = Math.sin(th) * rad;
    const y = y0 * Math.cos(tilt) - z0 * Math.sin(tilt);
    const z = y0 * Math.sin(tilt) + z0 * Math.cos(tilt);
    const x = x0;
    if (z < -0.35) continue; // hide far back
    const depth = (z + 1) / 2; // 0 back .. 1 front
    const t = Math.min(1, Math.max(0, (x - y + 1.6) / 3.2));
    dots.push({ x, y, r: 0.6 + depth * 2.1, o: 0.25 + depth * 0.75, c: mix(t) });
  }
  return dots;
}

export function Orb({ size = 240, level = 0, active = true }: { size?: number; level?: number; active?: boolean }) {
  const dots = useMemo(() => buildDots(520), []);
  const spin = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 22000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    b.start();
    return () => {
      loop.stop();
      b.stop();
    };
  }, [spin, breathe]);

  useEffect(() => {
    Animated.spring(scale, {
      toValue: active ? 1 + Math.min(1, level) * 0.16 : 0.92,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start();
  }, [level, active, scale]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const breatheScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  const R = size / 2 - 4;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size * 0.9,
          height: size * 0.9,
          borderRadius: size,
          backgroundColor: 'rgba(255,98,3,0.10)',
          transform: [{ scale: Animated.multiply(scale, breatheScale) }],
        }}
      />
      <Animated.View style={{ transform: [{ rotate }, { scale: Animated.multiply(scale, breatheScale) }] }}>
        <Svg width={size} height={size}>
          {dots.map((d, i) => (
            <Circle key={i} cx={size / 2 + d.x * R} cy={size / 2 + d.y * R} r={d.r * (size / 240)} fill={d.c} opacity={d.o} />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}
