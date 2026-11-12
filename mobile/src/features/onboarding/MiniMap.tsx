import React, { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { Icon, Txt } from '@/components/ui';
import { useFx } from '@/hooks/useTheme';
import { C, R } from '@/theme';

/**
 * Onboarding "Ən az riskli yol" illustration: the straight line across a 6-lane avenue at an
 * unsignalized point (red) redraws into a slightly longer green walk via the signalized crossing.
 * One shared progress value drives everything (UI thread, loops only while visible).
 */

const VB_W = 320;
const VB_H = 230;

// risky: A → B straight across the avenue
const A = { x: 62, y: 192 };
const B = { x: 150, y: 46 };
const RISKY = `M${A.x} ${A.y} L${B.x} ${B.y}`;
const RISKY_LEN = Math.hypot(B.x - A.x, B.y - A.y);
const CROSS_T = (A.y - 122) / (A.y - B.y);
const RISK_PT = { x: A.x + (B.x - A.x) * CROSS_T, y: 122 };

// safe: along the sidewalk to the signalized crossing, over the zebra, back to B
const SAFE_PTS = [A, { x: A.x, y: 162 }, { x: 236, y: 162 }, { x: 236, y: 84 }, { x: B.x, y: 84 }, B];
const SAFE = SAFE_PTS.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
const SAFE_LEN = SAFE_PTS.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - SAFE_PTS[i].x, p.y - SAFE_PTS[i].y), 0);

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

const BLOCK = '#E7ECF3';
const ROAD = '#D9E0EA';

/** Static map art (never re-renders). */
const MapArt = memo(function MapArt() {
  const blocks: [number, number, number, number][] = [
    [14, 14, 80, 54],
    [104, 14, 30, 54],
    [168, 14, 54, 54],
    [252, 14, 54, 54],
    [14, 174, 34, 42],
    [80, 174, 140, 42],
    [252, 174, 54, 42],
  ];
  const zebra = Array.from({ length: 6 }, (_, i) => 101 + i * 7.4);
  return (
    <>
      <Rect x={0} y={0} width={VB_W} height={VB_H} rx={22} fill="#F4F7FB" />
      {blocks.map(([x, y, w, h], i) => (
        <Rect key={i} x={x} y={y} width={w} height={h} rx={9} fill={BLOCK} />
      ))}
      {/* side street */}
      <Rect x={226} y={0} width={20} height={VB_H} fill="#EDF1F6" />
      {/* 6-lane avenue */}
      <Rect x={0} y={98} width={VB_W} height={48} fill={ROAD} />
      {[106, 114, 130, 138].map((y) => (
        <Path key={y} d={`M0 ${y} H${VB_W}`} stroke="#FFFFFF" strokeWidth={1.4} strokeDasharray="7 7" opacity={0.9} />
      ))}
      <Path d={`M0 122 H${VB_W}`} stroke="#C2CBD8" strokeWidth={2.2} />
      {/* signalized zebra crossing */}
      {zebra.map((y) => (
        <Rect key={y} x={228} y={y} width={16} height={4} rx={1} fill="#FFFFFF" />
      ))}
      {/* traffic light */}
      <Rect x={252} y={66} width={12} height={28} rx={4} fill={C.navy} />
      <Circle cx={258} cy={72.5} r={2.6} fill="#3B4A61" />
      <Circle cx={258} cy={80} r={2.6} fill="#3B4A61" />
      <Circle cx={258} cy={87.5} r={2.9} fill={C.brand} />
      <Rect x={256.6} y={94} width={2.8} height={8} fill={C.navy} />
    </>
  );
});

function Chip({ p, range, icon, label, color, bg }: { p: SharedValue<number>; range: [number, number, number, number]; icon: string; label: string; color: string; bg: string }) {
  const a = useAnimatedStyle(() => {
    const o = interpolate(p.value, range, [0, 1, 1, 0], 'clamp');
    return { opacity: 0.38 + 0.62 * o, transform: [{ scale: 0.96 + 0.04 * o }] };
  });
  return (
    <Animated.View style={[styles.chip, { backgroundColor: bg }, a]}>
      <Icon name={icon} size={13} color={color} />
      <Txt w="bold" size={11} color={color}>
        {label}
      </Txt>
    </Animated.View>
  );
}

export function MiniMap({ active }: { active: boolean }) {
  const { lite } = useFx();
  const p = useSharedValue(lite ? 0.7 : 0);
  useEffect(() => {
    if (lite) {
      p.value = 0.7;
      return;
    }
    if (!active) {
      cancelAnimation(p);
      p.value = 0;
      return;
    }
    p.value = 0;
    p.value = withRepeat(withTiming(1, { duration: 6200, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(p);
  }, [active, lite, p]);

  const risky = useAnimatedProps(() => {
    const draw = interpolate(p.value, [0.02, 0.16], [0, 1], 'clamp');
    const fade = interpolate(p.value, [0.34, 0.44, 0.93, 0.99], [1, 0.22, 0.22, 0], 'clamp');
    return { strokeDashoffset: RISKY_LEN * (1 - draw), opacity: fade };
  });
  const safe = useAnimatedProps(() => {
    const draw = interpolate(p.value, [0.38, 0.66], [0, 1], 'clamp');
    const fade = interpolate(p.value, [0.93, 0.99], [1, 0], 'clamp');
    return { strokeDashoffset: SAFE_LEN * (1 - draw), opacity: fade };
  });
  const safeHalo = useAnimatedProps(() => {
    const draw = interpolate(p.value, [0.38, 0.66], [0, 1], 'clamp');
    const fade = interpolate(p.value, [0.93, 0.99], [0.25, 0], 'clamp');
    return { strokeDashoffset: SAFE_LEN * (1 - draw), opacity: fade };
  });
  const warn = useAnimatedProps(() => ({
    opacity: interpolate(p.value, [0.12, 0.18, 0.4, 0.46], [0, 1, 1, 0.35], 'clamp') * interpolate(p.value, [0.93, 0.99], [1, 0], 'clamp'),
  }));
  const check = useAnimatedProps(() => ({ opacity: interpolate(p.value, [0.64, 0.7, 0.93, 0.99], [0, 1, 1, 0], 'clamp') }));

  return (
    <View style={styles.wrap}>
      <View style={{ aspectRatio: VB_W / VB_H, width: '100%' }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`}>
          <MapArt />
          {/* risky straight line */}
          <AnimatedPath d={RISKY} stroke={C.danger} strokeWidth={5} strokeLinecap="round" fill="none" strokeDasharray={[RISKY_LEN, RISKY_LEN]} animatedProps={risky} />
          <AnimatedG animatedProps={warn}>
            <Circle cx={RISK_PT.x} cy={RISK_PT.y} r={13} fill={C.danger} opacity={0.18} />
            <Circle cx={RISK_PT.x} cy={RISK_PT.y} r={8.5} fill={C.danger} />
            <Rect x={RISK_PT.x - 1.3} y={RISK_PT.y - 5} width={2.6} height={6} rx={1.2} fill="#FFFFFF" />
            <Circle cx={RISK_PT.x} cy={RISK_PT.y + 3.6} r={1.4} fill="#FFFFFF" />
          </AnimatedG>
          {/* safe walk via the signalized crossing */}
          <AnimatedPath d={SAFE} stroke={C.brand} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={[SAFE_LEN, SAFE_LEN]} animatedProps={safeHalo} />
          <AnimatedPath d={SAFE} stroke={C.brand} strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={[SAFE_LEN, SAFE_LEN]} animatedProps={safe} />
          <AnimatedG animatedProps={check}>
            <Circle cx={236} cy={122} r={9} fill={C.brand} />
            <Path d="M231.8 122.2 l2.9 2.9 l5.2 -5.6" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </AnimatedG>
          {/* start + destination */}
          <Circle cx={A.x} cy={A.y} r={10} fill={C.route} opacity={0.2} />
          <Circle cx={A.x} cy={A.y} r={6.5} fill={C.route} stroke="#FFFFFF" strokeWidth={2.5} />
          <Path d={`M${B.x} ${B.y + 2} c -7 -8 -10 -12 -10 -17 a 10 10 0 1 1 20 0 c 0 5 -3 9 -10 17 z`} fill={C.navy} />
          <Circle cx={B.x} cy={B.y - 15} r={3.6} fill="#FFFFFF" />
        </Svg>
      </View>
      <View style={styles.legend}>
        <Chip p={p} range={[0.1, 0.18, 0.4, 0.48]} icon="alert" label="İşıqforsuz keçid" color={C.danger} bg={C.dangerSoft} />
        <Chip p={p} range={[0.6, 0.68, 0.94, 1]} icon="traffic-light" label="İşıqforlu keçid" color={C.brandDark} bg={C.brandSoft} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: R.lg, overflow: 'hidden', backgroundColor: '#F4F7FB' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, paddingHorizontal: 8, paddingBottom: 12, paddingTop: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 28,
    borderRadius: R.pill,
  },
});
