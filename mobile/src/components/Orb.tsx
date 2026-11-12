import React, { useEffect, useId, useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';
import { C } from '@/theme';
import { useFx } from '@/hooks/useTheme';

/**
 * Əhməd's living orb (v2). One UI-thread frame clock drives everything (rotation, breathing,
 * ripples); the SVG layers are static and only their parents transform — cheap on mid-range
 * phones. States: idle (breathing) · listening (mic level) · thinking (fast swirl, AI hue)
 * · speaking (voice level). Lite mode: static gradient + level scale only.
 */
export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

type Props = {
  size?: number;
  /** 0..1 — a number (React state) or a shared value (UI thread) */
  level?: number | SharedValue<number>;
  /** legacy: active=true behaves like "listening" */
  active?: boolean;
  state?: OrbState;
};

const isSV = (v: unknown): v is SharedValue<number> => typeof v === 'object' && v !== null && 'value' in (v as object);

type Dot = { x: number; y: number; r: number; o: number };

function buildDots(n: number, tilt: number, minZ: number): Dot[] {
  const dots: Dot[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y0 = 1 - (i / (n - 1)) * 2;
    const rad = Math.sqrt(1 - y0 * y0);
    const th = golden * i;
    const x0 = Math.cos(th) * rad;
    const z0 = Math.sin(th) * rad;
    const y = y0 * Math.cos(tilt) - z0 * Math.sin(tilt);
    const z = y0 * Math.sin(tilt) + z0 * Math.cos(tilt);
    if (z < minZ) continue;
    const depth = (z + 1) / 2;
    dots.push({ x: x0, y, r: 0.55 + depth * 1.9, o: 0.12 + depth * 0.62 });
  }
  return dots;
}

const SPEED: Record<OrbState, number> = { idle: 9, listening: 22, thinking: 120, speaking: 30 };

export function Orb({ size = 240, level, active = true, state }: Props) {
  const { lite } = useFx();
  const st: OrbState = state ?? (active ? 'listening' : 'idle');
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');

  // level source
  const own = useSharedValue(typeof level === 'number' ? level : 0);
  const src = isSV(level) ? level : own;
  useEffect(() => {
    if (!isSV(level)) own.value = withTiming(Math.max(0, Math.min(1, level ?? 0)), { duration: 140 });
  }, [level, own]);

  // motion state
  const angle = useSharedValue(0);
  const angle2 = useSharedValue(0);
  const clock = useSharedValue(0);
  const lv = useSharedValue(0);
  const speed = useSharedValue(SPEED[st]);
  const ai = useSharedValue(st === 'thinking' ? 1 : 0);
  const reactive = useSharedValue(st === 'listening' || st === 'speaking' ? 1 : 0);

  useEffect(() => {
    speed.value = withTiming(SPEED[st], { duration: 700 });
    ai.value = withTiming(st === 'thinking' ? 1 : 0, { duration: 520 });
    reactive.value = withTiming(st === 'listening' || st === 'speaking' ? 1 : 0, { duration: 300 });
  }, [st, speed, ai, reactive]);

  const frame = useFrameCallback((f) => {
    'worklet';
    const dt = Math.min(0.05, (f.timeSincePreviousFrame ?? 16) / 1000);
    angle.value = (angle.value + speed.value * dt) % 360;
    angle2.value = (angle2.value - speed.value * 1.7 * dt) % 360;
    clock.value = clock.value + dt;
    lv.value = lv.value + (src.value - lv.value) * Math.min(1, dt * 12);
  }, false);
  useEffect(() => {
    frame.setActive(!lite);
  }, [lite, frame]);

  const dotsA = useMemo(() => buildDots(130, 0.42, -0.25), []);
  const dotsB = useMemo(() => buildDots(46, -0.7, 0), []);

  const sphere = useAnimatedStyle(() => {
    const l = lite ? src.value : lv.value;
    const breath = lite ? 0 : Math.sin(clock.value * 1.9) * 0.018;
    const think = lite ? 0 : ai.value * Math.sin(clock.value * 7) * 0.022;
    return { transform: [{ scale: 0.94 + breath + think + l * 0.16 * (lite ? 1 : reactive.value) }] };
  });
  const spinA = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));
  const spinB = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle2.value}deg` }, { scale: 0.86 }], opacity: 0.35 + ai.value * 0.5 }));
  const aiLayer = useAnimatedStyle(() => ({ opacity: ai.value }));
  const halo = useAnimatedStyle(() => {
    const l = lite ? src.value : lv.value;
    const breath = lite ? 0 : (Math.sin(clock.value * 1.9) + 1) * 0.5;
    return { opacity: 0.35 + breath * 0.15 + l * 0.4, transform: [{ scale: 0.92 + breath * 0.04 + l * 0.22 }] };
  });
  const haloAi = useAnimatedStyle(() => ({ opacity: ai.value * 0.75 }));
  const ringAt = (p: number, l: number, on: number) => {
    'worklet';
    return { opacity: (1 - p) * 0.55 * on * (0.35 + l), transform: [{ scale: 0.78 + p * (0.42 + l * 0.25) }] };
  };
  const ring0 = useAnimatedStyle(() => ringAt((clock.value * 0.62) % 1, lv.value, reactive.value));
  const ring1 = useAnimatedStyle(() => ringAt((clock.value * 0.62 + 0.5) % 1, lv.value, reactive.value));

  const S = size;
  const core = S * 0.78;
  const haloS = S * 1.25;
  const R = core / 2;

  return (
    <View style={{ width: S, height: S, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
      {/* halo (brand) + AI tint */}
      <Animated.View style={[{ position: 'absolute', width: haloS, height: haloS }, halo]}>
        <Svg width={haloS} height={haloS}>
          <Defs>
            <RadialGradient id={`h${uid}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0.35" stopColor={C.brand} stopOpacity={0.5} />
              <Stop offset="0.62" stopColor={C.route} stopOpacity={0.16} />
              <Stop offset="1" stopColor={C.route} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={haloS / 2} cy={haloS / 2} r={haloS / 2} fill={`url(#h${uid})`} />
        </Svg>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, haloAi]}>
          <Svg width={haloS} height={haloS}>
            <Defs>
              <RadialGradient id={`ha${uid}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0.35" stopColor={C.ai} stopOpacity={0.55} />
                <Stop offset="0.65" stopColor={C.ai} stopOpacity={0.14} />
                <Stop offset="1" stopColor={C.ai} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={haloS / 2} cy={haloS / 2} r={haloS / 2} fill={`url(#ha${uid})`} />
          </Svg>
        </Animated.View>
      </Animated.View>

      {/* ripples (listening / speaking) */}
      {lite ? null : (
        <>
          <Animated.View style={[ringStyle(core, C.brand), ring0]} />
          <Animated.View style={[ringStyle(core, C.route), ring1]} />
        </>
      )}

      {/* sphere */}
      <Animated.View style={[{ width: core, height: core }, sphere]}>
        <Svg width={core} height={core} style={{ position: 'absolute' }}>
          <Defs>
            <LinearGradient id={`c${uid}`} x1="0.15" y1="0.05" x2="0.9" y2="0.95">
              <Stop offset="0" stopColor="#8BEBC4" />
              <Stop offset="0.45" stopColor={C.brand} />
              <Stop offset="1" stopColor={C.route} />
            </LinearGradient>
          </Defs>
          <Circle cx={R} cy={R} r={R} fill={`url(#c${uid})`} />
        </Svg>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, aiLayer]}>
          <Svg width={core} height={core}>
            <Defs>
              <LinearGradient id={`ca${uid}`} x1="0.15" y1="0.05" x2="0.9" y2="0.95">
                <Stop offset="0" stopColor="#B9B9FF" />
                <Stop offset="0.5" stopColor={C.ai} />
                <Stop offset="1" stopColor={C.route} />
              </LinearGradient>
            </Defs>
            <Circle cx={R} cy={R} r={R} fill={`url(#ca${uid})`} />
          </Svg>
        </Animated.View>

        {lite ? null : (
          <>
            <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: core, height: core }, spinA]}>
              <DotLayer dots={dotsA} size={core} />
            </Animated.View>
            <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: core, height: core }, spinB]}>
              <DotLayer dots={dotsB} size={core} big />
            </Animated.View>
          </>
        )}

        <Svg width={core} height={core} style={{ position: 'absolute' }}>
          <Defs>
            <RadialGradient id={`s${uid}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0.62" stopColor="#0F1B2D" stopOpacity={0} />
              <Stop offset="1" stopColor="#0F1B2D" stopOpacity={0.22} />
            </RadialGradient>
            <RadialGradient id={`g${uid}`} cx="34%" cy="28%" r="42%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.75} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={R} cy={R} r={R} fill={`url(#s${uid})`} />
          <Circle cx={R} cy={R} r={R} fill={`url(#g${uid})`} />
          <Circle cx={R} cy={R} r={R - 1} fill="none" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={1.5} />
        </Svg>
      </Animated.View>
    </View>
  );
}

function ringStyle(core: number, color: string) {
  return {
    position: 'absolute' as const,
    width: core,
    height: core,
    borderRadius: core / 2,
    borderWidth: 2,
    borderColor: color,
  };
}

/** Static dot texture (rendered once; only the parent rotates). */
const DotLayer = React.memo(function DotLayer({ dots, size, big }: { dots: Dot[]; size: number; big?: boolean }) {
  const r = size / 2 - 3;
  const k = size / 200;
  return (
    <Svg width={size} height={size}>
      {dots.map((d, i) => (
        <Circle key={i} cx={size / 2 + d.x * r} cy={size / 2 + d.y * r} r={d.r * k * (big ? 1.25 : 1)} fill="#FFFFFF" opacity={d.o * (big ? 0.8 : 1)} />
      ))}
    </Svg>
  );
});
