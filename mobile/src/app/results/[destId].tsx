import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { SnapMarker } from '@/features/map/SnapMarker';
import ReAnimated, { FadeIn, FadeInDown, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAppStore, useIsNight } from '@/store/useAppStore';
import { prefs } from '@/store/prefs';
import { destById } from '@/data/destinations';
import { optionsFor, ROUTES, summary } from '@/data/routes';
import type { Destination, LatLng, RouteKind, RouteOption } from '@/data/types';
import { liveRouteById, type LiveRoute } from '@/features/routing/live';
import { useMapLook } from '@/components/mapStyle';
import { MeArrow, PinView } from '@/components/RouteLines';
import { bestOption, cardTitle, RouteCard } from '@/components/RouteCard';
import { CircleButton, Icon, Txt, tap } from '@/components/ui';
import { Pulse } from '@/components/anim';
import { Skeleton } from '@/motion/Skeleton';
import { PressableScale } from '@/motion/PressableScale';
import { SPRING } from '@/motion/springs';
import { AhmedAvatar } from '@/components/Brand';
import { say, stop, useVoice } from '@/voice';
import { NAV } from '@/voice/lines/nav';
import { useWeather } from '@/utils/weather';
import { clockPlus, fmtDist, regionFor } from '@/utils/geo';
import { RouteLayer } from '@/features/map/RouteLayer';
import { routePoints, useDrawProgress, useTweenCoord } from '@/features/map/geometry';
import { Anchored, useMapOverlay } from '@/features/map/overlay';
import { GlassChip, MapControls, NightVeil } from '@/features/map/MapControls';
import { LastMetersCard, LastMetersLabel, LastMetersLayer } from '@/features/map/LastMeters';
import { AhmedExplain } from '@/features/map/AhmedExplain';
import { C, R, shadow } from '@/theme';

/**
 * Draggable "Directions" sheet with three snap points (Apple/Citymapper style):
 * full · mid (default) · peek (summary only, map free). A green "Başla" bar floats below.
 */
type Snap = 'peek' | 'mid' | 'full';
const SNAPS: Snap[] = ['full', 'mid', 'peek'];
const PEEK = 78;
const CTA = 76;
const ND = Platform.OS !== 'web'; // native driver isn't available on web
const NO_SELECT = (Platform.OS === 'web' ? { userSelect: 'none' } : null) as any;
function rubber(v: number, max: number) {
  if (v < 0) return 0;
  return v > max ? max + (v - max) * 0.3 : v;
}

/** Cards fly in from below with a gentle spring (Əhməd hand-off). */
function flyIn(delay: number) {
  if (prefs().liteFx) return FadeIn.duration(160).delay(Math.min(delay, 200));
  // web preview supports only predefined layout animations
  if (Platform.OS === 'web') return FadeInDown.duration(420).delay(delay);
  return (() => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ translateY: 90 }, { scale: 0.94 }] },
      animations: {
        opacity: withDelay(delay, withTiming(1, { duration: 260 })),
        transform: [{ translateY: withDelay(delay, withSpring(0, SPRING.gentle)) }, { scale: withDelay(delay, withSpring(1, SPRING.gentle)) }],
      },
    };
  }) as any;
}

function placeAsDest(live: LiveRoute): Destination {
  return { id: `live:${live.id}`, name: live.place.name, short: live.place.name, district: live.place.district ?? '', icon: 'map-marker-outline', aliases: [], lat: live.place.lat, lon: live.place.lon };
}

export default function Results() {
  const params = useLocalSearchParams<{ destId: string; kind?: RouteKind; speak?: string; from?: string; lm?: string }>();
  const destId = String(params.destId ?? 'hilton');
  const isLive = destId.startsWith('live:');
  const liveId = isLive ? destId.slice(5) : '';
  const fromAhmed = params.from === 'ahmed' || params.speak === '1';

  // ---- live routes (any place): poll briefly in case the computation is still landing
  const [live, setLive] = useState<LiveRoute | null>(() => (isLive ? liveRouteById(liveId) ?? liveRouteById(destId) : null));
  const [liveGaveUp, setLiveGaveUp] = useState(false);
  useEffect(() => {
    if (!isLive || live) return;
    let n = 0;
    const id = setInterval(() => {
      const r = liveRouteById(liveId) ?? liveRouteById(destId);
      if (r) {
        setLive(r);
        clearInterval(id);
      } else if (++n > 20) {
        setLiveGaveUp(true);
        clearInterval(id);
      }
    }, 350);
    return () => clearInterval(id);
  }, [isLive, live, liveId, destId]);

  const dest = isLive ? (live ? placeAsDest(live) : undefined) : destById(destId);
  const options = useMemo<RouteOption[]>(() => (isLive ? live?.options ?? [] : optionsFor(destId)), [isLive, live, destId]);

  if (isLive && !live && !liveGaveUp) return <ResultsSkeleton />;
  if (!dest || !options.length) return <ResultsEmpty />;
  return <ResultsView key={destId} destId={destId} dest={dest} options={options} isLive={isLive} fromAhmed={fromAhmed} kind={params.kind} speak={params.speak} openLm={params.lm === '1'} />;
}

function ResultsView({
  destId,
  dest,
  options,
  isLive,
  fromAhmed,
  kind,
  speak,
  openLm,
}: {
  destId: string;
  dest: Destination;
  options: RouteOption[];
  isLive: boolean;
  fromAhmed: boolean;
  kind?: RouteKind;
  speak?: string;
  openLm: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const night = useIsNight();
  const lastAhmed = useAppStore((s) => s.lastAhmed);
  const showToast = useAppStore((s) => s.showToast);
  const storeWind = useAppStore((s) => s.windSpeed);
  const weather = useWeather();
  const voice = useVoice();
  const mapRef = useRef<MapView>(null);
  const overlay = useMapOverlay(mapRef);

  const ahmedCtx = lastAhmed && (lastAhmed.destId === destId || (isLive && lastAhmed.liveRouteId && destId === `live:${lastAhmed.liveRouteId}`)) ? lastAhmed : null;
  // the badge and the "Ən az riskli" title always go to the highest score for NOW (day or night)
  const best = bestOption(options, night) ?? options[0];
  const recommended: RouteKind = best.kind;
  const [selected, setSelected] = useState<RouteKind>(() => {
    const k = kind && kind !== 'safest' ? kind : best.kind;
    return options.some((o) => o.kind === k) ? k : options[0].kind;
  });
  const opt = options.find((o) => o.kind === selected) ?? options[0];
  const score = night ? opt.scoreNight : opt.scoreDay;
  const titleOfOpt = (o: RouteOption) => cardTitle(o, options, night);
  const lmOption = options.find((o) => o.lastMeters);
  const lm = lmOption?.lastMeters ?? null;

  const origin: LatLng = useMemo(() => {
    if (!isLive) return { latitude: ROUTES.origin.lat, longitude: ROUTES.origin.lon };
    const c = options[0].legs[0]?.c ?? [];
    return c.length >= 2 ? { latitude: c[0], longitude: c[1] } : { latitude: ROUTES.origin.lat, longitude: ROUTES.origin.lon };
  }, [isLive, options]);
  const destLL = useMemo(() => ({ latitude: dest.lat, longitude: dest.lon }), [dest.lat, dest.lon]);

  // Əhməd's own words when he planned this trip; otherwise a sentence built from the same data the
  // cards show (so the text can never disagree with the "Ən az riskli" badge)
  const reply = useMemo(() => {
    if (ahmedCtx?.reply) return ahmedCtx.reply;
    const how = best.legs.some((l) => l.mode === 'taxi') ? 'taksi' : summary(best).replace(/^./, (c) => c.toLowerCase());
    const s = night ? best.scoreNight : best.scoreDay;
    let t = `${dest.name} üçün ${night ? 'bu gecə' : 'indi'} ən az riskli yol: ${how}, ${best.durationMin} dəqiqə, təhlükəsizlik balı ${s}.`;
    if (best.reasons[0]) t += ` ${best.reasons[0]}.`;
    if (lm?.wrongSide && lmOption && lmOption.id !== best.id) t += ' Taksi isə səni yolun qarşı tərəfində düşürür.';
    return t.replace(/\.\./g, '.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ahmedCtx, best.id, night, dest.name]);

  // speak the reply on open (?speak=1); ?speak=0 or absent stays quiet
  useEffect(() => {
    if (speak !== '1') return;
    const t = setTimeout(() => say(reply), 650);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => stop(), []);

  // ---- "Son 50 metr" view
  const [lmOpen, setLmOpen] = useState(false);
  const [lmNonce, setLmNonce] = useState(0);
  const [moved, setMoved] = useState(false);
  const look = useMapLook({ night, satellite: lmOpen ? true : undefined });

  // ---- draggable sheet geometry (sheet is fullH tall; translateY hides the part below the screen)
  const [boxH, setBoxH] = useState(H);
  const ctaH = CTA + insets.bottom;
  const fullH = Math.max(380, boxH - insets.top - 8);
  const midVis = Math.min(boxH * 0.6, 600);
  const peekVis = PEEK + ctaH;
  const snapY = useMemo(() => {
    const peek = Math.max(2, fullH - peekVis);
    return { full: 0, mid: Math.min(Math.max(1, fullH - midVis), peek - 1), peek, hidden: fullH + 40 };
  }, [fullH, midVis, peekVis]);
  const [snap, setSnap] = useState<Snap>('mid');
  const snapRef = useRef<Snap>('mid');
  const snapYRef = useRef(snapY);
  snapYRef.current = snapY;
  const lmRef = useRef(false);
  lmRef.current = lmOpen;
  const y = useRef(new Animated.Value(snapY.mid)).current;
  const enterY = useRef(new Animated.Value(fromAhmed ? 140 : 260)).current;
  const ty = useMemo(() => Animated.add(y, enterY), [y, enterY]);
  useEffect(() => {
    Animated.spring(enterY, { toValue: 0, tension: 50, friction: 11, useNativeDriver: ND }).start();
  }, [enterY]);
  useEffect(() => {
    y.setValue(lmRef.current ? snapY.hidden : snapY[snapRef.current]);
  }, [snapY, y]);
  const { headOpacity, peekOpacity } = useMemo(() => {
    const half = snapY.mid + (snapY.peek - snapY.mid) * 0.5;
    return {
      headOpacity: y.interpolate({ inputRange: [snapY.mid, half], outputRange: [1, 0], extrapolate: 'clamp' }),
      peekOpacity: y.interpolate({ inputRange: [half, snapY.peek], outputRange: [0, 1], extrapolate: 'clamp' }),
    };
  }, [y, snapY.mid, snapY.peek]);

  // ---- camera
  const fitPts = useMemo(() => [...routePoints(opt), origin, destLL], [opt, origin, destLL]);
  // first frame already frames the route (the animated fit then only refines it)
  const [initialRegion] = useState(() => regionFor(fitPts, 1.6));
  const fitRoute = useCallback(
    (s: Snap) => {
      if (!fitPts.length || s === 'full' || lmRef.current) return;
      const extra = s === 'mid' ? midVis - peekVis : 0;
      mapRef.current?.fitToCoordinates(fitPts, { edgePadding: { top: 40, right: 30, bottom: extra + 40, left: 30 }, animated: true });
    },
    [fitPts, midVis, peekVis],
  );
  const firstFit = useRef(true);
  useEffect(() => {
    if (firstFit.current) {
      firstFit.current = false;
      return;
    }
    fitRoute(snapRef.current);
  }, [opt.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const projected = rubber(dragFrom.current + dy, ys.peek) + vy * 180;
    let best: Snap = 'mid';
    for (const s of SNAPS) if (Math.abs(ys[s] - projected) < Math.abs(ys[best] - projected)) best = s;
    settleRef.current(best, vy);
  }

  // ---- route drawing: restarts on route change, day/night switch
  const t = useDrawProgress(`${opt.id}|${night ? 'n' : 'd'}`, { duration: fromAhmed ? 1300 : 1000, delay: fromAhmed ? 420 : 220 });

  // ---- pins: destination drops in (overlay), then the real marker takes over
  const [landed, setLanded] = useState(Platform.OS === 'web');
  const [dropping, setDropping] = useState(false);

  // ---- Son 50 metr
  const tRed = useDrawProgress(`lmr-${lmNonce}`, { duration: 900, delay: 1100, enabled: lmOpen });
  const tGreen = useDrawProgress(`lmg-${lmNonce}`, { duration: 1300, delay: 2100, enabled: lmOpen });
  const dropTarget = useMemo<LatLng | null>(() => {
    if (!lm) return null;
    const p = moved && lm.betterDrop ? lm.betterDrop : lm.drop;
    return { latitude: p.lat, longitude: p.lon };
  }, [lm, moved]);
  const dropPos = useTweenCoord(dropTarget, 800);

  const openLastMeters = useCallback(() => {
    if (!lm) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    if (lmOption) setSelected(lmOption.kind);
    setMoved(false);
    setLmNonce((n) => n + 1);
    setLmOpen(true);
    Animated.spring(y, { toValue: snapYRef.current.hidden, tension: 60, friction: 12, useNativeDriver: ND }).start();
    const pts = [...[lm.directC, lm.safeC].flatMap((c) => {
      const out: LatLng[] = [];
      for (let i = 0; i + 1 < c.length; i += 2) out.push({ latitude: c[i], longitude: c[i + 1] });
      return out;
    }), destLL, { latitude: lm.drop.lat, longitude: lm.drop.lon }];
    if (lm.betterDrop) pts.push({ latitude: lm.betterDrop.lat, longitude: lm.betterDrop.lon });
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(pts, { edgePadding: { top: insets.top + 90, right: 50, bottom: 450 - peekVis, left: 50 }, animated: true });
      setTimeout(() => mapRef.current?.animateCamera({ pitch: 32 }, { duration: 900 }), 1100);
    }, 120);
    setTimeout(() => say(lm.note || NAV.lastMetersFallback), 900);
  }, [lm, lmOption, y, destLL, insets.top, peekVis]);

  const closeLastMeters = useCallback(() => {
    stop();
    setLmOpen(false);
    mapRef.current?.animateCamera({ pitch: 0 }, { duration: 300 });
    snapRef.current = 'mid';
    setSnap('mid');
    Animated.spring(y, { toValue: snapYRef.current.mid, tension: 60, friction: 12, useNativeDriver: ND }).start();
    setTimeout(() => {
      lmRef.current = false;
      fitRoute('mid');
    }, 60);
  }, [y, fitRoute]);

  const moveDrop = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setMoved(true);
    say(NAV.dropMoved);
  };
  const revertDrop = () => {
    tap();
    setMoved(false);
    setLmNonce((n) => n + 1);
  };
  const sendToDriver = async () => {
    if (!lm) return;
    const p = moved && lm.betterDrop ? lm.betterDrop : lm.drop;
    const label = moved && lm.betterDrop ? lm.betterDrop.label : `${dest.name} · ${lm.street}`;
    try {
      await Share.share({ message: `Məni bu nöqtədə düşür: ${label}\nhttps://maps.google.com/?q=${p.lat.toFixed(5)},${p.lon.toFixed(5)}` });
    } catch {}
    showToast('Düşmə nöqtəsi sürücüyə göndərildi', 'send-check');
    if (moved) say(NAV.sentToDriver);
  };

  useEffect(() => {
    if (!openLm || !lm) return;
    const id = setTimeout(openLastMeters, 900);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = () => {
    stop();
    router.push(`/navigate?dest=${encodeURIComponent(destId)}&kind=${opt.kind}`);
  };
  const playReply = () => {
    if (voice.speaking) stop();
    else say(reply);
  };
  const pick = (k: RouteKind) => {
    if (k !== selected) setSelected(k);
  };

  const temp = weather?.tempC;
  const wind = weather?.windSpeed ?? storeWind;
  // the recommended (highest-scored) option leads; order stays stable while you tap around
  const ordered = useMemo(() => [...options].sort((a, b) => (a.id === best.id ? -1 : b.id === best.id ? 1 : 0)), [options, best.id]);

  return (
    <View
      style={{ flex: 1, backgroundColor: night ? '#17223A' : C.bg }}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (Math.abs(h - boxH) > 1) setBoxH(h);
      }}
    >
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        mapType={look.mapType}
        customMapStyle={look.customMapStyle}
        initialRegion={initialRegion}
        onMapReady={() => {
          fitRoute(snapRef.current);
          setTimeout(overlay.refresh, 700);
        }}
        onRegionChange={overlay.onRegionChange}
        onRegionChangeComplete={overlay.onRegionChangeComplete}
        mapPadding={{ top: insets.top + 64, bottom: peekVis, left: 8, right: 64 }}
        toolbarEnabled={false}
        showsCompass={false}
        showsBuildings={lmOpen}
        rotateEnabled={false}
      >
        {!lmOpen ? <RouteLayer options={options} selectedId={opt.id} t={t} night={night} dark={look.dark} /> : null}
        <SnapMarker coordinate={origin} anchor={{ x: 0.5, y: 0.5 }} zIndex={30}>
          <MeArrow size={34} heading={20} />
        </SnapMarker>
        {landed ? (
          <SnapMarker coordinate={destLL} anchor={{ x: 0.5, y: 1 }} zIndex={31}>
            <PinView icon={dest.icon} color={C.navy} />
          </SnapMarker>
        ) : null}
        {lmOpen && lm && dropPos ? <LastMetersLayer lm={lm} drop={dropPos} dest={destLL} tRed={tRed} tGreen={tGreen} moved={moved} /> : null}
      </MapView>

      {/* screen overlays pinned to coordinates (native) */}
      {!lmOpen ? (
        <Anchored api={overlay} coordinate={origin} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={{ width: 76, height: 76 }}>
            <Pulse size={76} color={C.brand} duration={2000} />
          </View>
        </Anchored>
      ) : null}
      {!landed ? (
        <Anchored
          api={overlay}
          coordinate={destLL}
          anchor={{ x: 0.5, y: 1 }}
          onPlaced={() => {
            setDropping(true);
            setTimeout(() => setLanded(true), 900);
          }}
        >
          {dropping ? (
            <ReAnimated.View entering={FadeInDown.springify().damping(9).stiffness(170).withInitialValues({ transform: [{ translateY: -70 }] })}>
              <PinView icon={dest.icon} color={C.navy} />
            </ReAnimated.View>
          ) : (
            <View style={{ width: 44, height: 53 }} />
          )}
        </Anchored>
      ) : null}
      {lmOpen && lm && !moved && tRed >= 1 ? <LastMetersLabel api={overlay} lm={lm} visible /> : null}

      <NightVeil night={night} />

      {/* top bar: back · weather/time chip · map controls */}
      <View style={[styles.top, { top: insets.top + 10 }]} pointerEvents="box-none">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <CircleButton icon="chevron-left" size={44} bg="rgba(255,255,255,0.96)" label="Geri" onPress={() => (lmOpen ? closeLastMeters() : router.back())} style={shadow(1)} />
          {!lmOpen ? (
            <ReAnimated.View entering={FadeIn.duration(300).delay(150)}>
              <GlassChip>
                <Icon name={night ? 'weather-night' : 'weather-partly-cloudy'} size={18} color={night ? C.ai : C.ink} />
                <Txt w="bold" size={13.5}>
                  {night ? 'Gecə' : 'Gündüz'}
                  {temp != null ? ` · ${temp}°` : ''}
                </Txt>
                <View style={{ width: 1, height: 16, backgroundColor: C.line }} />
                <Icon name="weather-windy" size={16} color={wind > 8 ? C.warn : C.muted} />
                <Txt w="semi" size={13} color={C.ink2}>
                  {String(Math.round(wind * 10) / 10).replace('.', ',')} m/s
                </Txt>
              </GlassChip>
            </ReAnimated.View>
          ) : (
            <ReAnimated.View entering={FadeIn.duration(260)}>
              <GlassChip>
                <Icon name="satellite-variant" size={16} color={C.route} />
                <Txt w="bold" size={13.5}>
                  {dest.short} · giriş
                </Txt>
              </GlassChip>
            </ReAnimated.View>
          )}
        </View>
        {!lmOpen ? (
          <MapControls
            onLocate={() => {
              tap();
              fitRoute(snapRef.current === 'full' ? 'mid' : snapRef.current);
            }}
            locateIcon="fit-to-screen-outline"
          />
        ) : null}
      </View>

      {/* glass "Directions" sheet */}
      <Animated.View style={[styles.sheetWrap, { height: fullH, transform: [{ translateY: ty }] }]} pointerEvents={lmOpen ? 'none' : 'auto'}>
        <View style={styles.sheet}>
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
              <View style={{ flex: 1, height: 52, justifyContent: 'center' }}>
                <Animated.View style={{ opacity: headOpacity }} importantForAccessibility={snap === 'peek' ? 'no-hide-descendants' : 'auto'}>
                  <Txt w="semi" size={12.5} color={C.muted} numberOfLines={1}>
                    {isLive ? 'Cari yerdən' : `${ROUTES.origin.name ?? '28 May m.'}-dan`} · {options.length} yol
                  </Txt>
                  <Txt v="h1" size={22} lh={28} numberOfLines={1}>
                    {dest.name}
                  </Txt>
                </Animated.View>
                <Animated.View
                  style={[StyleSheet.absoluteFill, { justifyContent: 'center', opacity: peekOpacity, pointerEvents: snap === 'peek' ? 'auto' : 'none' }]}
                  importantForAccessibility={snap === 'peek' ? 'auto' : 'no-hide-descendants'}
                  accessibilityElementsHidden={snap !== 'peek'}
                >
                  <Txt w="black" size={18} numberOfLines={1}>
                    {opt.durationMin} dəq · {titleOfOpt(opt)}
                  </Txt>
                  <Txt w="med" size={13.5} color={C.muted} numberOfLines={1}>
                    Çatış {clockPlus(opt.durationMin)} · {fmtDist(opt.distanceM)} · {score} bal
                  </Txt>
                </Animated.View>
              </View>
              <CircleButton icon="close" size={42} bg={C.bg2} label="Bağla" onPress={() => router.back()} />
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: ctaH + 24 + (snap === 'full' ? 0 : snapY.mid) }}
            showsVerticalScrollIndicator={false}
            scrollEnabled={snap !== 'peek'}
          >
            <ReAnimated.View entering={fromAhmed ? flyIn(60) : FadeIn.duration(260)}>
              <AhmedExplain reply={reply} steps={ahmedCtx?.steps} option={opt} speaking={voice.speaking} onPlay={playReply} night={night} />
            </ReAnimated.View>

            <View style={{ gap: 10, marginTop: 14 }}>
              {ordered.map((o, i) => (
                <ReAnimated.View key={o.id} entering={fromAhmed ? flyIn(180 + i * 90) : FadeInDown.duration(300).delay(80 + i * 50)}>
                  <RouteCard
                    option={o}
                    night={night}
                    selected={o.kind === opt.kind}
                    recommended={o.kind === recommended}
                    title={titleOfOpt(o)}
                    onPress={() => pick(o.kind)}
                    onLastMeters={o.lastMeters ? openLastMeters : undefined}
                    ringDelay={fromAhmed ? 380 + i * 90 : 120 + i * 50}
                  />
                </ReAnimated.View>
              ))}
            </View>

            {lm && lm.wrongSide ? (
              <ReAnimated.View entering={fromAhmed ? flyIn(180 + options.length * 90 + 60) : FadeInDown.duration(300).delay(260)}>
                <PressableScale accessibilityRole="button" accessibilityLabel="Son 50 metr" onPress={openLastMeters} style={styles.lmTeaser}>
                  <View style={styles.lmIcon}>
                    <Icon name="taxi" size={22} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt v="overline" color={C.danger}>
                      Son 50 metr
                    </Txt>
                    <Txt w="bold" size={14.5} style={{ marginTop: 2 }} numberOfLines={2}>
                      Taksi səni {lm.street} üzərində, girişin qarşı tərəfində düşürür
                    </Txt>
                  </View>
                  <Icon name="chevron-right" size={22} color={C.danger} />
                </PressableScale>
              </ReAnimated.View>
            ) : null}

            {destId === 'hilton' || destId === 'port' ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                {destId === 'hilton' ? <LinkChip icon="wheelchair-accessibility" label="Əlçatan yol" onPress={() => router.push('/accessible')} /> : null}
                {destId === 'port' ? <LinkChip icon="scooter" label="Skuterlə" onPress={() => router.push('/scooter')} /> : null}
                <LinkChip icon="microphone-outline" label="Əhmədə başqa yer de" onPress={() => router.push('/ahmed')} />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <LinkChip icon="microphone-outline" label="Əhmədə başqa yer de" onPress={() => router.push('/ahmed')} />
              </View>
            )}
          </ScrollView>
        </View>
      </Animated.View>

      {/* floating start bar */}
      {!lmOpen ? (
        <ReAnimated.View entering={FadeInDown.springify().damping(18).delay(fromAhmed ? 520 : 200)} style={[styles.ctaBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <PressableScale accessibilityRole="button" accessibilityLabel={`${titleOfOpt(opt)} yolla başla`} haptic="medium" scaleTo={0.97} onPress={go} style={styles.cta}>
            <View style={styles.ctaIcon}>
              <Icon name="navigation-variant" size={22} color={C.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt w="black" size={17} color="#FFFFFF">
                Başla
              </Txt>
              <Txt w="semi" size={12.5} color="rgba(255,255,255,0.85)" numberOfLines={1}>
                {titleOfOpt(opt)} · {opt.durationMin} dəq · çatış {clockPlus(opt.durationMin)}
              </Txt>
            </View>
            <View style={styles.ctaScore}>
              <Icon name="shield-check" size={15} color="#FFFFFF" />
              <Txt w="bold" size={14} color="#FFFFFF">
                {score}
              </Txt>
            </View>
          </PressableScale>
        </ReAnimated.View>
      ) : null}

      {lmOpen && lm ? (
        <LastMetersCard
          lm={lm}
          moved={moved}
          speaking={voice.speaking}
          bottomInset={insets.bottom}
          onMove={moveDrop}
          onRevert={revertDrop}
          onSend={sendToDriver}
          onSpeak={() => (voice.speaking ? stop() : say(moved ? NAV.dropMoved : lm.note || NAV.lastMetersFallback))}
          onClose={closeLastMeters}
        />
      ) : null}
    </View>
  );
}

function LinkChip({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.link}>
      <Icon name={icon} size={17} color={C.route} />
      <Txt w="semi" size={13} color={C.ink} numberOfLines={1}>
        {label}
      </Txt>
    </PressableScale>
  );
}

/** Live route still landing: calm skeleton (never a spinner or an error). */
function ResultsSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <View style={{ flex: 1 }} />
      <View style={[styles.skelSheet, { paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.handle, { alignSelf: 'center', marginBottom: 16 }]} />
        <Skeleton width={120} height={12} />
        <Skeleton width={220} height={24} style={{ marginTop: 8 }} />
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 18 }}>
          <AhmedAvatar size={34} />
          <Txt w="semi" size={14} color={C.ai}>
            Əhməd yolları yoxlayır…
          </Txt>
        </View>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={84} radius={R.lg} style={{ marginTop: 12 }} />
        ))}
      </View>
    </View>
  );
}

/** No route for this place: Əhməd offers to try again (no error wording). */
function ResultsEmpty() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 28, paddingBottom: insets.bottom + 28 }}>
      <ReAnimated.View entering={FadeInDown.springify().damping(16)} style={{ alignItems: 'center' }}>
        <AhmedAvatar size={96} full />
        <Txt v="h2" center style={{ marginTop: 18 }}>
          Bu yeri hələ tanımıram
        </Txt>
        <Txt w="med" size={15} color={C.muted} center style={{ marginTop: 8, maxWidth: 300 }}>
          Ünvanı bir az dəqiq de, ya da yaxınlıqdakı tanınmış yeri söylə — yolu dərhal hesablayım.
        </Txt>
        <PressableScale accessibilityRole="button" haptic="medium" onPress={() => router.replace('/ahmed')} style={[styles.cta, { marginTop: 22, paddingHorizontal: 22, alignSelf: 'center' }]}>
          <Icon name="microphone" size={20} color="#FFFFFF" />
          <Txt w="bold" size={16} color="#FFFFFF">
            Əhmədə de
          </Txt>
        </PressableScale>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ marginTop: 14, padding: 8 }}>
          <Txt w="semi" size={14.5} color={C.route}>
            Geri qayıt
          </Txt>
        </Pressable>
      </ReAnimated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    ...shadow(3),
  },
  sheet: {
    flex: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    backgroundColor: C.bg,
    paddingHorizontal: 16,
  },
  handleZone: { alignSelf: 'stretch', alignItems: 'center', paddingTop: 8, paddingBottom: 6 },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: C.faint },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  lmTeaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    padding: 14,
    borderRadius: R.lg,
    backgroundColor: '#FFF4F4',
    borderWidth: 1.5,
    borderColor: 'rgba(229,72,77,0.25)',
  },
  lmIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 12, borderRadius: R.pill, backgroundColor: C.surface, flexShrink: 1 },
  ctaBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 8, backgroundColor: 'rgba(255,255,255,0.97)', borderTopWidth: 1, borderTopColor: C.line },
  cta: { height: 60, borderRadius: R.pill, backgroundColor: C.brand, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 7, paddingRight: 10, ...shadow(2) },
  ctaIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  ctaScore: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.22)' },
  skelSheet: { backgroundColor: C.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 18, ...shadow(3) },
});
