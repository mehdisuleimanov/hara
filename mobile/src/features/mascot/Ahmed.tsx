import React, { useEffect, useId, useMemo, useRef } from 'react';
import { Platform, View, type GestureResponderEvent } from 'react-native';
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useFx } from '@/hooks/useTheme';
import {
  BODY,
  BODY_PIVOT,
  BROW_L,
  BROW_L_C,
  BROW_R,
  BROW_R_C,
  CANVAS,
  CAP,
  CAP_PIVOT,
  CAP_SHADOW,
  CHEEKS,
  CROPS,
  CX,
  EYE_L,
  EYE_R,
  GLOW,
  GROUND,
  HAND_KINDS,
  HIP_L,
  HIP_R,
  MOUTH_FLAT,
  MOUTH_O,
  MOUTH_OPEN,
  MOUTH_SMILE,
  MOUTH_TOP,
  MOUTH_WOBBLE,
  SHADOW,
  SHOULDER_L,
  SHOULDER_R,
  THINK_DOT,
  ZZZ,
  beam,
  elbowOf,
  eyeWhite,
  flashlight,
  foreArm,
  hand,
  happyEye,
  leg,
  lensGlint,
  lid,
  magnifier,
  pupil,
  upperArm,
  wristOf,
  type Art,
} from './art';
import { ArtSvg } from './ArtSvg';
import { O, Q, initState, poseIndex, step, type AhmedPose, type RigInput } from './rig';

export type { AhmedPose } from './rig';
export type AhmedProp = 'none' | 'magnifier' | 'flashlight';
export type AhmedCrop = 'full' | 'bust' | 'head';

export type AhmedProps = {
  /** height in dp (default 160) */
  size?: number;
  pose?: AhmedPose;
  /** 0..1 audio level: lip-sync in 'talk', eyes/brows in 'listen' */
  level?: SharedValue<number>;
  /** synthesize natural mouth motion when no level is given */
  speaking?: boolean;
  prop?: AhmedProp;
  facing?: 'left' | 'right';
  crop?: AhmedCrop;
  glow?: boolean;
  /** tap → giggle bounce + haptic; pupils follow the finger while touching */
  interactive?: boolean;
  onPress?: () => void;
  /** degrees for 'point' (0 = right, 90 = up, 180 = left, -90 = down) */
  pointAngle?: number;
  /** @internal UI-thread overrides (AhmedWalker / AhmedDropIn) */
  _pose?: SharedValue<number>;
  _walkPhase?: SharedValue<number>;
  _facing?: SharedValue<number>;
  _impactSeq?: number;
};

const W = CANVAS.w;
const H = CANVAS.h;
const PROP_I: Record<AhmedProp, number> = { none: 0, magnifier: 1, flashlight: 2 };

// static part art (built once)
const P = {
  eyeWL: eyeWhite(EYE_L),
  eyeWR: eyeWhite(EYE_R),
  pupL: pupil(EYE_L),
  pupR: pupil(EYE_R),
  lidL: lid(EYE_L),
  lidR: lid(EYE_R),
  hapL: happyEye(EYE_L),
  hapR: happyEye(EYE_R),
  upL: upperArm('L'),
  upR: upperArm('R'),
  foL: foreArm('L'),
  foR: foreArm('R'),
  handL: HAND_KINDS.map((k) => hand('L', k)),
  handR: HAND_KINDS.map((k) => hand('R', k)),
  legL: leg('L'),
  legR: leg('R'),
  mag: magnifier(),
  glint: lensGlint(),
  torch: flashlight(),
  beam: beam(),
  dot: THINK_DOT(126, 14, 3.4),
  z: ZZZ(150, 42, 5.5),
};

/** rotate/scale around design point (px,py), then translate — for full-canvas joint views */
function jt(s: number, px: number, py: number, tx: number, ty: number, r: number, sx: number, sy: number) {
  'worklet';
  const ox = (px - W / 2) * s;
  const oy = (py - H / 2) * s;
  return [
    { translateX: tx * s + ox },
    { translateY: ty * s + oy },
    { rotate: `${r}deg` },
    { scaleX: sx },
    { scaleY: sy },
    { translateX: -ox },
    { translateY: -oy },
  ];
}

type Ctx = { s: number; idp: string; g1: SharedValue<number[]>; g2: SharedValue<number[]> };
const Rig = React.createContext<Ctx | null>(null);
const useRig = () => React.useContext(Rig) as Ctx;

function Full({ style, children }: { style?: object; children?: React.ReactNode }) {
  const { s } = useRig();
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: W * s, height: H * s }, style]}>
      {children}
    </Animated.View>
  );
}
function Part({ art, ox, oy }: { art: Art; ox?: number; oy?: number }) {
  const { s, idp } = useRig();
  return <ArtSvg art={art} s={s} idp={idp} ox={ox} oy={oy} />;
}

// ───────────── face ─────────────
function Eye({ e, white, pup, lidArt, side }: { e: typeof EYE_L; white: Art; pup: Art; lidArt: Art; side: 'L' | 'R' }) {
  const { s, g1, g2 } = useRig();
  const bx = e.x - e.rx;
  const by = e.y - e.ry;
  const outer = useAnimatedStyle(() => ({ transform: [{ scale: g1.value[O.eyeS] }], opacity: 1 - g2.value[Q.happy] }));
  const pupS = useAnimatedStyle(() => ({ transform: [{ translateX: g1.value[O.pupX] * s }, { translateY: g1.value[O.pupY] * s }] }));
  const lidS = useAnimatedStyle(() => ({ transform: [{ translateY: g1.value[side === 'L' ? O.lidL : O.lidR] * s }] }));
  const box = { position: 'absolute' as const, left: 0, top: 0, width: 2 * e.rx * s, height: 2 * e.ry * s };
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: bx * s, top: by * s, width: 2 * e.rx * s, height: 2 * e.ry * s }, outer]}>
      <View style={{ flex: 1, overflow: 'hidden', borderRadius: e.rx * s }}>
        <Part art={white} ox={bx} oy={by} />
        <Animated.View style={[box, pupS]}>
          <Part art={pup} ox={bx} oy={by} />
        </Animated.View>
        <Animated.View style={[box, lidS]}>
          <Part art={lidArt} ox={bx} oy={by} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

function Face() {
  const { s, g1, g2 } = useRig();
  const face = useAnimatedStyle(() => ({ transform: jt(s, CX, 110, g1.value[O.faceX], g1.value[O.faceY], 0, 1, 1) }));
  const happy = useAnimatedStyle(() => ({ opacity: g2.value[Q.happy] }));
  const bl = useAnimatedStyle(() => ({ transform: jt(s, BROW_L_C.x, BROW_L_C.y, 0, g1.value[O.bly], g1.value[O.blr], 1, 1) }));
  const br = useAnimatedStyle(() => ({ transform: jt(s, BROW_R_C.x, BROW_R_C.y, 0, g1.value[O.bry], g1.value[O.brr], 1, 1) }));
  const smile = useAnimatedStyle(() => ({ opacity: g2.value[Q.smile] }));
  const flat = useAnimatedStyle(() => ({ opacity: g2.value[Q.flat] }));
  const wob = useAnimatedStyle(() => ({ opacity: g2.value[Q.wob] }));
  const open = useAnimatedStyle(() => {
    const o = g1.value[O.open];
    return { opacity: o > 0.1 ? 1 : 0, transform: jt(s, CX, MOUTH_TOP, 0, 0, 0, g1.value[O.wide], Math.max(0.1, o)) };
  });
  const oo = useAnimatedStyle(() => {
    const o = g1.value[O.o];
    return { opacity: o > 0.04 ? 1 : 0, transform: jt(s, CX, 124, 0, 0, 0, Math.max(0.02, o), Math.max(0.02, o)) };
  });
  return (
    <Full style={face}>
      <Part art={CHEEKS} />
      <Eye e={EYE_L} white={P.eyeWL} pup={P.pupL} lidArt={P.lidL} side="L" />
      <Eye e={EYE_R} white={P.eyeWR} pup={P.pupR} lidArt={P.lidR} side="R" />
      <Full style={happy}>
        <Part art={P.hapL} />
        <Part art={P.hapR} />
      </Full>
      <Full style={bl}>
        <Part art={BROW_L} />
      </Full>
      <Full style={br}>
        <Part art={BROW_R} />
      </Full>
      <Full style={smile}>
        <Part art={MOUTH_SMILE} />
      </Full>
      <Full style={flat}>
        <Part art={MOUTH_FLAT} />
      </Full>
      <Full style={wob}>
        <Part art={MOUTH_WOBBLE} />
      </Full>
      <Full style={open}>
        <Part art={MOUTH_OPEN} />
      </Full>
      <Full style={oo}>
        <Part art={MOUTH_O} />
      </Full>
    </Full>
  );
}

// ───────────── limbs ─────────────
function HandVariant({ art, q }: { art: Art; q: number }) {
  const { g2 } = useRig();
  const st = useAnimatedStyle(() => ({ opacity: g2.value[q] }));
  return (
    <Full style={st}>
      <Part art={art} />
    </Full>
  );
}

function PropLayer({ art, q, pivot, glint }: { art: Art; q: number; pivot: { x: number; y: number }; glint?: boolean }) {
  const { s, g1, g2 } = useRig();
  const st = useAnimatedStyle(() => {
    const k = Math.min(1.15, g2.value[q]) * (glint ? g1.value[O.glint] : 1);
    return { opacity: k > 0.02 ? Math.min(1, k * 1.5) : 0, transform: jt(s, pivot.x, pivot.y, 0, 0, glint ? g1.value[O.t] * 90 : 0, Math.max(0.01, k), Math.max(0.01, k)) };
  });
  return (
    <Full style={st}>
      <Part art={art} />
    </Full>
  );
}

function Arm({ side, layer }: { side: 'L' | 'R'; layer: 'back' | 'front' }) {
  const { s, g1, g2 } = useRig();
  const o = side === 'L' ? O.al : O.ar;
  const m = side === 'L' ? 1 : -1;
  const S = side === 'L' ? SHOULDER_L : SHOULDER_R;
  const E = elbowOf(side);
  const Wr = wristOf(side);
  const vis = useAnimatedStyle(() => {
    if (side === 'L') return { opacity: 1 };
    const f = g2.value[Q.front];
    return { opacity: layer === 'front' ? f : 1 - f };
  });
  const sh = useAnimatedStyle(() => ({ transform: jt(s, S.x, S.y, -m * g1.value[o + 3], g1.value[o + 4], m * g1.value[o], 1, 1) }));
  const el = useAnimatedStyle(() => ({ transform: jt(s, E.x, E.y, 0, 0, m * g1.value[o + 1], 1, 1) }));
  const wr = useAnimatedStyle(() => ({ transform: jt(s, Wr.x, Wr.y, 0, 0, m * g1.value[o + 2], g1.value[o + 5], g1.value[o + 5]) }));
  const hands = side === 'L' ? P.handL : P.handR;
  const qh = side === 'L' ? Q.hl : Q.hr;
  const withProps = side === 'R' && layer === 'back';
  return (
    <Full style={vis}>
      <Full style={sh}>
        <Part art={side === 'L' ? P.upL : P.upR} />
        <Full style={el}>
          <Part art={side === 'L' ? P.foL : P.foR} />
          <Full style={wr}>
            {withProps ? <PropLayer art={P.beam} q={Q.torch} pivot={Wr} /> : null}
            {withProps ? <PropLayer art={P.torch} q={Q.torch} pivot={Wr} /> : null}
            {withProps ? <PropLayer art={P.mag} q={Q.mag} pivot={Wr} /> : null}
            {hands.map((a, i) => (
              <HandVariant key={i} art={a} q={qh + i} />
            ))}
            {withProps ? <PropLayer art={P.glint} q={Q.mag} pivot={{ x: Wr.x + 6.5, y: Wr.y + 22 }} glint /> : null}
          </Full>
        </Full>
      </Full>
    </Full>
  );
}

function Leg({ side }: { side: 'L' | 'R' }) {
  const { s, g1 } = useRig();
  const hip = side === 'L' ? HIP_L : HIP_R;
  const o = side === 'L' ? O.ll : O.lr;
  const st = useAnimatedStyle(() => ({ transform: jt(s, hip.x, hip.y, g1.value[o + 2], -g1.value[o + 1], g1.value[o], 1, 1) }));
  return (
    <Full style={st}>
      <Part art={side === 'L' ? P.legL : P.legR} />
    </Full>
  );
}

// ───────────── fx ─────────────
function Dot({ i }: { i: number }) {
  const { s, g1 } = useRig();
  const st = useAnimatedStyle(() => {
    const th = g1.value[O.t] * 1.8 + i * 2.094;
    const d = (Math.sin(th) + 1) / 2;
    const k = 0.62 + 0.42 * d;
    const a = g1.value[O.dots];
    return { opacity: a * (0.5 + 0.5 * d), transform: jt(s, 126, 14, 17 * Math.cos(th), 5 * Math.sin(th) - 2 * d, 0, k * a, k * a) };
  });
  return (
    <Full style={st}>
      <Part art={P.dot} />
    </Full>
  );
}
function Zed({ i }: { i: number }) {
  const { s, g1 } = useRig();
  const st = useAnimatedStyle(() => {
    const raw = g1.value[O.t] / 2.6 + i / 3;
    const p = raw - Math.floor(raw);
    const a = g1.value[O.zzz];
    const k = (0.55 + 0.7 * p) * a;
    return { opacity: a * Math.sin(Math.PI * p), transform: jt(s, 150, 42, 12 * p + 2 * Math.sin(p * 9), -36 * p, -10 + 20 * p, Math.max(0.01, k), Math.max(0.01, k)) };
  });
  return (
    <Full style={st}>
      <Part art={P.z} />
    </Full>
  );
}

/**
 * Əhməd — fully rigged, UI-thread animated mascot.
 * Every part is a small static <Svg>; only Animated.View transforms/opacity change per frame.
 */
export function Ahmed({
  size = 160,
  pose = 'idle',
  level,
  speaking = false,
  prop = 'none',
  facing = 'right',
  crop = 'full',
  glow,
  interactive = false,
  onPress,
  pointAngle = 0,
  _pose,
  _walkPhase,
  _facing,
  _impactSeq = 0,
}: AhmedProps) {
  const { lite } = useFx();
  const rawId = useId();
  const idp = useMemo(() => `ah${rawId.replace(/[^a-zA-Z0-9]/g, '')}`, [rawId]);
  const box = CROPS[crop];
  const s = size / box[3];
  const limbs = crop !== 'head';
  const showGlow = glow ?? crop === 'full';

  const input: RigInput = {
    pose: poseIndex(pose),
    prop: PROP_I[prop] ?? 0,
    facing: facing === 'left' ? -1 : 1,
    pointAngle,
    speaking: speaking ? 1 : 0,
    hasLevel: level ? 1 : 0,
    lite: lite ? 1 : 0,
    touch: 0,
    tx: 0,
    ty: 0,
    tapSeq: 0,
    impactSeq: _impactSeq,
    walkPhase: -1,
  };
  const init = useMemo(() => {
    const st0 = initState(input.pose, input.facing);
    const r = step(st0, input, 0, 0.016, 0);
    return { st0, g1: r[0], g2: r[1] ?? new Array(Q.N).fill(0) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const inp = useSharedValue<RigInput>(input);
  const st = useSharedValue(init.st0);
  const g1 = useSharedValue<number[]>(init.g1);
  const g2 = useSharedValue<number[]>(init.g2);
  const touchRef = useRef({ x: 0, y: 0, t: 0, moved: false, seq: 0 });

  useEffect(() => {
    const cur = inp.value;
    inp.value = {
      ...input,
      touch: cur.touch,
      tx: cur.tx,
      ty: cur.ty,
      tapSeq: cur.tapSeq,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.pose, input.prop, input.facing, input.pointAngle, input.speaking, input.hasLevel, input.lite, input.impactSeq]);

  useFrameCallback((fi) => {
    'worklet';
    const now = fi.timestamp / 1000;
    const dt = Math.min(0.05, Math.max(0.001, (fi.timeSincePreviousFrame ?? 16) / 1000));
    const i = inp.value;
    const pv = _pose ? _pose.value : -1;
    const wp = _walkPhase ? _walkPhase.value : -1;
    const fv = _facing ? _facing.value : 0;
    const eff: RigInput = pv >= 0 || wp >= 0 || fv !== 0 ? { ...i, pose: pv >= 0 ? pv : i.pose, walkPhase: wp, facing: fv !== 0 ? fv : i.facing } : i;
    const r = step(st.value, eff, now, dt, level ? level.value : 0);
    g1.value = r[0];
    if (r[1]) g2.value = r[1];
  });

  // ── styles ──
  const shadowS = useAnimatedStyle(() => {
    const k = g1.value[O.shadow];
    return { opacity: k, transform: jt(s, CX, GROUND, 0, 0, 0, k, k) };
  });
  const rootS = useAnimatedStyle(() => ({
    transform: jt(s, CX, GROUND, 0, g1.value[O.rootY], g1.value[O.rootR], g1.value[O.rootSX], g1.value[O.rootSY]),
  }));
  const glowS = useAnimatedStyle(() => ({ opacity: 0.6 * g1.value[O.glow] }));
  const bodyS = useAnimatedStyle(() => ({
    transform: jt(s, BODY_PIVOT.x, BODY_PIVOT.y, 0, g1.value[O.bodyY], g1.value[O.bodyR], g1.value[O.bodySX], g1.value[O.bodySY]),
  }));
  const capS = useAnimatedStyle(() => ({ transform: jt(s, CAP_PIVOT.x, CAP_PIVOT.y, g1.value[O.capX], g1.value[O.capY], g1.value[O.capR], 1, 1) }));
  const capShadowS = useAnimatedStyle(() => ({ opacity: g2.value[Q.capShadow] }));

  const ctx = useMemo<Ctx>(() => ({ s, idp, g1, g2 }), [s, idp, g1, g2]);

  // ── touch ──
  const toDesign = (e: GestureResponderEvent) => ({ x: e.nativeEvent.locationX / s + box[0], y: e.nativeEvent.locationY / s + box[1] });
  const responder = interactive
    ? {
        onStartShouldSetResponder: () => true,
        onResponderGrant: (e: GestureResponderEvent) => {
          const p = toDesign(e);
          touchRef.current = { ...touchRef.current, x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, t: Date.now(), moved: false };
          inp.value = { ...inp.value, touch: 1, tx: p.x, ty: p.y };
        },
        onResponderMove: (e: GestureResponderEvent) => {
          const p = toDesign(e);
          const r = touchRef.current;
          if (Math.abs(e.nativeEvent.pageX - r.x) + Math.abs(e.nativeEvent.pageY - r.y) > 12) r.moved = true;
          inp.value = { ...inp.value, touch: 1, tx: p.x, ty: p.y };
        },
        onResponderRelease: () => {
          const r = touchRef.current;
          const tap = !r.moved && Date.now() - r.t < 500;
          if (tap) {
            r.seq += 1;
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onPress?.();
          }
          inp.value = { ...inp.value, touch: 0, tapSeq: r.seq };
        },
        onResponderTerminate: () => {
          inp.value = { ...inp.value, touch: 0 };
        },
      }
    : {};

  return (
    <Rig.Provider value={ctx}>
      <View
        accessible
        accessibilityRole={interactive ? 'button' : 'image'}
        accessibilityLabel="Əhməd"
        style={{ width: box[2] * s, height: box[3] * s, overflow: crop === 'head' ? 'hidden' : 'visible' }}
        {...responder}
      >
        <View pointerEvents="none" style={{ position: 'absolute', left: -box[0] * s, top: -box[1] * s, width: W * s, height: H * s }}>
          {limbs ? (
            <Full style={shadowS}>
              <Part art={SHADOW} />
            </Full>
          ) : null}
          <Full style={rootS}>
            {showGlow ? (
              <Full style={glowS}>
                <Part art={GLOW} />
              </Full>
            ) : null}
            {limbs ? <Leg side="L" /> : null}
            {limbs ? <Leg side="R" /> : null}
            <Full style={bodyS}>
              {limbs ? <Arm side="L" layer="back" /> : null}
              {limbs ? <Arm side="R" layer="back" /> : null}
              <Part art={BODY} />
              <Full style={capShadowS}>
                <Part art={CAP_SHADOW} />
              </Full>
              <Face />
              <Full style={capS}>
                <Part art={CAP} />
              </Full>
              {limbs ? <Arm side="R" layer="front" /> : null}
              <Dot i={0} />
              <Dot i={1} />
              <Dot i={2} />
              <Zed i={0} />
              <Zed i={1} />
              <Zed i={2} />
            </Full>
          </Full>
        </View>
      </View>
    </Rig.Provider>
  );
}
