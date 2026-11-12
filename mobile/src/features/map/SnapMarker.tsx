import React, { useEffect, useState } from 'react';
import { Marker, type MapMarkerProps } from 'react-native-maps';

/**
 * Android snapshots custom Marker children into a bitmap. With tracksViewChanges={false}
 * from the first frame, icon glyphs / text can be captured blank. Track for a moment after
 * mount (or when `snapKey` changes), then freeze — children are never animated.
 */
export function useMarkerSnapshot(ms = 700, key: unknown = 0) {
  const [track, setTrack] = useState(true);
  useEffect(() => {
    setTrack(true);
    const t = setTimeout(() => setTrack(false), ms);
    return () => clearTimeout(t);
  }, [ms, key]);
  return track;
}

/** Marker with a static custom child that is snapshotted reliably (see useMarkerSnapshot). */
export function SnapMarker({ snapKey, snapMs = 700, children, ...props }: Omit<MapMarkerProps, 'tracksViewChanges'> & { snapKey?: unknown; snapMs?: number; children?: React.ReactNode }) {
  const track = useMarkerSnapshot(snapMs, snapKey);
  return (
    <Marker {...props} tracksViewChanges={track}>
      {children}
    </Marker>
  );
}
