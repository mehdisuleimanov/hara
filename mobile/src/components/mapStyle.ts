import { useCallback, useState } from 'react';

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
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#D3DCE8' }] },
  { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#E1E7EF' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.fill', stylers: [{ color: '#E8EDF4' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#DDE4EE' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#CFE3FF' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3D6BB3' }] },
];

export const BAKU_REGION = {
  latitude: 40.3893,
  longitude: 49.8474,
  latitudeDelta: 0.11,
  longitudeDelta: 0.11,
};

/**
 * Maps are satellite imagery. Street/place names are shown ONLY when zoomed in a lot
 * (zoom >= LABELS_MIN_ZOOM) by switching to Google "hybrid"; otherwise plain satellite.
 */
export type SatType = 'satellite' | 'hybrid';
export const MAP_TYPE: SatType | 'standard' = 'satellite';
export const LABELS_MIN_ZOOM = 17;
export function zoomOf(latitudeDelta: number) {
  return Math.log2(360 / Math.max(latitudeDelta, 1e-6));
}
export function mapTypeFor(latitudeDelta: number): SatType {
  return zoomOf(latitudeDelta) >= LABELS_MIN_ZOOM ? 'hybrid' : 'satellite';
}
/** Tracks zoom and returns the matching map type + handler for onRegionChangeComplete. */
export function useSatelliteType(initialDelta = 0.02) {
  const [mapType, setMapType] = useState<SatType>(mapTypeFor(initialDelta));
  const onRegionChangeComplete = useCallback((r: { latitudeDelta: number }) => setMapType(mapTypeFor(r.latitudeDelta)), []);
  return { mapType, onRegionChangeComplete };
}
/** customMapStyle only applies to the standard map type. */
export const MAP_STYLE_FOR_TYPE = (MAP_TYPE as string) === 'standard' ? MAP_STYLE : undefined;
