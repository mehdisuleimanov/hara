import React, { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Line, Path } from 'react-native-svg';
import { BOX_LABEL_AZ, type BoxLabel, type VisionBox } from '@/ai/vision';
import { Txt } from '@/components/ui';
import { C } from '@/theme';
import { prefs } from '@/store/prefs';

export const BOX_STAGGER = 190;

/** Box colors: blue = people, amber = vehicles, green = protective infrastructure, white = context. */
export function boxColor(l: BoxLabel) {
  if (l === 'pedestrian') return C.route;
  if (l === 'car' || l === 'bus') return C.warn;
  if (l === 'street_light' || l === 'bollard' || l === 'lane_marking') return '#FFFFFF';
  return C.brand;
}

/** Thin scanning grid + viewfinder corners (static SVG, drawn once). */
const Grid = memo(function Grid({ w, h }: { w: number; h: number }) {
  const step = 36;
  const lines = [];
  for (let x = step; x < w; x += step) lines.push(<Line key={`x${x}`} x1={x} y1={0} x2={x} y2={h} stroke="#FFFFFF" strokeOpacity={0.1} strokeWidth={1} />);
  for (let y = step; y < h; y += step) lines.push(<Line key={`y${y}`} x1={0} y1={y} x2={w} y2={y} stroke="#FFFFFF" strokeOpacity={0.1} strokeWidth={1} />);
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      {lines}
    </Svg>
  );
});

export const Corners = memo(function Corners({ w, h, inset = 16, len = 26, color = '#FFFFFF' }: { w: number; h: number; inset?: number; len?: number; color?: string }) {
  const a = inset, b = w - inset, c = h - inset;
  const d = `M${a} ${a + len} L${a} ${a} L${a + len} ${a} M${b - len} ${a} L${b} ${a} L${b} ${a + len} M${b} ${c - len} L${b} ${c} L${b - len} ${c} M${a + len} ${c} L${a} ${c} L${a} ${c - len}`;
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path d={d} stroke={color} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
});

/** Gradient bar sweeping over the frozen frame while the model looks at it. */
function Beam({ h, active }: { h: number; active: boolean }) {
  const y = useSharedValue(0);
  useEffect(() => {
    if (active && !prefs().liteFx) {
      y.value = 0;
      y.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }), -1, true);
    } else cancelAnimation(y);
    return () => cancelAnimation(y);
  }, [active, y]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: -70 + y.value * (h - 20) }] }));
  if (!active) return null;
  return (
    <Animated.View pointerEvents="none" exiting={FadeOut.duration(220)} style={[{ position: 'absolute', left: 0, right: 0, top: 0, height: 90 }, st]}>
      <LinearGradient colors={['rgba(91,91,246,0)', 'rgba(91,91,246,0.38)', 'rgba(91,91,246,0)']} style={{ flex: 1 }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: 44, height: 2, backgroundColor: '#B9B9FF' }} />
    </Animated.View>
  );
}

type Placed = { b: VisionBox; i: number; left: number; top: number; bw: number; bh: number; labelDy: number; alignRight: boolean };

/**
 * Maps 0–1000 boxes onto the cover-fitted photo and places each label pill where it
 * doesn't collide with an earlier one (above → inside → below the box).
 */
function layoutBoxes(boxes: VisionBox[], w: number, h: number, iw: number, ih: number): Placed[] {
  const s = Math.max(w / iw, h / ih);
  const dw = iw * s, dh = ih * s;
  const ox = (w - dw) / 2, oy = (h - dh) / 2;
  const pills: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const out: Placed[] = [];
  boxes.forEach((b, i) => {
    const [y0, x0, y1, x1] = b.box_2d;
    const left = Math.max(2, ox + (x0 / 1000) * dw);
    const top = Math.max(2, oy + (y0 / 1000) * dh);
    const right = Math.min(w - 2, ox + (x1 / 1000) * dw);
    const bottom = Math.min(h - 2, oy + (y1 / 1000) * dh);
    const bw = right - left, bh = bottom - top;
    if (bw < 6 || bh < 6) return;
    const pw = BOX_LABEL_AZ[b.label].length * 7 + 18;
    const natRight = left + pw + 8 > w;
    const dys = [top > 26 ? -24 : null, 3, bottom + 24 < h ? bh + 3 : null].filter((v): v is number => v != null);
    // candidates: each vertical slot, first with the natural alignment, then flipped
    const cands: { dy: number; right: boolean }[] = [];
    for (const dy of dys) {
      cands.push({ dy, right: natRight });
      if (natRight || right - pw >= 2) cands.push({ dy, right: !natRight });
    }
    const x0Of = (r: boolean) => (r ? right - pw : left);
    const free = (c: { dy: number; right: boolean }) => {
      const x0 = x0Of(c.right);
      if (x0 < 0 || x0 + pw > w) return false;
      return !pills.some((q) => x0 < q.x1 + 4 && x0 + pw + 4 > q.x0 && top + c.dy < q.y1 + 2 && top + c.dy + 23 > q.y0);
    };
    const pick = cands.find(free) ?? cands[0];
    const px0 = x0Of(pick.right);
    pills.push({ x0: px0, x1: px0 + pw, y0: top + pick.dy, y1: top + pick.dy + 21 });
    out.push({ b, i, left, top, bw, bh, labelDy: pick.dy, alignRight: pick.right });
  });
  return out;
}

function BoxView({ p, base }: { p: Placed; base: number }) {
  const { b, i, left, top, bw, bh, labelDy, alignRight } = p;
  const col = boxColor(b.label);
  const dark = col === '#FFFFFF';
  const lite = prefs().liteFx;
  return (
    <Animated.View
      pointerEvents="none"
      entering={lite ? FadeIn.duration(120).delay(base + i * 80) : ZoomIn.springify().damping(13).stiffness(210).delay(base + i * BOX_STAGGER)}
      style={{ position: 'absolute', left, top, width: bw, height: bh }}
    >
      <View style={{ flex: 1, borderWidth: 2, borderColor: col, borderRadius: 8, backgroundColor: col === '#FFFFFF' ? 'rgba(255,255,255,0.08)' : `${col}1F` }} />
      <View
        style={{
          position: 'absolute',
          width: 150,
          flexDirection: 'row',
          justifyContent: alignRight ? 'flex-end' : 'flex-start',
          ...(alignRight ? { right: -1 } : { left: -1 }),
          top: labelDy,
        }}
      >
        <View style={{ paddingHorizontal: 8, height: 21, borderRadius: 7, backgroundColor: col, justifyContent: 'center' }}>
          <Txt w="bold" size={11} color={dark ? C.navy : '#FFFFFF'} numberOfLines={1}>
            {BOX_LABEL_AZ[b.label]}
          </Txt>
        </View>
      </View>
    </Animated.View>
  );
}

/**
 * The frozen frame: photo + grid + sweeping beam while scanning, then the detected
 * objects pop in one by one with a light haptic tick each.
 */
export function Stage({
  source,
  iw,
  ih,
  w,
  h,
  phase,
  boxes,
}: {
  source: ImageSourcePropType;
  iw: number;
  ih: number;
  w: number;
  h: number;
  phase: 'scan' | 'done' | 'guide';
  boxes: VisionBox[];
}) {
  const shown = phase === 'done' ? boxes : [];
  // labels placed in the model's importance order; biggest boxes drawn first so small ones stay on top
  const ordered = useMemo(() => {
    const placed = layoutBoxes(shown, w, h, iw, ih);
    const area = (p: Placed) => p.bw * p.bh;
    return placed.sort((p, q) => area(q) - area(p));
  }, [shown, w, h, iw, ih]);
  useEffect(() => {
    if (phase !== 'done' || !boxes.length) return;
    const step = prefs().liteFx ? 80 : BOX_STAGGER;
    const timers = boxes.map((_, i) => setTimeout(() => Haptics.selectionAsync().catch(() => {}), 120 + i * step));
    return () => timers.forEach(clearTimeout);
  }, [phase, boxes]);

  // freeze-frame: shutter flash + the photo settles from a slight zoom
  const flash = useSharedValue(prefs().liteFx ? 0 : 0.9);
  const zoom = useSharedValue(prefs().liteFx ? 1 : 1.07);
  useEffect(() => {
    flash.value = withTiming(0, { duration: 420 });
    zoom.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) });
  }, [flash, zoom]);
  const zoomStyle = useAnimatedStyle(() => ({ transform: [{ scale: zoom.value }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  const dim = useSharedValue(0);
  useEffect(() => {
    dim.value = withTiming(phase === 'scan' ? 0.32 : phase === 'guide' ? 0.5 : 0.08, { duration: 360 });
  }, [phase, dim]);
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.Image source={source} resizeMode="cover" style={[{ position: 'absolute', left: 0, top: 0, width: w, height: h }, zoomStyle]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: C.navy }, dimStyle]} />
      {phase === 'scan' ? (
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(250)} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Grid w={w} h={h} />
        </Animated.View>
      ) : null}
      <Beam h={h} active={phase === 'scan'} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF' }, flashStyle]} />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {ordered.map((p) => (
          <BoxView key={`${p.i}-${p.b.label}`} p={p} base={120} />
        ))}
      </View>
    </View>
  );
}
