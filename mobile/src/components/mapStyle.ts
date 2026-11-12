// Light, quiet Google Maps style so the orange route and safety colors stand out.
export const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f3f3f4' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8b8b90' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 3 }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#e4eee3' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#e2e2e6' }] },
  { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#e8e8eb' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.fill', stylers: [{ color: '#ebebee' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#e1e1e5' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dde6ee' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9aa8b5' }] },
];

export const BAKU_REGION = {
  latitude: 40.3893,
  longitude: 49.8474,
  latitudeDelta: 0.11,
  longitudeDelta: 0.11,
};
