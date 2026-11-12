import React, { memo, useMemo } from 'react';
import { View } from 'react-native';
import { Marker, Polyline } from 'react-native-maps';
import type { RouteOption } from '@/data/types';
import { LAYER } from '@/data/layer';
import { Txt } from '@/components/ui';
import { C, scoreColor } from '@/theme';
import { LegPolyline } from './LegPolyline';
import { crossingsAlong, isUnderground, legFraction, legGeos, legLatLngs, legStations, type Station } from './geometry';

/** "M" station badge (+ name for board/alight). Static Marker child. */
export const StationMarker = memo(function StationMarker({ s, major, dark }: { s: Station; major: boolean; dark?: boolean }) {
  if (!major) {
    return (
      <Marker coordinate={{ latitude: s.lat, longitude: s.lon }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={24}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: C.underground }} />
      </Marker>
    );
  }
  return (
    <Marker coordinate={{ latitude: s.lat, longitude: s.lon }} anchor={{ x: 0.5, y: 0.25 }} tracksViewChanges={false} zIndex={26}>
      <View style={{ alignItems: 'center', paddingHorizontal: 4 }}>
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: C.underground,
            borderWidth: 2.5,
            borderColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt w="black" size={13} color="#FFFFFF">
            M
          </Txt>
        </View>
        <View
          style={{
            marginTop: 2,
            paddingHorizontal: 7,
            height: 22,
            borderRadius: 11,
            justifyContent: 'center',
            backgroundColor: dark ? 'rgba(15,27,45,0.88)' : 'rgba(255,255,255,0.96)',
          }}
        >
          <Txt w="bold" size={11.5} color={dark ? '#FFFFFF' : C.ink} numberOfLines={1}>
            {s.name}
          </Txt>
        </View>
      </View>
    </Marker>
  );
});

/** Crossing dot sized in screen pixels (Marker) so it reads at any zoom; white halo ring. */
export const CrossingDot = memo(function CrossingDot({ lat, lon, score, big }: { lat: number; lon: number; score: number; big?: boolean }) {
  const s = big ? 16 : 12;
  return (
    <Marker coordinate={{ latitude: lat, longitude: lon }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={18}>
      <View style={{ width: s + 6, height: s + 6, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: s, height: s, borderRadius: s / 2, backgroundColor: scoreColor(score), borderWidth: 2.5, borderColor: '#FFFFFF' }} />
      </View>
    </Marker>
  );
});

/**
 * Results map: alternatives (thin, dashed), the selected route drawn progressively over a
 * soft glow underlay, metro tunnel legs with "M" station badges, and the safety-layer
 * crossings next to the walking parts (recolored day/night).
 */
export const RouteLayer = memo(function RouteLayer({
  options,
  selectedId,
  t,
  night,
  dark,
  showCrossings = true,
}: {
  options: RouteOption[];
  selectedId: string;
  /** 0..1 draw progress of the selected route */
  t: number;
  night: boolean;
  dark?: boolean;
  showCrossings?: boolean;
}) {
  const sel = options.find((o) => o.id === selectedId) ?? options[0];
  const geo = useMemo(() => (sel ? legGeos(sel) : null), [sel]);
  const stations = useMemo(
    () =>
      sel
        ? sel.legs.flatMap((l, li) =>
            l.mode === 'metro' ? legStations(l, sel).map((s, i, arr) => ({ s, major: i === 0 || i === arr.length - 1, key: `${li}-${i}` })) : [],
          )
        : [],
    [sel],
  );
  const cross = useMemo(() => (sel && showCrossings ? crossingsAlong(sel) : []), [sel, showCrossings]);
  if (!sel || !geo) return null;
  const done = t >= 0.999;
  return (
    <>
      {/* alternatives fade in once the selected route is on its way */}
      {t > 0.2
        ? options
            .filter((o) => o.id !== sel.id)
            .flatMap((o) => o.legs.map((l, i) => <LegPolyline key={`${o.id}-${i}`} leg={l} state="inactive" zIndex={2} dark={dark} />))
        : null}
      {/* soft glow underlay: the whole path, the line then traces over it */}
      {sel.legs.map((l, i) =>
        isUnderground(l) ? null : (
          <Polyline
            key={`glow-${i}`}
            coordinates={legLatLngs(l)}
            strokeColor={dark ? 'rgba(120,170,255,0.32)' : C.routeGlow}
            strokeWidth={22}
            lineCap="round"
            lineJoin="round"
            zIndex={4}
          />
        ),
      )}
      {sel.legs.map((l, i) => (
        <LegPolyline key={`sel-${sel.id}-${i}`} leg={l} state="active" progress={legFraction(geo, i, t)} zIndex={6} dark={dark} />
      ))}
      {done
        ? cross.map((i) => {
            const c = LAYER.crossings[i];
            return <CrossingDot key={`x${i}-${night ? 'n' : 'd'}`} lat={c[0]} lon={c[1]} score={night ? c[4] : c[3]} />;
          })
        : null}
      {done ? stations.map((x) => <StationMarker key={`st-${sel.id}-${x.key}`} s={x.s} major={x.major} dark={dark} />) : null}
    </>
  );
});
