import { Ahmed, AhmedArt, AhmedHead, type AhmedPose } from '@/features/mascot';
import { CROPS as MASCOT_CROPS } from '@/features/mascot/art';
import React, { memo, useEffect, useMemo } from 'react';
import { AccessibilityInfo, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { C } from '@/theme';
import { useFx } from '@/hooks/useTheme';
import { useVoice } from '@/voice';
import {
  AVATAR_BG,
  AVATAR_NAME,
  MASCOT,
  PIVOT,
  VB_FULL,
  VB_HEAD,
  avatarArt,
  mascotBack,
  mascotEyes,
  mascotGlow,
  mascotHead,
  mascotWaveArm,
  type Mood,
  type Shape,
  type Who,
} from '@/features/brand/art';
import { Txt } from './ui';
import { LOGO_PATHS, LOGO_RATIO, LOGO_VIEWBOX } from './logoPaths';

/**
 * Brand marks, drawn from the team's own art:
 *  - "hara" logo: the team's SVG (assets/brand/hara-logo.svg), background removed (logoPaths.ts)
 *  - Əhməd: turquoise pin mascot with a navy flat cap (features/brand/art.ts)
 *  - people avatars: Aysel, Murad, Nənə in the same flat style
 */

export type AhmedMood = Mood;
export type AvatarWho = Who;

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled?.()
  .then((v) => (reduceMotion = !!v))
  .catch(() => {});

/* ------------------------------------------------------------------ shapes → svg */

function renderShapes(shapes: Shape[], k = 's'): React.ReactNode[] {
  return shapes.map((s, i) => {
    const key = `${k}${i}`;
    switch (s.t) {
      case 'g':
        return (
          <G key={key} transform={s.tf} opacity={s.op}>
            {renderShapes(s.c, key)}
          </G>
        );
      case 'path':
        return (
          <Path
            key={key}
            d={s.d}
            fill={s.fill ?? 'none'}
            stroke={s.stroke}
            strokeWidth={s.sw}
            strokeLinecap={s.stroke ? 'round' : undefined}
            strokeLinejoin={s.stroke ? 'round' : undefined}
            opacity={s.op}
            transform={s.tf}
          />
        );
      case 'ellipse':
        return <Ellipse key={key} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={s.fill} opacity={s.op} transform={s.tf} />;
      case 'circle':
        return <Circle key={key} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill} opacity={s.op} />;
    }
  });
}

/** One static SVG layer — memoized so animations (UI thread) never re-render it. */
const Layer = memo(function Layer({ shapes, vb, w, h, body }: { shapes: Shape[]; vb: string; w: number; h: number; body?: boolean }) {
  return (
    <Svg width={w} height={h} viewBox={vb} style={{ position: 'absolute', left: 0, top: 0 }}>
      {body ? (
        <Defs>
          <LinearGradient id="ahmedBody" x1="0.2" y1="0" x2="0.8" y2="1">
            <Stop offset="0" stopColor={MASCOT.bodyTop} />
            <Stop offset="1" stopColor={MASCOT.bodyBottom} />
          </LinearGradient>
        </Defs>
      ) : null}
      {renderShapes(shapes)}
    </Svg>
  );
});

/* ------------------------------------------------------------------ logo */

/**
 * "hara" logo — the team's original artwork with the navy background removed, so it sits on
 * any surface. `mono` paints every path one color (white on dark, single-color contexts).
 */
export const HaraWordmark = memo(function HaraWordmark({ width = 120, mono }: { width?: number; mono?: string }) {
  return (
    <Svg width={width} height={width * LOGO_RATIO} viewBox={LOGO_VIEWBOX} accessibilityLabel="hara" accessibilityRole="image">
      {LOGO_PATHS.map((p, i) => (
        <Path key={i} d={p.d} fill={mono ?? p.fill} />
      ))}
    </Svg>
  );
});

/** Navy app tile with the mint wordmark — identical to the launcher icon. */
export const LogoMark = memo(function LogoMark({ size = 36, color = '#071532', style }: { size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      accessibilityLabel="Hara"
      style={[
        { width: size, height: size, borderRadius: size * 0.26, backgroundColor: color, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
        style,
      ]}
    >
      <HaraWordmark width={size * 0.78} />
    </View>
  );
});

export function Logo({ size = 30 }: { size?: number; dark?: boolean }) {
  return <HaraWordmark width={size * 4} />;
}

/* ------------------------------------------------------------------ Əhməd */

function parseVb(vb: string) {
  const [x, y, w, h] = vb.split(' ').map(Number);
  return { x, y, w, h };
}

/** Squash a layer around a horizontal line (px from the view's top) — blink / talking mouth. */
function squashAround(s: number, lineY: number, h: number) {
  'worklet';
  return [{ translateY: (lineY - h / 2) * (1 - s) }, { scaleY: s }];
}

function BlinkEyes({ shapes, vb, w, h, eyeY, enabled }: { shapes: Shape[]; vb: string; w: number; h: number; eyeY: number; enabled: boolean }) {
  const lid = useSharedValue(1);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      t = setTimeout(() => {
        if (!alive) return;
        const twice = Math.random() < 0.22;
        const close = withTiming(0.08, { duration: 70, easing: Easing.in(Easing.quad) });
        const open = withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) });
        lid.value = twice ? withSequence(close, open, close, open) : withSequence(close, open);
        next();
      }, 3000 + Math.random() * 3000);
    };
    next();
    return () => {
      alive = false;
      clearTimeout(t);
      cancelAnimation(lid);
    };
  }, [enabled, lid]);
  const a = useAnimatedStyle(() => ({ transform: squashAround(lid.value, eyeY, h) }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: w, height: h }, a]}>
      <Layer shapes={shapes} vb={vb} w={w} h={h} />
    </Animated.View>
  );
}

const MOUTH_SMILE: Shape[] = [
  { t: 'g', tf: 'translate(20 6)', c: [{ t: 'path', d: 'M43 69 c 4 5.5 12 5.5 16 0', stroke: MASCOT.face, sw: 3.2, fill: 'none' }] },
];
const MOUTH_OPEN: Shape[] = [
  {
    t: 'g',
    tf: 'translate(20 6)',
    c: [
      { t: 'ellipse', cx: 51, cy: 71.5, rx: 5.8, ry: 5.4, fill: MASCOT.face },
      { t: 'ellipse', cx: 51, cy: 74.6, rx: 3.4, ry: 1.9, fill: MASCOT.tongue },
    ],
  },
];

/** Mouth driven by Əhməd's voice level (0..1): smile at rest, opens with the voice. */
function TalkMouth({ vb, w, h, mouthY }: { vb: string; w: number; h: number; mouthY: number }) {
  const { level } = useVoice();
  return <TalkMouthLevel level={level} vb={vb} w={w} h={h} mouthY={mouthY} />;
}

function TalkMouthLevel({ level, vb, w, h, mouthY }: { level: SharedValue<number>; vb: string; w: number; h: number; mouthY: number }) {
  const open = useAnimatedStyle(() => {
    const s = interpolate(level.value, [0, 0.12, 1], [0.05, 0.35, 1], 'clamp');
    return { opacity: level.value > 0.04 ? 1 : 0, transform: squashAround(s, mouthY, h) };
  });
  const rest = useAnimatedStyle(() => ({ opacity: level.value > 0.04 ? 0 : 1 }));
  return (
    <>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: w, height: h }, rest]}>
        <Layer shapes={MOUTH_SMILE} vb={vb} w={w} h={h} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: w, height: h }, open]}>
        <Layer shapes={MOUTH_OPEN} vb={vb} w={w} h={h} />
      </Animated.View>
    </>
  );
}

/** Full-body limbs are static here (the animated full-body rig lives in features/mascot). */
const BACK = [...mascotBack(), ...mascotWaveArm()];
const GLOW = mascotGlow();

/** Gentle idle bob (opt-in via `bob`). */
function Bob({ amp, children, style }: { amp: number; children: React.ReactNode; style: StyleProp<ViewStyle> }) {
  const v = useSharedValue(0);
  const { lite } = useFx();
  useEffect(() => {
    if (lite || reduceMotion) return;
    v.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(v);
  }, [lite, v]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: -amp * v.value }, { scaleY: 1 + 0.012 * v.value }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/**
 * Əhməd — the AI companion. `full` draws the whole (static) character with the raised hand;
 * the default is the head-only pin for small avatars.
 * - `mood`: smile | talk | think | alert | wave (face expression)
 * - `blink`: natural random blink (default on for size ≥ 40)
 * - `speaking`: mouth follows Əhməd's voice level (useVoice)
 * - `bob`: gentle idle float (opt-in)
 */
export const AhmedAvatar = memo(function AhmedAvatar({
  size = 64,
  mood = 'smile',
  full = false,
  glow = full,
  blink,
  speaking = false,
  bob,
  style,
}: {
  size?: number;
  mood?: AhmedMood;
  full?: boolean;
  glow?: boolean;
  blink?: boolean;
  speaking?: boolean;
  bob?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  // Same footprint as before; rendered by the rigged mascot (features/mascot).
  void bob;
  const box = parseVb(full ? VB_FULL : VB_HEAD);
  const w = size;
  const h = (size * box.h) / box.w;
  const crop = full ? MASCOT_CROPS.full : MASCOT_CROPS.head;
  const ch = Math.min(h, (w * crop[3]) / crop[2]);
  const still = blink === false || size < 30;
  const pose: AhmedPose =
    speaking || mood === 'talk' ? 'talk' : mood === 'think' ? 'think' : mood === 'alert' ? 'alert' : mood === 'wave' ? 'wave' : 'idle';
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Əhməd" style={[{ width: w, height: h, alignItems: 'center', justifyContent: full ? 'flex-end' : 'center' }, style]}>
      {full ? (
        still ? (
          <AhmedArt size={ch} pose={pose} glow={glow} />
        ) : (
          <Ahmed size={ch} pose={pose} speaking={speaking} glow={glow} />
        )
      ) : still ? (
        <AhmedArt size={ch} crop="head" pose={pose} glow={false} />
      ) : (
        <AhmedHead size={ch} mood={mood} speaking={speaking} />
      )}
    </View>
  );
});

/* ------------------------------------------------------------------ people */

const INITIAL_WHO: Record<string, Who> = { A: 'aysel', M: 'murad', N: 'nene' };

/**
 * Illustrated person avatar (flat style matching Əhməd). `who` picks the person; the default is
 * Aysel (the app's user). Unknown initials fall back to a soft monogram.
 */
export const Avatar = memo(function Avatar({
  size = 52,
  initials,
  who,
  ring = '#FFFFFF',
  style,
}: {
  size?: number;
  initials?: string;
  who?: Who;
  ring?: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const person: Who | null = who ?? (initials ? INITIAL_WHO[initials.toUpperCase()] ?? null : 'aysel');
  const shapes = useMemo(() => (person ? avatarArt(person) : []), [person]);
  const frame: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: person ? AVATAR_BG[person] : C.brandSoft,
    borderWidth: ring ? Math.max(2, size * 0.04) : 0,
    borderColor: ring ?? undefined,
  };
  if (!person) {
    return (
      <View style={[frame, style]}>
        <Txt w="xbold" size={size * 0.38} color={C.brandDark}>
          {initials}
        </Txt>
      </View>
    );
  }
  const inner = size - (ring ? Math.max(2, size * 0.04) * 2 : 0);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={AVATAR_NAME[person]} style={[frame, style]}>
      <Svg width={inner} height={inner} viewBox="0 0 100 100">
        {renderShapes(shapes)}
      </Svg>
    </View>
  );
});
