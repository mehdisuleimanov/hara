import React, { memo } from 'react';
import Svg, { ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { Art, Shape } from './art';

/** id-prefixing renderer for the plain-data art (react-native-svg). */
export function renderShapes(shapes: Shape[], idp: string, keyp = 's'): React.ReactNode[] {
  const fix = (v?: string) => (v && v.startsWith('url(#') ? `url(#${idp}${v.slice(5)}` : v);
  return shapes.map((s, i) => {
    const key = `${keyp}${i}`;
    if (s.k === 'g') {
      return (
        <G key={key} transform={s.tf} opacity={s.op} clipPath={s.clip ? `url(#${idp}${s.clip})` : undefined}>
          {renderShapes(s.ch, idp, `${key}_`)}
        </G>
      );
    }
    const paint = {
      fill: s.fill !== undefined ? fix(s.fill) : '#000',
      stroke: fix(s.stroke),
      strokeWidth: s.stroke ? (s.sw ?? 1) : undefined,
      strokeLinecap: s.stroke ? (s.lc ?? 'butt') : undefined,
      strokeLinejoin: s.stroke ? ('round' as const) : undefined,
      opacity: s.op,
      clipPath: s.clip ? `url(#${idp}${s.clip})` : undefined,
    };
    if (s.k === 'path') return <Path key={key} d={s.d} {...paint} />;
    if (s.k === 'rect') return <Rect key={key} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r ?? 0} {...paint} />;
    return (
      <Ellipse key={key} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={s.rot ? `rotate(${s.rot} ${s.cx} ${s.cy})` : undefined} {...paint} />
    );
  });
}

export function renderDefs(art: Art, idp: string): React.ReactNode {
  if (!art.defs?.length && !art.clips?.length) return null;
  return (
    <Defs>
      {(art.defs ?? []).map((g) => {
        const stops = g.stops.map(([o, c, op], i) => <Stop key={i} offset={o} stopColor={c} stopOpacity={op ?? 1} />);
        return g.k === 'lin' ? (
          <LinearGradient key={g.id} id={idp + g.id} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
            {stops}
          </LinearGradient>
        ) : (
          <RadialGradient key={g.id} id={idp + g.id} cx={g.cx} cy={g.cy} r={g.r} fx={g.fx ?? g.cx} fy={g.fy ?? g.cy}>
            {stops}
          </RadialGradient>
        );
      })}
      {(art.clips ?? []).map((c) => (
        <ClipPath key={c.id} id={idp + c.id}>
          {renderShapes(
            c.shapes.map((s) => ({ ...s, fill: '#000' }) as Shape),
            idp,
            `c${c.id}`,
          )}
        </ClipPath>
      ))}
    </Defs>
  );
}

/**
 * One static part as a tight <Svg> (viewBox = part box, global design coords).
 * `ox/oy` = design-space origin of the parent view (0,0 for full-canvas joints).
 */
export const ArtSvg = memo(function ArtSvg({ art, s, idp, ox = 0, oy = 0 }: { art: Art; s: number; idp: string; ox?: number; oy?: number }) {
  const [x, y, w, h] = art.box;
  return (
    <Svg
      pointerEvents="none"
      style={{ position: 'absolute', left: (x - ox) * s, top: (y - oy) * s }}
      width={w * s}
      height={h * s}
      viewBox={`${x} ${y} ${w} ${h}`}
    >
      {renderDefs(art, idp)}
      {renderShapes(art.shapes, idp)}
    </Svg>
  );
});
