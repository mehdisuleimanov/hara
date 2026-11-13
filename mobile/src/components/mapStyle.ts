import { useCallback, useMemo } from 'react';
import { prefs, usePrefs } from '@/store/prefs';

/**
 * Map look (Design v7). Default = clean light vector map so the safety layer pops.
 * Satellite imagery only for wow moments (3D start, Son 50 metr) and via the map toggle
 * (`usePrefs().mapSatellite`).
 */

// Clean light map for the white + blue/green UI: white roads, soft green parks,
// light-blue water, quiet labels. Blue route + safety colors sit on top.
export const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#F1F4F8' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5B6779' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 3 }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#D7F2E1' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  // Google labels are English-only: keep the main avenues, hide the noise of small streets
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#D3DCE8' }] },
  { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#E1E7EF' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.fill', stylers: [{ color: '#E8EDF4' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#DDE4EE' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#CFE3FF' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3D6BB3' }] },
];

/** Night: deep navy dusk map — the green/amber/red safety layer glows on it. */
export const MAP_STYLE_NIGHT = [
  { elementType: 'geometry', stylers: [{ color: '#17223A' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8C9BB4' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#121B2E' }, { weight: 3 }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#18352F' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#27354F' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  // Google labels are English-only: keep the main avenues, hide the noise of small streets
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#33445F' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1B263C' }] },
  { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#1E2A41' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.fill', stylers: [{ color: '#1C2943' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#223150' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0C1D36' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4F6B96' }] },
];

export const BAKU_REGION = {
  latitude: 40.3893,
  longitude: 49.8474,
  latitudeDelta: 0.11,
  longitudeDelta: 0.11,
};

export type SatType = 'satellite' | 'hybrid';
export type MapTypeT = SatType | 'standard';

/** Base map type for screens that don't track the toggle (widget, previews). */
export const MAP_TYPE: MapTypeT = 'standard';
/** Street names on satellite only when zoomed in (zoom >= LABELS_MIN_ZOOM -> hybrid). */
export const LABELS_MIN_ZOOM = 16;
export function zoomOf(latitudeDelta: number) {
  return Math.log2(360 / Math.max(latitudeDelta, 1e-6));
}
function satFor(latitudeDelta: number): SatType {
  return zoomOf(latitudeDelta) >= LABELS_MIN_ZOOM ? 'hybrid' : 'satellite';
}
/** Map type for the current zoom: vector by default, satellite when the user turned it on. */
export function mapTypeFor(latitudeDelta: number): MapTypeT {
  return prefs().mapSatellite ? satFor(latitudeDelta) : 'standard';
}
/** Tracks the satellite toggle; returns the map type + a (no-op compatible) region handler. */
export function useSatelliteType(_initialDelta = 0.02) {
  const sat = usePrefs((p) => p.mapSatellite);
  const onRegionChangeComplete = useCallback((_r: { latitudeDelta: number }) => {}, []);
  return { mapType: (sat ? 'hybrid' : 'standard') as MapTypeT, onRegionChangeComplete };
}
/** customMapStyle (ignored by Google on satellite types). */
export const MAP_STYLE_FOR_TYPE = MAP_STYLE;

/**
 * One hook for every map in lane B: vector (day/night style) by default, hybrid satellite
 * when the toggle is on or a wow moment forces it.
 */
export function useMapLook(opts: { night?: boolean; satellite?: boolean } = {}) {
  const pref = usePrefs((p) => p.mapSatellite);
  const sat = opts.satellite ?? pref;
  const night = !!opts.night;
  return useMemo(
    () => ({
      satellite: sat,
      mapType: (sat ? 'hybrid' : 'standard') as MapTypeT,
      customMapStyle: night ? MAP_STYLE_NIGHT : MAP_STYLE,
      /** overlay text/lines on dark imagery need light casings */
      dark: sat || night,
    }),
    [sat, night],
  );
}
