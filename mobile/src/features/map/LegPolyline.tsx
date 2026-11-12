import React from 'react';
import { Polyline } from 'react-native-maps';
import type { Leg } from '@/data/types';
import { C } from '@/theme';

/**
 * FROZEN API — draws one route leg styled by mode/state. Lane B owns the visuals.
 * metro legs are underground (thin, dashed); done legs are faded.
 */
export function LegPolyline({ leg, state = 'active', progress }: { leg: Leg; state?: 'active' | 'inactive' | 'done'; progress?: number }) {
  void progress;
  const coords = [];
  for (let i = 0; i + 1 < leg.c.length; i += 2) coords.push({ latitude: leg.c[i], longitude: leg.c[i + 1] });
  const metro = leg.mode === 'metro';
  const color = state === 'done' ? C.faint : metro ? C.underground : state === 'inactive' ? C.faint : C.route;
  return (
    <Polyline
      coordinates={coords}
      strokeColor={color}
      strokeWidth={metro ? 3 : state === 'active' ? 6 : 4}
      lineDashPattern={metro ? [6, 8] : undefined}
      lineCap="round"
      lineJoin="round"
    />
  );
}
