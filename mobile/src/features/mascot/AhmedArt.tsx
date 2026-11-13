import React, { memo, useId, useMemo } from 'react';
import Svg, { ClipPath, Defs, Ellipse, G } from 'react-native-svg';
import * as A from './art';
import { renderDefs, renderShapes } from './ArtSvg';
import { KEY_POSES, joints, type PoseP, type Xf } from './pose';
import type { AhmedCrop, AhmedPose } from './Ahmed';

const tf = (x: Xf) => `translate(${x.tx + x.px} ${x.ty + x.py}) rotate(${x.r}) scale(${x.sx} ${x.sy}) translate(${-x.px} ${-x.py})`;

function build(p: PoseP, idp: string, limbs: boolean, glow: boolean, faceOnly = false) {
  const J = joints(p, 1);
  let n = 0;
  const part = (art: A.Art, op = 1) => {
    const id = `${idp}p${n++}_`;
    return (
      <G key={id} opacity={op}>
        {renderDefs(art, id)}
        {renderShapes(art.shapes, id, id)}
      </G>
    );
  };
  const eye = (e: typeof A.EYE_L, closed: number) => {
    const cid = `${idp}eye${n++}`;
    return (
      <G key={cid} transform={`translate(${e.x} ${e.y}) scale(${p.eyeScale}) translate(${-e.x} ${-e.y})`}>
        <Defs>
          <ClipPath id={cid}>
            <Ellipse cx={e.x} cy={e.y} rx={e.rx} ry={e.ry} />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${cid})`}>
          {part(A.eyeWhite(e))}
          <G transform={`translate(${J.pupil.x} ${J.pupil.y})`}>{part(A.pupil(e))}</G>
          <G transform={`translate(0 ${A.lidOffset(e, closed)})`}>{part(A.lid(e))}</G>
        </G>
      </G>
    );
  };
  const arm = (side: 'L' | 'R') => {
    const a = side === 'L' ? p.armL : p.armR;
    const j = side === 'L' ? J.armL : J.armR;
    const wrist: React.ReactNode[] = [];
    if (side === 'R' && p.prop === 'flashlight') wrist.push(part(A.beam(), 0.9), part(A.flashlight()));
    if (side === 'R' && p.prop === 'magnifier') wrist.push(part(A.magnifier()));
    wrist.push(part(A.hand(side, a.hand)));
    return (
      <G key={`arm${side}`} transform={tf(j.sh)}>
        {part(A.upperArm(side))}
        <G transform={tf(j.el)}>
          {part(A.foreArm(side))}
          <G transform={tf(j.wr)}>{wrist}</G>
        </G>
      </G>
    );
  };
  const m = p.mouth;
  const face = (
    <G transform={tf(J.face)}>
      {part(A.CHEEKS)}
      {p.happy > 0.5 ? [part(A.happyEye(A.EYE_L)), part(A.happyEye(A.EYE_R))] : [eye(A.EYE_L, p.lid[0]), eye(A.EYE_R, p.lid[1])]}
      <G transform={tf(J.browL)}>{part(A.BROW_L)}</G>
      <G transform={tf(J.browR)}>{part(A.BROW_R)}</G>
      {m.smile > 0.01 ? part(A.MOUTH_SMILE, m.smile) : null}
      {m.open > 0.01 ? <G transform={`translate(110 ${A.MOUTH_TOP}) scale(${m.wide} ${m.open}) translate(-110 ${-A.MOUTH_TOP})`}>{part(A.MOUTH_OPEN)}</G> : null}
      {m.o > 0.01 ? <G transform={`translate(110 124) scale(${m.o}) translate(-110 -124)`}>{part(A.MOUTH_O)}</G> : null}
      {m.flat > 0.01 ? part(A.MOUTH_FLAT, m.flat) : null}
      {m.wobble > 0.01 ? part(A.MOUTH_WOBBLE, m.wobble) : null}
    </G>
  );
  if (faceOnly) return face;
  const front = limbs && p.armR.front;
  return (
    <>
      {limbs ? part(A.SHADOW) : null}
      <G transform={tf(J.root)}>
        {glow ? part(A.GLOW, 0.6) : null}
        {limbs ? <G transform={tf(J.legL)}>{part(A.leg('L'))}</G> : null}
        {limbs ? <G transform={tf(J.legR)}>{part(A.leg('R'))}</G> : null}
        <G transform={tf(J.body)}>
          {limbs ? arm('L') : null}
          {limbs && !front ? arm('R') : null}
          {part(A.BODY)}
          {part(A.CAP_SHADOW, Math.max(0, 1 - Math.abs(p.cap.y) / 5))}
          {face}
          <G transform={tf(J.cap)}>{part(A.CAP)}</G>
          {front ? arm('R') : null}
        </G>
      </G>
    </>
  );
}

/**
 * Static Əhməd (single <Svg>, no animation) — cheap for lists, markers, icons.
 * `pose` uses the key pose of the animated rig.
 */
export const AhmedArt = memo(function AhmedArt({
  size = 160,
  pose = 'idle',
  crop = 'full',
  glow,
}: {
  size?: number;
  pose?: AhmedPose;
  crop?: AhmedCrop;
  glow?: boolean;
}) {
  const raw = useId();
  const idp = `aa${raw.replace(/[^a-zA-Z0-9]/g, '')}`;
  const box = A.CROPS[crop];
  const content = useMemo(
    () => build(KEY_POSES[pose] ?? KEY_POSES.idle, idp, crop !== 'head', glow ?? crop === 'full'),
    [pose, idp, crop, glow],
  );
  return (
    <Svg width={(size * box[2]) / box[3]} height={size} viewBox={box.join(' ')} accessibilityLabel="Əhməd">
      {content}
    </Svg>
  );
});
