import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type MapView from 'react-native-maps';
import type { LatLng } from '@/data/types';

/**
 * Animated overlays pinned to map coordinates WITHOUT animating Marker children
 * (Marker bitmaps are frozen with tracksViewChanges={false}). Overlays are projected with
 * pointForCoordinate when the map is idle and fade out while the camera moves.
 * Web preview: not supported (callers render a static Marker instead).
 */
type Ev = 'start' | 'end';
export type MapOverlayApi = {
  supported: boolean;
  mapRef: React.RefObject<MapView | null>;
  subscribe: (fn: (e: Ev) => void) => () => void;
  /** pass to <MapView onRegionChange> */
  onRegionChange: () => void;
  /** pass to <MapView onRegionChangeComplete> (or call from your own handler) */
  onRegionChangeComplete: () => void;
  /** re-project everything now (e.g. after onMapReady) */
  refresh: () => void;
};

export function useMapOverlay(mapRef: React.RefObject<MapView | null>): MapOverlayApi {
  const subs = useRef(new Set<(e: Ev) => void>());
  const moving = useRef(false);
  return useMemo(
    () => ({
      supported: Platform.OS !== 'web',
      mapRef,
      subscribe: (fn) => {
        subs.current.add(fn);
        return () => {
          subs.current.delete(fn);
        };
      },
      onRegionChange: () => {
        if (moving.current) return;
        moving.current = true;
        subs.current.forEach((f) => f('start'));
      },
      onRegionChangeComplete: () => {
        moving.current = false;
        subs.current.forEach((f) => f('end'));
      },
      refresh: () => subs.current.forEach((f) => f('end')),
    }),
    [mapRef],
  );
}

export function Anchored({
  api,
  coordinate,
  anchor = { x: 0.5, y: 0.5 },
  children,
  style,
  onPlaced,
}: {
  api: MapOverlayApi;
  coordinate: LatLng;
  anchor?: { x: number; y: number };
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** first time the overlay got a screen position */
  onPlaced?: () => void;
}) {
  const x = useSharedValue(-9999);
  const y = useSharedValue(-9999);
  const op = useSharedValue(0);
  const size = useRef({ w: 0, h: 0 });
  const pt = useRef<{ x: number; y: number } | null>(null);
  const placedOnce = useRef(false);
  const onPlacedRef = useRef(onPlaced);
  onPlacedRef.current = onPlaced;

  const place = useCallback(() => {
    if (!pt.current) return;
    x.value = pt.current.x - anchor.x * size.current.w;
    y.value = pt.current.y - anchor.y * size.current.h;
  }, [anchor.x, anchor.y, x, y]);

  const lat = coordinate.latitude;
  const lon = coordinate.longitude;
  const project = useCallback(async () => {
    const m = api.mapRef.current;
    if (!m) return;
    try {
      const p = await m.pointForCoordinate({ latitude: lat, longitude: lon });
      if (!p || !Number.isFinite(p.x)) return;
      pt.current = p;
      place();
      op.value = withTiming(1, { duration: 200 });
      if (!placedOnce.current) {
        placedOnce.current = true;
        onPlacedRef.current?.();
      }
    } catch {
      // map not ready yet -> the next idle event projects again
    }
  }, [api, lat, lon, place, op]);

  useEffect(() => {
    if (!api.supported) return;
    const unsub = api.subscribe((e) => {
      if (e === 'start') op.value = withTiming(0, { duration: 90 });
      else project();
    });
    const t = setTimeout(project, 300);
    return () => {
      unsub();
      clearTimeout(t);
    };
  }, [api, project, op]);

  const a = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ translateX: x.value }, { translateY: y.value }] }));
  if (!api.supported) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, top: 0 }, a, style]}
      onLayout={(e) => {
        size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
        place();
      }}
    >
      {children}
    </Animated.View>
  );
}
