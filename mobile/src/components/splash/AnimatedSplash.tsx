import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { ARROW_ORIGIN, ARROW_REGION, LOGO_LAYERS, MOTION_VIEWBOX, ROUTE_CENTERLINE, ROUTE_LEN, ROUTE_PTS } from './logoLayers';
import { T, arrowFrame, depthFrame, dotFrame, letterFrame, routeDraw, routeHead } from './timeline';

/**
 * Intro animation of the "hara" logo, shown once over the app on cold start.
 * The timeline (timeline.ts) is shared with the social-video renderer, so both look the same:
 * dot drops → route draws out of it → letters hop in → arrow snaps → 3D depth pops.
 * Tap anywhere to skip. With "reduce motion" on, the finished logo is shown briefly instead.
 */

export const SPLASH_BG = '#071532';
const MINT = '#71FAC8';
const HOLD_MS = 350;
const FADE_MS = 320;

const VB = MOTION_VIEWBOX;
const VIEWBOX = `${VB.x} ${VB.y} ${VB.w} ${VB.h}`;
const LETTERS = ['h', 'a1', 'r', 'a2'] as const;

const AnimatedPath = Animated.createAnimatedComponent(Path);

export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const [boxW, setBoxW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setBoxW(Math.min(e.nativeEvent.layout.width * 0.78, 360));

  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  const veil = useSharedValue(1);
  const finished = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    timers.current.forEach(clearTimeout);
    veil.value = withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.quad) });
    timers.current = [setTimeout(onDone, FADE_MS + 20)];
  };

  useEffect(() => {
    if (!boxW) return;
    if (reduce) {
      t.value = T.end;
      timers.current.push(setTimeout(finish, 600));
    } else {
      t.value = withTiming(T.end, { duration: T.end, easing: Easing.linear });
      timers.current.push(setTimeout(finish, T.end + HOLD_MS));
    }
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxW, reduce]);

  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, veilStyle]} onLayout={onLayout}>
      <StatusBar style="light" />
      <Pressable style={styles.center} onPress={finish} accessibilityRole="image" accessibilityLabel="hara">
        {boxW > 0 ? <Logo t={t} w={boxW} /> : null}
      </Pressable>
    </Animated.View>
  );
}

/** Viewbox → px helpers for one box width. */
function useGeometry(w: number) {
  return useMemo(() => {
    const k = w / VB.w;
    const h = VB.h * k;
    const px = (x: number) => (x - VB.x) * k;
    const py = (y: number) => (y - VB.y) * k;
    return { k, h, px, py, cx: w / 2, cy: h / 2 };
  }, [w]);
}

function Logo({ t, w }: { t: SharedValue<number>; w: number }) {
  const g = useGeometry(w);
  const box = { width: w, height: g.h };

  return (
    <View style={box}>
      <DepthLayer t={t} w={w} />
      <RouteLayer t={t} w={w} />
      <ArrowLayer t={t} w={w} />
      {LETTERS.map((key, i) => (
        <LetterLayer key={key} t={t} w={w} index={i} layer={key} />
      ))}
      <DotLayer t={t} w={w} />
      <HeadMarker t={t} w={w} />
    </View>
  );
}

function LayerSvg({ w, children }: { w: number; children: React.ReactNode }) {
  const h = (VB.h * w) / VB.w;
  return (
    <Svg width={w} height={h} viewBox={VIEWBOX}>
      {children}
    </Svg>
  );
}

/**
 * Depth (3D extrusion) of the route and letters. It only animates after every letter has
 * landed (T.depthStart > last letter end), so one static layer under the faces is enough.
 */
function DepthLayer({ t, w }: { t: SharedValue<number>; w: number }) {
  const { k } = useGeometry(w);
  const style = useAnimatedStyle(() => {
    const d = depthFrame(t.value);
    return { opacity: d.opacity, transform: [{ translateX: d.dx * k }, { translateY: d.dy * k }] };
  });
  const parts = useMemo(() => (['route', ...LETTERS] as const).flatMap((key) => LOGO_LAYERS[key].depth), []);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <LayerSvg w={w}>
        {parts.map((p, i) => (
          <Path key={i} d={p.d} fill={p.fill} />
        ))}
      </LayerSvg>
    </Animated.View>
  );
}

/** Route band, revealed by stroking its centreline inside a clip of the band shape. */
function RouteLayer({ t, w }: { t: SharedValue<number>; w: number }) {
  const props = useAnimatedProps(() => ({ strokeDashoffset: ROUTE_LEN * (1 - routeDraw(t.value)) }));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LayerSvg w={w}>
        <Defs>
          <ClipPath id="haraSplashRoute">
            <Path d={LOGO_LAYERS.route.face.d} />
          </ClipPath>
        </Defs>
        <G clipPath="url(#haraSplashRoute)">
          <AnimatedPath
            d={ROUTE_CENTERLINE}
            fill="none"
            stroke={MINT}
            strokeWidth={124}
            strokeDasharray={[ROUTE_LEN, ROUTE_LEN]}
            animatedProps={props}
          />
        </G>
      </LayerSvg>
    </View>
  );
}

/** Scale about a point (o, in px) for a view whose transform origin is its centre (c). */
function aboutPoint(ox: number, oy: number, cx: number, cy: number, sx: number, sy: number, tx: number, ty: number) {
  'worklet';
  return [
    { translateX: (ox - cx) * (1 - sx) + tx },
    { translateY: (oy - cy) * (1 - sy) + ty },
    { scaleX: Math.max(sx, 0.0001) },
    { scaleY: Math.max(sy, 0.0001) },
  ];
}

function ArrowLayer({ t, w }: { t: SharedValue<number>; w: number }) {
  const g = useGeometry(w);
  const ox = g.px(ARROW_ORIGIN[0]);
  const oy = g.py(ARROW_ORIGIN[1]);
  const { cx, cy } = g;
  const style = useAnimatedStyle(() => {
    const a = arrowFrame(t.value);
    return { opacity: a.opacity, transform: aboutPoint(ox, oy, cx, cy, a.scale, a.scale, 0, 0) };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <LayerSvg w={w}>
        <Defs>
          <ClipPath id="haraSplashArrow">
            <Path d={LOGO_LAYERS.route.face.d} />
          </ClipPath>
        </Defs>
        <G clipPath="url(#haraSplashArrow)">
          <Path d={ARROW_REGION} fill={MINT} />
        </G>
      </LayerSvg>
    </Animated.View>
  );
}

function LetterLayer({ t, w, index, layer }: { t: SharedValue<number>; w: number; index: number; layer: (typeof LETTERS)[number] }) {
  const g = useGeometry(w);
  const L = LOGO_LAYERS[layer];
  const ox = g.px((L.bbox[0] + L.bbox[2]) / 2);
  const oy = g.py(L.bbox[3]);
  const { cx, cy, k } = g;
  const style = useAnimatedStyle(() => {
    const f = letterFrame(t.value, index);
    return { opacity: f.opacity, transform: aboutPoint(ox, oy, cx, cy, f.scale, f.scale, 0, f.ty * k) };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <LayerSvg w={w}>
        <Path d={L.face.d} fill={L.face.fill} />
      </LayerSvg>
    </Animated.View>
  );
}

function DotLayer({ t, w }: { t: SharedValue<number>; w: number }) {
  const g = useGeometry(w);
  const L = LOGO_LAYERS.dot;
  const ox = g.px((L.bbox[0] + L.bbox[2]) / 2);
  const oy = g.py(L.bbox[3]);
  const { cx, cy, k } = g;
  const style = useAnimatedStyle(() => {
    const d = dotFrame(t.value);
    return { opacity: d.opacity, transform: aboutPoint(ox, oy, cx, cy, d.sx, d.sy, 0, d.ty * k) };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <LayerSvg w={w}>
        {L.depth.map((p, i) => (
          <Path key={i} d={p.d} fill={p.fill} />
        ))}
        <Path d={L.face.d} fill={L.face.fill} />
      </LayerSvg>
    </Animated.View>
  );
}

/** Glowing "you" marker riding the drawing front of the route. */
function HeadMarker({ t, w }: { t: SharedValue<number>; w: number }) {
  const { k } = useGeometry(w);
  const size = 108 * k;
  const pts = ROUTE_PTS;
  const style = useAnimatedStyle(() => {
    const h = routeHead(t.value, pts);
    return {
      opacity: h.opacity,
      transform: [{ translateX: (h.x - VB.x) * k - size / 2 }, { translateY: (h.y - VB.y) * k - size / 2 }],
    };
  });
  return (
    <Animated.View style={[styles.head, { width: size, height: size }, style]} pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 108 108">
        <Defs>
          <RadialGradient id="haraSplashHead" cx="54" cy="54" r="54" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
            <Stop offset="0.35" stopColor={MINT} stopOpacity={0.55} />
            <Stop offset="1" stopColor={MINT} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={54} cy={54} r={54} fill="url(#haraSplashHead)" />
        <Circle cx={54} cy={54} r={17} fill="#FFFFFF" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: SPLASH_BG, zIndex: 1000 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: { position: 'absolute', left: 0, top: 0 },
});
