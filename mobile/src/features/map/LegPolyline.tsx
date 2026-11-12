import React, { memo, useMemo } from 'react';
import { Polyline } from 'react-native-maps';
import type { Leg } from '@/data/types';
import { sliceByFraction } from '@/motion/routeDraw';
import { C } from '@/theme';
import { isUnderground, legLatLngs } from './geometry';

export type LegState = 'active' | 'inactive' | 'done';

/** Core color per mode for the active route. */
export const LEG_COLOR: Record<string, string> = {
  walk: C.route,
  metro: C.underground,
  bus: C.route,
  taxi: '#1D4FC4',
  scooter: C.brand,
  bike: C.brand,
};

/**
 * FROZEN API — draws one route leg styled by mode/state ({leg, state, progress}).
 *  - surface legs: white casing + colored core (casing keeps it readable on satellite too)
 *  - underground (metro) legs: thin dashed plum line — it is a tunnel, not a street
 *  - done legs: faded; inactive (alternatives): thin grey-blue, dashed
 * `progress` (0..1) draws only the first part of the leg (route-draw animation).
 */
export const LegPolyline = memo(function LegPolyline({
  leg,
  state = 'active',
  progress,
  zIndex = 6,
  dark,
  opacity,
}: {
  leg: Leg;
  state?: LegState;
  progress?: number;
  /** inactive legs: fade-in opacity 0..1 */
  opacity?: number;
  /** base zIndex (casing = zIndex, core = zIndex + 1) */
  zIndex?: number;
  /** dark basemap (night / satellite): softer casing */
  dark?: boolean;
}) {
  const all = legLatLngs(leg);
  const p = progress == null ? 1 : progress;
  const coords = useMemo(() => (p >= 1 ? all : sliceByFraction(all, p)), [all, p]);
  if (coords.length < 2 || p <= 0) return null;
  const under = isUnderground(leg);

  if (state === 'done') {
    return (
      <Polyline
        coordinates={coords}
        strokeColor={dark ? 'rgba(255,255,255,0.35)' : 'rgba(15,27,45,0.22)'}
        strokeWidth={under ? 3 : 6}
        lineDashPattern={under ? [6, 8] : undefined}
        lineCap="round"
        lineJoin="round"
        zIndex={zIndex}
      />
    );
  }
  // walk inside a metro station (entrance / exit / transfer): light dotted passage, not a street
  if (leg.indoor && leg.mode === 'walk') {
    if (state === 'inactive' && (opacity ?? 1) <= 0) return null;
    return (
      <Polyline
        coordinates={coords}
        strokeColor={state === 'active' ? (dark ? 'rgba(213,143,176,0.75)' : 'rgba(142,59,91,0.55)') : dark ? 'rgba(255,255,255,0.3)' : 'rgba(15,27,45,0.2)'}
        strokeWidth={3}
        lineDashPattern={[2, 6]}
        lineCap="round"
        lineJoin="round"
        zIndex={zIndex + 1}
      />
    );
  }
  if (state === 'inactive') {
    const o = opacity == null ? 1 : Math.max(0, Math.min(1, opacity));
    if (o <= 0) return null;
    return (
      <>
        <Polyline coordinates={coords} strokeColor={dark ? `rgba(15,27,45,${(0.55 * o).toFixed(2)})` : `rgba(255,255,255,${(0.95 * o).toFixed(2)})`} strokeWidth={under ? 5 : 8} lineCap="round" lineJoin="round" zIndex={zIndex} />
        <Polyline
          coordinates={coords}
          strokeColor={dark ? `rgba(159,179,209,${o.toFixed(2)})` : `rgba(122,142,173,${o.toFixed(2)})`}
          strokeWidth={under ? 2.5 : 4.5}
          lineDashPattern={under ? [4, 8] : [10, 7]}
          lineCap="round"
          lineJoin="round"
          zIndex={zIndex + 1}
        />
      </>
    );
  }
  if (under) {
    return (
      <>
        <Polyline coordinates={coords} strokeColor={dark ? 'rgba(15,27,45,0.7)' : 'rgba(255,255,255,0.95)'} strokeWidth={8} lineCap="round" lineJoin="round" zIndex={zIndex} />
        <Polyline coordinates={coords} strokeColor={dark ? '#D58FB0' : C.underground} strokeWidth={4} lineDashPattern={[7, 7]} lineCap="round" lineJoin="round" zIndex={zIndex + 1} />
      </>
    );
  }
  return (
    <>
      <Polyline coordinates={coords} strokeColor={dark ? 'rgba(255,255,255,0.9)' : '#FFFFFF'} strokeWidth={12} lineCap="round" lineJoin="round" zIndex={zIndex} />
      <Polyline coordinates={coords} strokeColor={dark && leg.mode === 'taxi' ? '#6EA0FF' : LEG_COLOR[leg.mode] ?? C.route} strokeWidth={7} lineCap="round" lineJoin="round" zIndex={zIndex + 1} />
    </>
  );
});
