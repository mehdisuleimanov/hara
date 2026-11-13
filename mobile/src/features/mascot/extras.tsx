import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { CROPS } from './art';
import { Ahmed, type AhmedPose } from './Ahmed';
import { AhmedArt } from './AhmedArt';
import { POSES } from './rig';
import { useFx } from '@/hooks/useTheme';

/** Small animated avatar (head crop): blinks, glances, lip-syncs. No glow. */
export function AhmedHead({
  size = 48,
  speaking,
  level,
  mood = 'smile',
}: {
  size?: number;
  speaking?: boolean;
  level?: SharedValue<number>;
  mood?: 'smile' | 'talk' | 'think' | 'alert' | 'wave';
}) {
  const pose: AhmedPose = mood === 'talk' ? 'talk' : mood === 'think' ? 'think' : mood === 'alert' ? 'alert' : mood === 'wave' ? 'wave' : 'idle';
  return <Ahmed size={size} crop="head" glow={false} pose={pose} speaking={speaking ?? mood === 'talk'} level={level} />;
}

const WALK = POSES.indexOf('walk');
const IDLE = POSES.indexOf('idle');

/**
 * Əhməd walking along a horizontal track (navigation progress).
 * Feet are phase-locked to the distance travelled (no foot sliding); idles when progress stops.
 */
export function AhmedWalker({ progress, width, size = 56 }: { progress: SharedValue<number> | number; width: number; size?: number }) {
  const { lite } = useFx();
  const charW = (size * CROPS.full[2]) / CROPS.full[3];
  const track = Math.max(0, width - charW * 0.8);
  const numeric = useSharedValue(typeof progress === 'number' ? progress : 0);
  useEffect(() => {
    if (typeof progress === 'number') numeric.value = progress;
  }, [progress, numeric]);
  const src = typeof progress === 'number' ? numeric : progress;
  const x = useSharedValue(-1);
  const pose = useSharedValue(IDLE);
  const phase = useSharedValue(0);
  const facing = useSharedValue(1);
  const still = useSharedValue(1);
  useFrameCallback((fi) => {
    'worklet';
    const dt = Math.min(0.05, (fi.timeSincePreviousFrame ?? 16) / 1000);
    const target = Math.min(1, Math.max(0, src.value)) * track;
    if (x.value < 0) x.value = target;
    const nx = x.value + (target - x.value) * (1 - Math.exp(-dt / 0.35));
    const dx = nx - x.value;
    x.value = nx;
    const speed = Math.abs(dx) / Math.max(dt, 0.001);
    if (speed > size * 0.12) {
      still.value = 0;
      if (!lite) pose.value = WALK;
      facing.value = dx >= 0 ? 1 : -1;
      // one cycle (two steps) ≈ 0.95 × size of travel
      phase.value = (phase.value + Math.abs(dx) / (size * 0.95)) % 1;
    } else {
      still.value += dt;
      if (still.value > 0.25) pose.value = IDLE;
    }
  });
  const st = useAnimatedStyle(() => ({ opacity: x.value < 0 ? 0 : 1, transform: [{ translateX: Math.max(0, x.value) - charW * 0.1 }] }));
  return (
    <View style={{ width, height: size, overflow: 'visible' }}>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, st]}>
        <Ahmed size={size} glow={false} _pose={pose} _walkPhase={phase} _facing={facing} />
      </Animated.View>
    </View>
  );
}

/** Falls in from above, squash-and-stretch landing, cap pops, then switches to `then` (default wave). */
export function AhmedDropIn({ size = 160, onLanded, then = 'wave' }: { size?: number; onLanded?: () => void; then?: AhmedPose }) {
  const { lite } = useFx();
  const y = useSharedValue(lite ? 0 : -size * 1.6);
  const sy = useSharedValue(1);
  const puff = useSharedValue(0);
  const [impact, setImpact] = useState(0);
  const [pose, setPose] = useState<AhmedPose>('idle');
  const landed = useRef(onLanded);
  landed.current = onLanded;
  const land = () => {
    setImpact((n) => n + 1);
    setTimeout(() => {
      setPose(then);
      landed.current?.();
    }, 650);
  };
  useEffect(() => {
    if (lite) {
      setPose(then);
      landed.current?.();
      return;
    }
    sy.value = withSequence(withTiming(1.12, { duration: 420 }), withTiming(1, { duration: 120 }));
    y.value = withDelay(
      120,
      withTiming(0, { duration: 480, easing: Easing.in(Easing.quad) }, (fin) => {
        if (fin) runOnJS(land)();
      }),
    );
    puff.value = withDelay(600, withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fall = useAnimatedStyle(() => ({
    opacity: y.value < -size * 1.5 ? 0 : 1,
    transform: [{ translateY: y.value }, { translateY: size * 0.5 }, { scaleY: sy.value }, { scaleX: 1 / Math.sqrt(sy.value) }, { translateY: -size * 0.5 }],
  }));
  const puffL = useAnimatedStyle(() => ({
    opacity: puff.value > 0 ? 0.5 * (1 - puff.value) : 0,
    transform: [{ translateX: -size * 0.28 * puff.value }, { scale: 0.4 + puff.value }],
  }));
  const puffR = useAnimatedStyle(() => ({
    opacity: puff.value > 0 ? 0.5 * (1 - puff.value) : 0,
    transform: [{ translateX: size * 0.28 * puff.value }, { scale: 0.4 + puff.value }],
  }));
  const charW = (size * CROPS.full[2]) / CROPS.full[3];
  const dust = { position: 'absolute' as const, bottom: size * 0.03, left: charW / 2 - size * 0.06, width: size * 0.12, height: size * 0.07, borderRadius: size, backgroundColor: '#CFE9E3' };
  return (
    <View style={{ width: charW, height: size }}>
      <Animated.View style={[dust, puffL]} />
      <Animated.View style={[dust, puffR]} />
      <Animated.View style={fall}>
        <Ahmed size={size} pose={pose} _impactSeq={impact} />
      </Animated.View>
    </View>
  );
}

/**
 * Drop-in replacement for Brand.tsx `AhmedAvatar` ({ size = width, mood, full, glow })
 * — keeps the same footprint. `blink={false}` renders the cheap static art.
 */
export function AhmedAvatarCompat({
  size = 64,
  mood = 'smile',
  speaking,
  blink = true,
  full = false,
  glow,
}: {
  size?: number;
  mood?: 'smile' | 'talk';
  speaking?: boolean;
  blink?: boolean;
  full?: boolean;
  glow?: boolean;
}) {
  const talk = mood === 'talk' || !!speaking;
  if (full) {
    // Brand: width = size, height = size * 150/140
    const h = size * (150 / 140);
    const crop = CROPS.full;
    const ch = Math.min(h, (size * crop[3]) / crop[2]);
    return (
      <View style={{ width: size, height: h, alignItems: 'center', justifyContent: 'flex-end' }}>
        {blink ? <Ahmed size={ch} pose={talk ? 'talk' : 'wave'} speaking={talk} glow={glow ?? true} /> : <AhmedArt size={ch} pose={talk ? 'talk' : 'wave'} glow={glow ?? true} />}
      </View>
    );
  }
  // Brand head avatar: width = size, height = size * 1.16
  const h = size * 1.16;
  const crop = CROPS.head;
  const ch = (size * crop[3]) / crop[2];
  return (
    <View style={{ width: size, height: h, alignItems: 'center', justifyContent: 'center' }}>
      {blink ? <AhmedHead size={ch} mood={talk ? 'talk' : 'smile'} speaking={talk} /> : <AhmedArt size={ch} crop="head" pose={talk ? 'talk' : 'idle'} />}
    </View>
  );
}
