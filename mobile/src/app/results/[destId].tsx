import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAppStore, useIsNight } from '@/store/useAppStore';
import { destById } from '@/data/destinations';
import { KIND_TITLE, optionsFor, ROUTES } from '@/data/routes';
import type { RouteKind, RouteOption } from '@/data/types';
import { scriptedReply } from '@/ai/ahmed';
import { MAP_STYLE_FOR_TYPE, MAP_TYPE, mapTypeFor, useSatelliteType } from '@/components/mapStyle';
import { DestPin, OriginPin } from '@/components/RouteLines';
import { AhmedAvatar } from '@/components/Brand';
import { CircleButton, Icon, Txt, tap } from '@/components/ui';
import { FadeIn } from '@/components/anim';
import { RiskStrip } from '@/components/charts';
import { clockPlus, fmtDist, regionFor, toLatLngs } from '@/utils/geo';
import { speak, stopSpeaking } from '@/utils/tts';
import { C, R, scoreColor, shadow } from '@/theme';

type Mode = 'walk' | 'accessible' | 'scooter' | 'transit' | 'taxi';
const MODES: { id: Mode; icon: string; label: string }[] = [
  { id: 'walk', icon: 'walk', label: 'Piyada' },
  { id: 'accessible', icon: 'wheelchair-accessibility', label: 'Əlçatan' },
  { id: 'scooter', icon: 'scooter', label: 'Skuter' },
  { id: 'transit', icon: 'subway-variant', label: 'Metro və avtobus' },
  { id: 'taxi', icon: 'taxi', label: 'Taksi' },
];

function fitsMode(o: RouteOption, m: Mode) {
  const modes = o.legs.map((l) => l.mode);
  if (m === 'taxi') return modes.includes('taxi');
  if (m === 'transit') return modes.includes('metro') || modes.includes('bus');
  return !modes.includes('taxi'); // walk: everything on foot / public transport
}

/** Bubble anchor along the route; each option uses a different fraction so labels don't overlap. */
const BUBBLE_AT: Record<RouteKind, number> = { safest: 0.55, cheapest: 0.3, fastest: 0.8 };
function bubblePoint(o: RouteOption) {
  const pts = o.legs.flatMap((l) => toLatLngs(l.c));
  return pts[Math.min(pts.length - 1, Math.floor(pts.length * BUBBLE_AT[o.kind]))];
}

/**
 * Draggable "Directions" sheet: three snap points like Apple/Google Maps.
 *  - full: almost the whole screen      - mid: ~60% (default)
 *  - peek: only the header row (selected route summary + Başla) -> map is free to pan/zoom
 */
type Snap = 'peek' | 'mid' | 'full';
const SNAPS: Snap[] = ['full', 'mid', 'peek'];
const PEEK = 80; // handle + header row, above the home indicator
const ND = Platform.OS !== 'web'; // native driver isn't available on web
// web preview: a mouse drag on the header must not select (and then drag) the text
const NO_SELECT = (Platform.OS === 'web' ? { userSelect: 'none' } : null) as any;
/** Clamp at the top, soft resistance when pulled below the collapsed position. */
function rubber(v: number, max: number) {
  if (v < 0) return 0;
  return v > max ? max + (v - max) * 0.3 : v;
}

/** Deterministic per-route risk profile for the strip graphic (prototype data). */
function riskParts(o: RouteOption, night: boolean) {
  const s = night ? o.scoreNight : o.scoreDay;
  const n = 14;
  const bad = new Set(Array.from({ length: Math.min(4, o.unsignalized) }, (_, k) => Math.floor(((k + 1) * n) / (Math.min(4, o.unsignalized) + 1))));
  return Array.from({ length: n }, (_, i) => (bad.has(i) ? Math.min(48, s - 10) : Math.max(20, Math.min(98, s + (((i * 37) % 11) - 5)))));
}

export default function Results() {
  const { destId, kind, speak: speakParam } = useLocalSearchParams<{ destId: string; kind?: RouteKind; speak?: string }>();
  const insets = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const night = useIsNight();
  const wind = useAppStore((s) => s.windSpeed);
  const lastAhmed = useAppStore((s) => s.lastAhmed);
  const dest = destById(destId);
  const options = optionsFor(destId);
  const [selected, setSelected] = useState<RouteKind>(kind ?? 'safest');
  const [mode, setMode] = useState<Mode>(kind === 'fastest' ? 'taxi' : 'walk');
  const [avoidDark, setAvoidDark] = useState(true);
  const mapRef = useRef<MapView>(null);

  // ---- draggable sheet geometry (sheet is fullH tall; translateY hides the part below the screen)
  const [boxH, setBoxH] = useState(H);
  const fullH = Math.max(360, boxH - insets.top - 8);
  const midVis = Math.min(boxH * 0.6, 540) + insets.bottom;
  const peekVis = PEEK + insets.bottom;
  const snapY = useMemo(() => {
    const peek = Math.max(2, fullH - peekVis);
    return { full: 0, mid: Math.min(Math.max(1, fullH - midVis), peek - 1), peek };
  }, [fullH, midVis, peekVis]);
  const [snap, setSnap] = useState<Snap>('mid');
  const snapRef = useRef<Snap>('mid');
  const snapYRef = useRef(snapY);
  snapYRef.current = snapY;
  const y = useRef(new Animated.Value(snapY.mid)).current;
  const enter = useRef(new Animated.Value(240)).current; // slide-in on open
  const ty = useMemo(() => Animated.add(y, enter), [y, enter]);
  useEffect(() => {
    Animated.spring(enter, { toValue: 0, tension: 50, friction: 11, useNativeDriver: ND }).start();
  }, [enter]);
  useEffect(() => {
    y.setValue(snapY[snapRef.current]); // layout changed (rotation / web frame) -> keep the same snap
  }, [snapY, y]);
  // header crossfade: "Marşrut" title (mid/full) <-> route summary + Başla (peek)
  const { headOpacity, peekOpacity } = useMemo(() => {
    const half = snapY.mid + (snapY.peek - snapY.mid) * 0.5;
    return {
      headOpacity: y.interpolate({ inputRange: [snapY.mid, half], outputRange: [1, 0], extrapolate: 'clamp' }),
      peekOpacity: y.interpolate({ inputRange: [half, snapY.peek], outputRange: [0, 1], extrapolate: 'clamp' }),
    };
  }, [y, snapY.mid, snapY.peek]);

  const reply = useMemo(() => {
    if (lastAhmed && lastAhmed.destId === destId && lastAhmed.reply) return lastAhmed.reply;
    return scriptedReply(destId, 'safest', night);
  }, [lastAhmed, destId, night]);

  useEffect(() => {
    if (speakParam === '1') {
      const t = setTimeout(() => speak(reply), 500);
      return () => {
        clearTimeout(t);
        stopSpeaking();
      };
    }
  }, [speakParam, reply]);

  const allPts = useMemo(() => options.flatMap((o) => o.legs.flatMap((l) => toLatLngs(l.c))), [options]);
  const region = useMemo(() => (allPts.length ? regionFor(allPts, 1.25) : undefined), [allPts]);
  const sat = useSatelliteType(region?.latitudeDelta);

  /** Fit all route lines into the map area that the sheet leaves visible. */
  const fitRoute = useCallback(
    (s: Snap) => {
      if (!allPts.length || s === 'full') return;
      // mapPadding already reserves the peek height; add the rest of the sheet when it's at mid
      const extra = s === 'mid' ? midVis - peekVis : 0;
      mapRef.current?.fitToCoordinates(allPts, { edgePadding: { top: 24, right: 12, bottom: extra + 28, left: 12 }, animated: true });
    },
    [allPts, midVis, peekVis],
  );

  const settle = (to: Snap, velocity = 0) => {
    const prev = snapRef.current;
    snapRef.current = to;
    setSnap(to);
    if (to !== prev) {
      tap();
      fitRoute(to);
    }
    Animated.spring(y, { toValue: snapYRef.current[to], velocity, tension: 70, friction: 13, useNativeDriver: ND }).start();
  };
  const settleRef = useRef(settle);
  settleRef.current = settle;
  const toggleSheet = () => settle(snapRef.current === 'peek' ? 'mid' : snapRef.current === 'mid' ? 'peek' : 'mid');

  // drag from the handle / header / mode row; taps still reach the buttons (move threshold)
  const dragFrom = useRef(0);
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => {
        y.stopAnimation();
        dragFrom.current = snapYRef.current[snapRef.current];
      },
      onPanResponderMove: (_, g) => y.setValue(rubber(dragFrom.current + g.dy, snapYRef.current.peek)),
      onPanResponderRelease: (_, g) => release(g.dy, g.vy),
      onPanResponderTerminate: (_, g) => release(g.dy, g.vy),
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;
  function release(dy: number, vy: number) {
    const ys = snapYRef.current;
    const projected = rubber(dragFrom.current + dy, ys.peek) + vy * 180; // a flick carries further
    let best: Snap = 'mid';
    for (const s of SNAPS) if (Math.abs(ys[s] - projected) < Math.abs(ys[best] - projected)) best = s;
    settleRef.current(best, vy);
  }

  // PERF: LatLng arrays built once per option, not on every render
  const coords = useMemo(() => Object.fromEntries(options.map((o) => [o.id, o.legs.map((l) => toLatLngs(l.c))])), [options]);
  const shown = options.filter((o) => fitsMode(o, mode));
  const list = shown.length ? shown : options;
  const opt = options.find((o) => o.kind === selected) ?? list[0];

  if (!dest || !opt) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <Txt>Marşrut tapılmadı</Txt>
      </View>
    );
  }

  const pickMode = (m: Mode) => {
    tap();
    if (m === 'accessible') return router.push('/accessible');
    if (m === 'scooter') return router.push('/scooter');
    setMode(m);
    const first = options.find((o) => fitsMode(o, m));
    if (first) setSelected(first.kind);
  };
  const go = (k: RouteKind) => {
    stopSpeaking();
    router.push(`/navigate?dest=${destId}&kind=${k}`);
  };
  const ordered = [...list].sort((a, b) => (a.kind === selected ? -1 : b.kind === selected ? 1 : 0));

  return (
    <View
      style={{ flex: 1, backgroundColor: C.bg }}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (Math.abs(h - boxH) > 1) setBoxH(h);
      }}
    >
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        mapType={sat.mapType} onRegionChangeComplete={sat.onRegionChangeComplete} customMapStyle={MAP_STYLE_FOR_TYPE}
        initialRegion={region}
        onMapReady={() => fitRoute(snapRef.current)}
        mapPadding={{ top: insets.top + 70, bottom: peekVis, left: 16, right: 70 }}
        toolbarEnabled={false}
        showsCompass={false}
        zoomEnabled
        scrollEnabled
        rotateEnabled={false}
      >
        {/* alternatives: light with white casing */}
        {options
          .filter((o) => o.kind !== opt.kind)
          .flatMap((o) =>
            o.legs.map((l, i) => (
              <React.Fragment key={`${o.id}-${i}`}>
                <Polyline coordinates={coords[o.id][i]} strokeColor="#FFFFFF" strokeWidth={10} lineCap="round" zIndex={3} />
                <Polyline coordinates={coords[o.id][i]} strokeColor="#9FB0C8" strokeWidth={6} lineCap="round" zIndex={4} />
              </React.Fragment>
            )),
          )}
        {/* selected: navy with white casing + mint glow */}
        {opt.legs.map((l, i) => (
          <React.Fragment key={`sel-${i}`}>
            <Polyline coordinates={coords[opt.id][i]} strokeColor={C.halo} strokeWidth={20} lineCap="round" zIndex={5} />
            <Polyline coordinates={coords[opt.id][i]} strokeColor="#FFFFFF" strokeWidth={12} lineCap="round" zIndex={6} />
            <Polyline
              coordinates={coords[opt.id][i]}
              strokeColor={l.mode === 'metro' ? C.metro : C.route}
              strokeWidth={7}
              lineCap="round"
              lineJoin="round"
              lineDashPattern={l.mode === 'metro' ? [2, 10] : undefined}
              zIndex={7}
            />
          </React.Fragment>
        ))}
        {/* time bubbles (reference: "9 min · Your route", "10 min") */}
        {options.map((o) => {
          const p = bubblePoint(o);
          const on = o.kind === opt.kind;
          return p ? (
            <Marker key={`${o.id}-${on}`} coordinate={p} anchor={{ x: 0.5, y: 1.15 }} tracksViewChanges={false} onPress={() => setSelected(o.kind)} zIndex={on ? 30 : 20}>
              <View style={[styles.bubble, on && styles.bubbleOn]}>
                {on ? <Icon name="shield-check" size={20} color={C.brand} /> : null}
                <View>
                  <Txt w="bold" size={15} color={on ? '#fff' : C.route}>
                    {o.durationMin} dəq
                  </Txt>
                  {on ? (
                    <Txt w="med" size={12} color={C.muted}>
                      {KIND_TITLE[o.kind]}
                    </Txt>
                  ) : null}
                </View>
              </View>
            </Marker>
          ) : null;
        })}
        <OriginPin latitude={ROUTES.origin.lat} longitude={ROUTES.origin.lon} />
        <DestPin latitude={dest.lat} longitude={dest.lon} icon={dest.icon} />
      </MapView>

      {/* top-left weather chip (reference "53° AQI 22") */}
      <View style={[styles.weather, { top: insets.top + 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name={night ? 'weather-night' : 'weather-partly-cloudy'} size={20} />
          <Txt w="bold" size={20}>
            11°
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Txt w="semi" size={12} color={C.ink2}>
            Külək {wind} m/s
          </Txt>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: wind > 8 ? C.warn : C.safe }} />
        </View>
      </View>

      {/* right controls pill (layers · locate) */}
      <View style={[styles.sideCtl, { top: insets.top + 12 }]}>
        <CircleButton icon="layers-outline" size={48} bg="transparent" label="Xəritə qatları" onPress={() => router.navigate('/map')} />
        <View style={{ height: 1, width: 26, backgroundColor: C.line }} />
        <CircleButton icon="navigation-variant-outline" size={48} bg="transparent" color={C.route} label="Mənim yerim" />
      </View>

      {/* glass "Directions" sheet — drag the handle/header up or down (full · mid · peek) */}
      <Animated.View style={[styles.sheetWrap, { height: fullH, transform: [{ translateY: ty }] }]}>
      <BlurView intensity={60} tint="light" style={styles.sheet}>
        <View {...pan.panHandlers} style={NO_SELECT}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={snap === 'peek' ? 'Marşrut panelini aç' : 'Marşrut panelini yığ'}
          onPress={toggleSheet}
          hitSlop={{ top: 12, bottom: 4 }}
          style={styles.handleZone}
        >
          <View style={styles.handle} />
        </Pressable>
        <View style={styles.sheetHead}>
          <View style={{ flex: 1, height: 48, justifyContent: 'center' }}>
            <Animated.View style={{ opacity: headOpacity }} importantForAccessibility={snap === 'peek' ? 'no-hide-descendants' : 'auto'}>
              <Txt w="black" size={28}>
                Marşrut
              </Txt>
            </Animated.View>
            {/* collapsed: selected route summary + start, so you can go straight from the map */}
            <Animated.View
              style={[StyleSheet.absoluteFill, styles.peekRow, { opacity: peekOpacity, pointerEvents: snap === 'peek' ? 'auto' : 'none' }]}
              importantForAccessibility={snap === 'peek' ? 'auto' : 'no-hide-descendants'}
              accessibilityElementsHidden={snap !== 'peek'}
            >
              <View style={{ flex: 1 }}>
                <Txt w="black" size={19} numberOfLines={1}>
                  {opt.durationMin} dəq · {KIND_TITLE[opt.kind]}
                </Txt>
                <Txt w="med" size={13.5} color={C.muted} numberOfLines={1}>
                  Çatış {clockPlus(opt.durationMin)} · {fmtDist(opt.distanceM)} · {night ? opt.scoreNight : opt.scoreDay} bal
                </Txt>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${KIND_TITLE[opt.kind]} marşrutla başla`}
                onPress={() => go(opt.kind)}
                style={({ pressed }) => [styles.goSmall, { opacity: pressed ? 0.85 : 1 }]}
              >
                <Txt w="black" size={16} color="#FFFFFF">
                  Başla
                </Txt>
              </Pressable>
            </Animated.View>
          </View>
          <CircleButton icon="close" size={44} bg={C.bg2} label="Bağla" onPress={() => router.back()} />
        </View>

        {/* mode segmented control */}
        <View style={styles.segment}>
          {MODES.map((m) => (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              accessibilityLabel={m.label}
              accessibilityState={{ selected: mode === m.id }}
              onPress={() => pickMode(m.id)}
              style={[styles.segItem, mode === m.id && styles.segOn]}
            >
              <Icon name={m.icon} size={24} color={mode === m.id ? C.ink : C.ink2} />
            </Pressable>
          ))}
        </View>
        </View>

        {/* at "mid" the lower part of the sheet is below the screen -> pad so the last card can scroll into view */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 + (snap === 'full' ? 0 : snapY.mid) }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={snap !== 'peek'}
        >
          {/* from / to / add stop */}
          <View style={styles.stops}>
            <View style={styles.stopRow}>
              <View style={[styles.stopDot, { backgroundColor: C.route }]}>
                <Icon name="navigation-variant" size={14} color="#FFFFFF" />
              </View>
              <Txt w="med" size={16.5} style={{ flex: 1 }}>
                Cari yer · 28 May m.
              </Txt>
              <Icon name="drag-horizontal-variant" size={22} color={C.faint} />
            </View>
            <View style={styles.connector} />
            <View style={[styles.stopRow, styles.stopBorder]}>
              <View style={[styles.stopDot, { backgroundColor: C.brand }]}>
                <Icon name={dest.icon} size={14} color="#FFFFFF" />
              </View>
              <Txt w="med" size={16.5} style={{ flex: 1 }}>
                {dest.name}
              </Txt>
              <Icon name="drag-horizontal-variant" size={22} color={C.faint} />
            </View>
            <View style={styles.connector} />
            <Pressable accessibilityRole="button" onPress={() => router.push('/ahmed')} style={[styles.stopRow, styles.stopBorder]}>
              <View style={[styles.stopDot, { backgroundColor: C.brand }]}>
                <Icon name="plus" size={16} color="#FFFFFF" />
              </View>
              <Txt w="semi" size={16.5} color={C.route} style={{ flex: 1 }}>
                Dayanacaq əlavə et
              </Txt>
              <Icon name="microphone-outline" size={22} color={C.ink2} label="Əhmədə səslə de" />
              <Icon name="drag-horizontal-variant" size={22} color={C.faint} style={{ marginLeft: 10 }} />
            </Pressable>
          </View>

          {/* Now / Avoid chips */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <View style={styles.chip}>
              <Txt w="semi" size={15}>
                {night ? 'İndi · gecə' : 'İndi'}
              </Txt>
              <Icon name="chevron-down" size={18} />
            </View>
            <Pressable accessibilityRole="button" onPress={() => setAvoidDark((v) => !v)} style={[styles.chip, avoidDark && { backgroundColor: C.brandSoft }]}>
              <Txt w="semi" size={15}>
                {avoidDark ? 'Qaç: işıqsız küçə' : 'Qaç'}
              </Txt>
              <Icon name="chevron-down" size={18} />
            </Pressable>
          </View>

          {/* route cards (reference: "9 min · 9:50 ETA · 1.8 mi · GO") */}
          <View style={{ gap: 10, marginTop: 14 }}>
            {ordered.map((o, idx) => {
              const s = night ? o.scoreNight : o.scoreDay;
              const on = o.kind === opt.kind;
              return (
                <FadeIn key={o.id} index={idx} delay={250}>
                <View style={[styles.card, on && styles.cardOn]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => {
                      tap();
                      setSelected(o.kind);
                    }}
                    style={{ flex: 1 }}
                  >
                    <Txt w="black" size={24}>
                      {o.durationMin} dəq
                    </Txt>
                    <Txt w="med" size={14.5} color={C.muted} style={{ marginTop: 2 }}>
                      Çatış {clockPlus(o.durationMin)} · {fmtDist(o.distanceM)} · {o.price}
                    </Txt>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                      <Icon name={o.warning ? 'alert-outline' : 'shield-check-outline'} size={17} color={o.warning ? C.danger : scoreColor(s)} />
                      <Txt w="semi" size={13.5} color={o.warning ? C.danger : C.ink2} numberOfLines={1} style={{ flexShrink: 1 }}>
                        {o.warning ?? `${KIND_TITLE[o.kind]} yol`} · {s} bal
                      </Txt>
                    </View>
                    <View style={{ marginTop: 10 }}>
                      <RiskStrip parts={riskParts(o, night)} />
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${KIND_TITLE[o.kind]} marşrutla başla`}
                    onPress={() => go(o.kind)}
                    style={({ pressed }) => [styles.go, { opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Txt w="black" size={17} color="#FFFFFF">
                      Başla
                    </Txt>
                  </Pressable>
                </View>
                </FadeIn>
              );
            })}
          </View>

          {/* Əhməd's explanation */}
          <Pressable accessibilityRole="button" onPress={() => speak(reply)} style={styles.ahmed}>
            <View style={styles.ahmedArt}>
              <AhmedAvatar size={34} />
            </View>
            <Txt w="med" size={13.5} color={C.ink2} style={{ flex: 1 }} numberOfLines={3}>
              {reply}
            </Txt>
            <Icon name="volume-high" size={20} label="Səsli oxu" />
          </Pressable>
        </ScrollView>
      </BlurView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...shadow(2),
  },
  bubbleOn: { backgroundColor: C.route },
  weather: {
    position: 'absolute',
    left: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...shadow(1),
  },
  sideCtl: {
    position: 'absolute',
    right: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 26,
    paddingVertical: 4,
    ...shadow(2),
  },
  sheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    ...shadow(3),
  },
  sheet: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 16,
  },
  handleZone: { alignSelf: 'stretch', alignItems: 'center', paddingTop: 8, paddingBottom: 8 },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: C.faint },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  peekRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  goSmall: { height: 48, paddingHorizontal: 20, borderRadius: R.pill, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', backgroundColor: 'rgba(15,27,45,0.05)', borderRadius: R.pill, padding: 4, marginBottom: 12 },
  segItem: { flex: 1, height: 48, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: '#FFFFFF', ...shadow(1) },
  stops: { backgroundColor: 'rgba(15,27,45,0.05)', borderRadius: 20, paddingHorizontal: 14 },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54 },
  stopBorder: { borderTopWidth: 1, borderTopColor: 'rgba(15,27,45,0.05)' },
  stopDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  connector: { position: 'absolute', left: 26, width: 2, height: 0 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(15,27,45,0.05)', borderRadius: R.pill, paddingHorizontal: 16, height: 44 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 16, borderWidth: 2, borderColor: 'transparent' },
  cardOn: { borderColor: C.brand },
  go: { width: 76, height: 64, borderRadius: 16, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  ahmed: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderRadius: 20, padding: 12, marginTop: 10 },
  ahmedArt: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' },
});
