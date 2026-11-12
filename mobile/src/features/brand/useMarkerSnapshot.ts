import { useEffect, useState } from 'react';

/**
 * Android map markers with custom children are snapshotted; with tracksViewChanges={false}
 * from the first frame, icon glyphs/text can be captured blank. Track for a moment, then freeze.
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
