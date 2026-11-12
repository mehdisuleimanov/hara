import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { C, scoreColor } from '@/theme';
import { Txt } from './ui';

/**
 * Lightweight animated charts (react-native-svg + Animated). Each chart has a
 * text summary for screen readers (color is never the only signal).
 */

/** Vertical bars that grow from the baseline with a stagger. */
export function BarChart({
  data,
  labels,
  height = 130,
  highlight = data.length - 1,
  barWidth = 22,
  a11y,
}: {
  data: number[];
  labels: string[];
  height?: number;
  highlight?: number;
  barWidth?: number;
  a11y?: string;
}) {
  const max = Math.max(...data, 1);
  const anims = useRef(data.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(
      70,
      anims.map((a) => Animated.spring(a, { toValue: 1, speed: 10, bounciness: 6, useNativeDriver: true })),
    ).start();
  }, [anims]);
  return (
    <View accessible accessibilityLabel={a11y} style={{ flexDirection: 'row', alignItems: 'flex-end', height: height + 22 }}>
      {data.map((v, i) => {
        const h = 10 + (v / max) * (height - 10);
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <View style={{ height, justifyContent: 'flex-end', overflow: 'hidden' }}>
              <Animated.View
                style={{
                  width: barWidth,
                  height: h,
                  borderRadius: barWidth / 2,
                  backgroundColor: i === highlight ? C.route : '#BFD5FB',
                  transform: [{ translateY: anims[i].interpolate({ inputRange: [0, 1], outputRange: [h, 0] }) }],
                }}
              />
            </View>
            <Txt w="semi" size={11.5} color={i === highlight ? C.ink : C.muted}>
              {labels[i]}
            </Txt>
          </View>
        );
      })}
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Donut with segments that sweep in. */
export function Donut({
  segments,
  size = 150,
  thickness = 20,
  center,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
  thickness?: number;
  center?: React.ReactNode;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [v]);
  let acc = 0;
  return (
    <View
      accessible
      accessibilityLabel={segments.map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(', ')}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.bg2} strokeWidth={thickness} fill="none" />
        {segments.map((s, i) => {
          const len = (s.value / total) * circ;
          const offset = acc;
          acc += len;
          return (
            <AnimatedCircle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={s.color}
              strokeWidth={thickness}
              fill="none"
              strokeDasharray={`${Math.max(0, len - 3)} ${circ}`}
              strokeDashoffset={v.interpolate({ inputRange: [0, 1], outputRange: [-offset + len, -offset] })}
              opacity={v.interpolate({ inputRange: [0, 0.2 + i * 0.1, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' })}
            />
          );
        })}
      </Svg>
      {center}
    </View>
  );
}

/** Smooth area/line chart with gradient fill; reveals left→right. */
export function AreaChart({
  values,
  height = 120,
  color = C.route,
  fill = C.route,
  a11y,
}: {
  values: number[];
  height?: number;
  color?: string;
  fill?: string;
  a11y?: string;
}) {
  const [w, setW] = useState(0);
  const reveal = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!w) return;
    Animated.timing(reveal, { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [w, reveal]);
  const min = Math.min(...values) - 5;
  const max = Math.max(...values) + 5;
  const pts = values.map((v, i) => ({ x: (i / (values.length - 1)) * w, y: 8 + (1 - (v - min) / (max - min)) * (height - 16) }));
  let line = '';
  pts.forEach((p, i) => {
    if (!i) line = `M${p.x},${p.y}`;
    else {
      const prev = pts[i - 1];
      const cx = (prev.x + p.x) / 2;
      line += ` C${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`;
    }
  });
  const area = `${line} L${w},${height} L0,${height} Z`;
  const last = pts[pts.length - 1];
  return (
    <View accessible accessibilityLabel={a11y} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ height }}>
      {w ? (
        <Animated.View style={{ height, overflow: 'hidden', width: reveal.interpolate({ inputRange: [0, 1], outputRange: [0, w] }) }}>
          <Svg width={w} height={height}>
            <Defs>
              <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={fill} stopOpacity={0.55} />
                <Stop offset="1" stopColor={fill} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>
            <Path d={area} fill="url(#areaFill)" />
            <Path d={line} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" />
            {last ? <Circle cx={last.x - 1} cy={last.y} r={6} fill={fill} stroke={color} strokeWidth={3} /> : null}
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Horizontal stacked strip: safety of each part of a route (green/amber/red). */
export function RiskStrip({ parts, height = 10 }: { parts: number[]; height?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v]);
  const risky = parts.filter((p) => p < 55).length;
  return (
    <View
      accessible
      accessibilityLabel={`Marşrut boyu ${parts.length} hissə, ${risky} riskli`}
      style={{ height, borderRadius: height / 2, overflow: 'hidden', backgroundColor: C.bg2 }}
    >
      <Animated.View
        style={{
          flexDirection: 'row',
          height,
          gap: 2,
          transform: [{ scaleX: v }, { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) }],
        }}
      >
        {parts.map((p, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: scoreColor(p) }} />
        ))}
      </Animated.View>
    </View>
  );
}

/** 24-hour risk mini bars for a crossing (night hours higher). */
export function HourlyRisk({ day, night }: { day: number; night: number }) {
  const hours = Array.from({ length: 24 }, (_, h) => {
    const isNight = h >= 19 || h < 6;
    const rush = h === 8 || h === 9 || h === 18 || h === 19;
    const base = isNight ? 100 - night : 100 - day;
    return Math.min(100, base + (rush ? 12 : 0) + ((h * 37) % 9));
  });
  const max = Math.max(...hours, 1);
  const now = new Date().getHours();
  const anims = useRef(hours.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(18, anims.map((a) => Animated.timing(a, { toValue: 1, duration: 260, useNativeDriver: true }))).start();
  }, [anims]);
  return (
    <View accessible accessibilityLabel={`Risk saatlara görə: gecə ${100 - night}, gündüz ${100 - day}`}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 46, gap: 2 }}>
        {hours.map((v, h) => {
          const bh = 6 + (v / max) * 40;
          return (
            <View key={h} style={{ flex: 1, height: 46, justifyContent: 'flex-end', overflow: 'hidden' }}>
              <Animated.View
                style={{
                  height: bh,
                  borderRadius: 3,
                  backgroundColor: h === now ? C.route : scoreColor(100 - v),
                  opacity: h === now ? 1 : 0.85,
                  transform: [{ translateY: anims[h].interpolate({ inputRange: [0, 1], outputRange: [bh, 0] }) }],
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        {['00', '06', '12', '18', '24'].map((t) => (
          <Txt key={t} w="semi" size={10.5} color={C.muted}>
            {t}
          </Txt>
        ))}
      </View>
    </View>
  );
}
