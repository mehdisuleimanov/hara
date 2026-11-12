/**
 * WEB-ONLY stand-in for react-native-maps (browser preview / screenshots).
 * Wired up in metro.config.js; native builds use the real Google map.
 * Draws OSM streets from our safety-layer data as the base map, then the
 * same Polyline / Circle / Marker / Heatmap children with a simple local projection.
 */
import React, { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Image, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle as SvgCircle, Polyline as SvgPolyline } from 'react-native-svg';
import { LAYER } from '@/data/layer';

type LatLng = { latitude: number; longitude: number };
type Region = LatLng & { latitudeDelta: number; longitudeDelta: number };

export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = undefined;

type Proj = { w: number; h: number; s: number; lat0: number; lon0: number; k: number; cx: number; cy: number };
const Ctx = createContext<Proj | null>(null);

const M_LAT = 110540;
const M_LON = 111320;

function project(p: Proj, lat: number, lon: number) {
  return { x: p.cx + (lon - p.lon0) * M_LON * p.k * p.s, y: p.cy - (lat - p.lat0) * M_LAT * p.s };
}

function zoomToDelta(zoom: number) {
  const d = 360 / Math.pow(2, zoom) * 1.6;
  return { latitudeDelta: d, longitudeDelta: d };
}

const BAKU: Region = { latitude: 40.3893, longitude: 49.8474, latitudeDelta: 0.06, longitudeDelta: 0.06 };
const ROAD_W = [7, 6, 5, 4, 2.5, 2.5];

type MapProps = {
  style?: any;
  initialRegion?: Region;
  region?: Region;
  initialCamera?: { center: LatLng; zoom?: number; pitch?: number };
  onRegionChangeComplete?: (r: Region) => void;
  onPress?: (e: { nativeEvent: { coordinate: LatLng } }) => void;
  children?: React.ReactNode;
  // other react-native-maps props are accepted and ignored on web
  [k: string]: any;
};

const MapView = forwardRef<unknown, MapProps>(function MapView(props, ref) {
  const { style, initialRegion, region, initialCamera, onRegionChangeComplete, onPress, children, mapPadding, mapType, scrollEnabled = true, zoomEnabled = true, liteMode } = props;
  const pad = { top: 0, bottom: 0, left: 0, right: 0, ...(mapPadding ?? {}) };
  const satellite = mapType === 'satellite' || mapType === 'hybrid';
  const hybrid = mapType === 'hybrid';
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [pitch, setPitch] = useState<number>(initialCamera?.pitch ?? 0);
  const [view, setView] = useState<Region>(
    region ?? initialRegion ?? (initialCamera ? { ...initialCamera.center, ...zoomToDelta(initialCamera.zoom ?? 16) } : BAKU),
  );
  useEffect(() => {
    if (region) setView(region);
  }, [region?.latitude, region?.longitude, region?.latitudeDelta]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    animateToRegion: (r: Region) => {
      setView(r);
      onRegionChangeComplete?.(r);
    },
    animateCamera: (c: { center?: LatLng; zoom?: number; pitch?: number }) => {
      if (c.pitch !== undefined) setPitch(c.pitch);
      if (c.center) setView((v) => ({ ...v, ...c.center!, ...(c.zoom ? zoomToDelta(c.zoom) : {}) }));
    },
    // like Google: fit the bounds inside mapPadding + edgePadding (padding is additive)
    fitToCoordinates: (pts: LatLng[], opts?: { edgePadding?: Partial<typeof pad> }) => {
      if (!pts?.length || !size.w || !size.h) return;
      const e = { top: 0, bottom: 0, left: 0, right: 0, ...(opts?.edgePadding ?? {}) };
      let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
      for (const p of pts) {
        minLat = Math.min(minLat, p.latitude);
        maxLat = Math.max(maxLat, p.latitude);
        minLon = Math.min(minLon, p.longitude);
        maxLon = Math.max(maxLon, p.longitude);
      }
      const latC = (minLat + maxLat) / 2;
      const lonC = (minLon + maxLon) / 2;
      const k = Math.cos((latC * Math.PI) / 180);
      const ew = Math.max(60, size.w - pad.left - pad.right);
      const eh = Math.max(60, size.h - pad.top - pad.bottom);
      const iw = Math.max(40, ew - e.left - e.right);
      const ih = Math.max(40, eh - e.top - e.bottom);
      const s = Math.min(iw / (Math.max(maxLon - minLon, 1e-5) * M_LON * k), ih / (Math.max(maxLat - minLat, 1e-5) * M_LAT));
      const dx = (e.left - e.right) / 2;
      const dy = (e.top - e.bottom) / 2;
      const r: Region = {
        latitude: latC + dy / (M_LAT * s),
        longitude: lonC - dx / (M_LON * k * s),
        latitudeDelta: eh / (M_LAT * s),
        longitudeDelta: ew / (M_LON * k * s),
      };
      setView(r);
      onRegionChangeComplete?.(r);
    },
  }));

  // react-native-maps fires onMapReady once the map can take camera commands
  const readyRef = useRef(false);
  useEffect(() => {
    if (readyRef.current || !size.w || !size.h) return;
    readyRef.current = true;
    props.onMapReady?.();
  }, [size.w, size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const proj = useMemo<Proj | null>(() => {
    if (!size.w || !size.h) return null;
    const k = Math.cos((view.latitude * Math.PI) / 180);
    const ew = Math.max(60, size.w - pad.left - pad.right);
    const eh = Math.max(60, size.h - pad.top - pad.bottom);
    const s = Math.min(ew / (view.longitudeDelta * M_LON * k), eh / (view.latitudeDelta * M_LAT));
    return { w: size.w, h: size.h, s, lat0: view.latitude, lon0: view.longitude, k, cx: pad.left + ew / 2, cy: pad.top + eh / 2 };
  }, [size, view, pad.top, pad.bottom, pad.left, pad.right]);

  // satellite preview tiles (web only): Esri World Imagery, web-mercator XYZ
  const tiles = useMemo(() => {
    if (!proj || !satellite) return [];
    const zf = Math.log2(156543.03 * proj.k * proj.s);
    const z = Math.max(1, Math.min(19, Math.round(zf)));
    const n = Math.pow(2, z);
    const lon2x = (lon: number) => ((lon + 180) / 360) * n;
    const lat2y = (lat: number) => ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n;
    const x2lon = (x: number) => (x / n) * 360 - 180;
    const y2lat = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
    const westLon = proj.lon0 - proj.cx / (M_LON * proj.k * proj.s);
    const eastLon = proj.lon0 + (proj.w - proj.cx) / (M_LON * proj.k * proj.s);
    // when the 3D tilt is on, the far edge shows more ground -> load extra rows to the north
    const northLat = proj.lat0 + (proj.cy + (pitch > 0 ? proj.h * 0.9 : 0)) / (M_LAT * proj.s);
    const southLat = proj.lat0 - (proj.h - proj.cy) / (M_LAT * proj.s);
    const out: { key: string; uri: string; labels: string[]; left: number; top: number; w: number; h: number }[] = [];
    const ref = (svc: string, x: number, y: number) => `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/${svc}/MapServer/tile/${z}/${y}/${x}`;
    for (let x = Math.floor(lon2x(westLon)); x <= Math.floor(lon2x(eastLon)); x++)
      for (let y = Math.floor(lat2y(northLat)); y <= Math.floor(lat2y(southLat)); y++) {
        const a = project(proj, y2lat(y), x2lon(x));
        const b = project(proj, y2lat(y + 1), x2lon(x + 1));
        out.push({ key: `${z}/${x}/${y}`, uri: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`, labels: hybrid ? [ref('World_Transportation', x, y), ref('World_Boundaries_and_Places', x, y)] : [], left: a.x, top: a.y, w: b.x - a.x + 0.5, h: b.y - a.y + 0.5 });
        if (out.length > 160) return out;
      }
    return out;
  }, [proj, satellite, hybrid, pitch]);

  // base map: OSM streets in view
  const streets = useMemo(() => {
    if (!proj || satellite) return [];
    const halfLat = proj.h / 2 / (M_LAT * proj.s) + 0.002;
    const halfLon = proj.w / 2 / (M_LON * proj.k * proj.s) + 0.002;
    const out: { pts: string; w: number }[] = [];
    for (const seg of LAYER.segments) {
      const c = seg.c;
      let inView = false;
      for (let i = 0; i < c.length; i += 2) {
        if (Math.abs(c[i] - proj.lat0) < halfLat && Math.abs(c[i + 1] - proj.lon0) < halfLon) {
          inView = true;
          break;
        }
      }
      if (!inView) continue;
      let pts = '';
      for (let i = 0; i < c.length; i += 2) {
        const { x, y } = project(proj, c[i], c[i + 1]);
        pts += `${x.toFixed(1)},${y.toFixed(1)} `;
      }
      out.push({ pts, w: ROAD_W[seg.k] ?? 2.5 });
      if (out.length > 2500) break;
    }
    return out;
  }, [proj]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  // Gestures (web preview): wheel / trackpad-pinch zoom, two-finger pinch, one-finger / mouse drag pan.
  const hostRef = useRef<any>(null);
  const projRef = useRef(proj);
  projRef.current = proj;
  const viewRef = useRef(view);
  viewRef.current = view;
  const changeRef = useRef(onRegionChangeComplete);
  changeRef.current = onRegionChangeComplete;
  const draggedRef = useRef(false);
  const canPan = scrollEnabled !== false && !liteMode;
  const canZoom = zoomEnabled !== false && !liteMode;
  useEffect(() => {
    const el: HTMLElement | null = hostRef.current;
    if (!el || typeof el.addEventListener !== 'function' || (!canPan && !canZoom)) return;
    el.style.touchAction = 'none';
    let timer: ReturnType<typeof setTimeout> | undefined;
    const commit = () => {
      clearTimeout(timer);
      timer = setTimeout(() => changeRef.current?.(viewRef.current), 160);
    };
    const clampD = (d: number) => Math.min(0.5, Math.max(0.0008, d));
    const zoomBy = (f: number) => {
      if (!canZoom) return;
      setView((v) => ({ ...v, latitudeDelta: clampD(v.latitudeDelta * f), longitudeDelta: clampD(v.longitudeDelta * f) }));
      commit();
    };
    const onWheel = (e: WheelEvent) => {
      if (!canZoom) return;
      e.preventDefault();
      zoomBy(Math.exp(e.deltaY * (e.ctrlKey ? 0.012 : 0.0025)));
    };
    const pts = new Map<number, { x: number; y: number }>();
    let last: { x: number; y: number; dist: number } | null = null;
    let moved = 0;
    const onDown = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      last = null;
      moved = 0;
    };
    const onMove = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const list = [...pts.values()];
      const p = projRef.current;
      if (!p) return;
      if (list.length >= 2) {
        const dist = Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y);
        if (last && last.dist) zoomBy(last.dist / dist);
        last = { x: 0, y: 0, dist };
        draggedRef.current = true;
      } else if (canPan) {
        const cur = { x: list[0].x, y: list[0].y, dist: 0 };
        if (last && !last.dist) {
          const dx = cur.x - last.x;
          const dy = cur.y - last.y;
          moved += Math.abs(dx) + Math.abs(dy);
          if (moved > 6) draggedRef.current = true;
          setView((v) => ({ ...v, longitude: v.longitude - dx / (M_LON * p.k * p.s), latitude: v.latitude + dy / (M_LAT * p.s) }));
        }
        last = cur;
      }
    };
    const onUp = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      last = null;
      if (draggedRef.current) commit();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      clearTimeout(timer);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [canPan, canZoom]);

  return (
    <View ref={hostRef} style={[{ overflow: 'hidden', backgroundColor: '#EEF2F7' }, style]} onLayout={onLayout}>
      {/* web preview of the 3D camera: CSS perspective tilt */}
      <View
        style={[
          StyleSheet.absoluteFill,
          pitch > 0
            ? ({ transform: [{ perspective: 900 }, { rotateX: `${Math.min(60, pitch) * 0.8}deg` }, { scale: 1.3 }], transformOrigin: '50% 70%' } as any)
            : null,
        ]}
      >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={(e: any) => {
          if (draggedRef.current) {
            draggedRef.current = false; // end of a drag/pinch, not a tap
            return;
          }
          if (!proj || !onPress) return;
          const { locationX, locationY } = e.nativeEvent;
          const lon = proj.lon0 + (locationX - proj.cx) / (M_LON * proj.k * proj.s);
          const lat = proj.lat0 - (locationY - proj.cy) / (M_LAT * proj.s);
          onPress({ nativeEvent: { coordinate: { latitude: lat, longitude: lon } } });
        }}
      >
        {tiles.map((t) => (
          <Image key={t.key} source={{ uri: t.uri }} style={{ position: 'absolute', left: t.left, top: t.top, width: t.w, height: t.h }} />
        ))}
        {tiles.flatMap((t) => t.labels.map((u, i) => <Image key={`${t.key}-l${i}`} source={{ uri: u }} style={{ position: 'absolute', left: t.left, top: t.top, width: t.w, height: t.h }} />))}
        {proj ? (
          <Svg width={proj.w} height={proj.h} style={StyleSheet.absoluteFill as any}>
            {streets.map((s, i) => (
              <SvgPolyline key={`o${i}`} points={s.pts} stroke="#DCE3EC" strokeWidth={s.w + 2} fill="none" strokeLinecap="round" />
            ))}
            {streets.map((s, i) => (
              <SvgPolyline key={`i${i}`} points={s.pts} stroke="#FFFFFF" strokeWidth={s.w} fill="none" strokeLinecap="round" />
            ))}
          </Svg>
        ) : null}
      </Pressable>
      <Ctx.Provider value={proj}>{proj ? children : null}</Ctx.Provider>
      </View>
      {satellite ? (
        <Text style={{ position: 'absolute', left: 6, bottom: 2, fontSize: 9, color: 'rgba(255,255,255,0.8)' }}>Imagery © Esri (web preview)</Text>
      ) : null}
    </View>
  );
});

export default MapView;

function Overlay({ z, children }: { z?: number; children: React.ReactNode }) {
  const p = useContext(Ctx);
  if (!p) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: z ?? 1 }]}>
      <Svg width={p.w} height={p.h}>{children}</Svg>
    </View>
  );
}

export function Polyline(props: {
  coordinates: LatLng[];
  strokeColor?: string;
  strokeWidth?: number;
  lineDashPattern?: number[];
  lineCap?: 'round' | 'butt' | 'square';
  lineJoin?: 'round' | 'miter' | 'bevel';
  zIndex?: number;
}) {
  const p = useContext(Ctx);
  if (!p || props.coordinates.length < 2) return null;
  const pts = props.coordinates.map((c) => {
    const { x, y } = project(p, c.latitude, c.longitude);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <Overlay z={props.zIndex}>
      <SvgPolyline
        points={pts.join(' ')}
        stroke={props.strokeColor ?? '#000'}
        strokeWidth={props.strokeWidth ?? 3}
        strokeDasharray={props.lineDashPattern?.join(' ')}
        strokeLinecap={props.lineCap ?? 'round'}
        strokeLinejoin={props.lineJoin ?? 'round'}
        fill="none"
      />
    </Overlay>
  );
}

export function Circle(props: {
  center: LatLng;
  radius: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  zIndex?: number;
}) {
  const p = useContext(Ctx);
  if (!p) return null;
  const { x, y } = project(p, props.center.latitude, props.center.longitude);
  return (
    <Overlay z={props.zIndex}>
      <SvgCircle
        cx={x}
        cy={y}
        r={Math.max(3.5, props.radius * p.s)}
        fill={props.fillColor ?? '#000'}
        stroke={props.strokeColor}
        strokeWidth={props.strokeWidth ?? 0}
      />
    </Overlay>
  );
}

export function Heatmap(props: { points: (LatLng & { weight?: number })[]; radius?: number }) {
  const p = useContext(Ctx);
  if (!p) return null;
  const pts = props.points.slice(0, 600);
  return (
    <Overlay z={0}>
      {pts.map((pt, i) => {
        const { x, y } = project(p, pt.latitude, pt.longitude);
        const w = pt.weight ?? 0.5;
        return <SvgCircle key={i} cx={x} cy={y} r={14 + 10 * w} fill={w > 0.5 ? '#F0435A' : '#F2A900'} opacity={0.12 + 0.18 * w} />;
      })}
    </Overlay>
  );
}

export function Marker(props: {
  coordinate: LatLng;
  anchor?: { x: number; y: number };
  onPress?: () => void;
  zIndex?: number;
  children?: React.ReactNode;
}) {
  const p = useContext(Ctx);
  const [box, setBox] = useState({ w: 0, h: 0 });
  if (!p) return null;
  const { x, y } = project(p, props.coordinate.latitude, props.coordinate.longitude);
  const a = props.anchor ?? { x: 0.5, y: 1 };
  return (
    <Pressable
      onPress={props.onPress}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={{ position: 'absolute', left: x - a.x * box.w, top: y - a.y * box.h, zIndex: (props.zIndex ?? 10) + 100, opacity: box.w ? 1 : 0 }}
    >
      {props.children ?? <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#071532' }} />}
    </Pressable>
  );
}

export const Callout = () => null;
export const UrlTile = () => null;
export const Polygon = () => null;
export const Overlay2 = () => null;
