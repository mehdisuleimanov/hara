import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { SnapMarker } from '@/features/map/SnapMarker';
import Animated, { Easing, FadeIn, FadeInDown, FadeInUp, FadeOut, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppStore, useIsNight } from '@/store/useAppStore';
import { useNavStore } from '@/store/nav';
import { usePrefs } from '@/store/prefs';
import { destById } from '@/data/destinations';
import { optionOf, ROUTES } from '@/data/routes';
import { REPORT_META } from '@/data/reports-seed';
import type { Leg, LatLng, RouteKind, RouteOption } from '@/data/types';
import { liveRouteById } from '@/features/routing/live';
import { buildPlan, legAt, remainingMinutes, SPEED, STEP_TEXT, stopIndex, type Hazard } from '@/sim/navigationSim';
import { useMapLook } from '@/components/mapStyle';
import { IconPin, MeArrow } from '@/components/RouteLines';
import { AhmedAvatar } from '@/components/Brand';
import { CircleButton, Icon, Txt, tap } from '@/components/ui';
import { Burst, Pop, Pulse } from '@/components/anim';
import { AnimatedNumber } from '@/motion/AnimatedNumber';
import { PressableScale } from '@/motion/PressableScale';
import { LegPolyline } from '@/features/map/LegPolyline';
import { StationMarker } from '@/features/map/RouteLayer';
import { DayNightIcon } from '@/features/map/MapControls';
import { withDevFixtures } from '@/features/map/devFixtures';
import { say, stop, voiceState } from '@/voice';
import { NAV } from '@/voice/lines/nav';
import { COMMON } from '@/voice/lines/common';
import { clockPlus, fmtDist, haversine, pointAt, regionFor } from '@/utils/geo';
import { clearNavNotification, showNavNotification } from '@/utils/notify';
import { C, R, shadow } from '@/theme';

const TICK = 200;
const PITCH = 55;
const ZOOM_WALK = 17.6;
const ZOOM_RIDE = 16.3;
const zoomFromDelta = (d: number) => Math.max(11, Math.min(17, Math.log2(360 / Math.max(d, 1e-5)) - 0.3));

type Phase = 'intro' | 'go' | 'arrived';

/** Fixed spoken line per turn type (pre-generated Azerbaijani clips). */
const TURN_LINE: Record<string, string> = {
  left: NAV.turnLeft,
  right: NAV.turnRight,
  'slight-left': NAV.slightLeft,
  'slight-right': NAV.slightRight,
  uturn: NAV.uturn,
};

/** Speak without cutting Əhməd mid-sentence; priority lines interrupt. */
function useSpeakQueue() {
  const busyUntil = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return useCallback((line: string, priority = false) => {
    const now = Date.now();
    const trySay = (attempt: number) => {
      if (!priority && voiceState().speaking && attempt < 12) {
        timer.current = setTimeout(() => trySay(attempt + 1), 350);
        return;
      }
      say(line);
      busyUntil.current = Date.now() + 2500;
    };
    if (priority || now > busyUntil.current) trySay(0);
    else timer.current = setTimeout(() => trySay(0), busyUntil.current - now);
  }, []);
}

/** Quick white dissolve used to hide the satellite → vector map swap after the 3D intro. */
function Dissolve({ trigger, night }: { trigger: number; night: boolean }) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (!trigger) return;
    v.value = withSequence(withTiming(1, { duration: 220 }), withTiming(1, { duration: 260 }), withTiming(0, { duration: 520, easing: Easing.inOut(Easing.quad) }));
  }, [trigger, v]);
  const a = useAnimatedStyle(() => ({ opacity: v.value * 0.9 }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: night ? '#17223A' : '#FFFFFF' }, a]} />;
}

function VehiclePuck({ icon, bg }: { icon: string; bg: string }) {
  return (
    <View style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: 52, height: 52, borderRadius: 26, backgroundColor: bg + '33' }} />
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: bg, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', ...shadow(2) }}>
        <Icon name={icon} size={20} color="#FFFFFF" />
      </View>
    </View>
  );
}

function scooterOption(kind: 'calm' | 'seafront'): RouteOption {
  const line = ROUTES.scooter[kind];
  return {
    id: `scooter-${kind}`,
    destId: 'port',
    kind: 'safest',
    legs: [{ mode: 'scooter', c: line.c, distanceM: line.distanceM, durationMin: line.durationMin }],
    durationMin: line.durationMin,
    distanceM: line.distanceM,
    price: '0 ₼',
    co2g: 0,
    scoreDay: 88,
    scoreNight: 84,
    avoided: 1,
    unsignalized: 0,
    reasons: [],
    steps: [],
  };
}

export default function Navigate() {
  const { dest: destParam, kind = 'safest', scooter } = useLocalSearchParams<{ dest?: string; kind?: RouteKind; scooter?: 'calm' | 'seafront' }>();
  const destKey = scooter ? 'port' : String(destParam ?? 'hilton');
  const insets = useSafeAreaInsets();
  const night = useIsNight();
  const navSpeed = useAppStore((s) => s.navSpeed);
  const addPoints = useAppStore((s) => s.addPoints);
  const points = useAppStore((s) => s.points);
  const reports = useAppStore((s) => s.reports);
  const setNav = useNavStore((s) => s.set);
  const clearNav = useNavStore((s) => s.clear);
  const satPref = usePrefs((p) => p.mapSatellite);
  const setSatPref = usePrefs((p) => p.setMapSatellite);
  const speakQ = useSpeakQueue();

  const { option, destName, destShort } = useMemo(() => {
    if (scooter) return { option: scooterOption(scooter), destName: destById('port')?.name ?? 'Port Baku', destShort: 'Port Baku' };
    if (destKey.startsWith('live:')) {
      const lr = liveRouteById(destKey.slice(5)) ?? liveRouteById(destKey);
      const o = lr?.options.find((x) => x.kind === kind) ?? lr?.options[0];
      if (lr && o) return { option: o, destName: lr.place.name, destShort: lr.place.name };
    }
    const d = destById(destKey) ?? destById('hilton')!;
    const opts = withDevFixtures(d.id, [optionOf(d.id, kind) ?? optionOf(d.id, 'safest') ?? optionOf('hilton', 'safest')!]);
    return { option: opts[0], destName: d.name, destShort: d.short };
  }, [scooter, destKey, kind]);

  const plan = useMemo(() => buildPlan(option, night), [option, night]);
  const score = night ? option.scoreNight : option.scoreDay;

  const [phase, setPhase] = useState<Phase>('intro');
  const [dist, setDist] = useState(0);
  const [follow, setFollow] = useState(true);
  const [dissolve, setDissolve] = useState(0);
  const [introSat, setIntroSat] = useState(true);
  const look = useMapLook({ night, satellite: introSat || satPref });
  const mapRef = useRef<MapView>(null);
  const spoken = useRef(new Set<string>());
  const lastNotif = useRef({ key: '', t: 0 });
  const speedRef = useRef(navSpeed);
  speedRef.current = navSpeed;
  const pointsAtStart = useRef(points);

  const start = plan.track.pts[0];
  const end = plan.track.pts[plan.track.pts.length - 1];
  const overviewRegion = useMemo(() => regionFor(plan.track.pts, 1.5), [plan]);

  // ---- 3D intro: overview (satellite) → fly down to the start, tilt, then dissolve into the clean map
  const introDone = useRef(false);
  const runIntro = useCallback(() => {
    if (introDone.current) return;
    introDone.current = true;
    const h = pointAt(plan.track, 8).heading;
    setTimeout(() => {
      mapRef.current?.animateCamera({ center: start, heading: h, pitch: PITCH, zoom: plan.legUnder[0] ? 16.4 : ZOOM_WALK }, { duration: 2300 });
    }, 450);
    setTimeout(() => {
      setDissolve((n) => n + 1);
      setTimeout(() => setIntroSat(false), 230);
    }, 3000);
    setTimeout(() => {
      setPhase('go');
      speakQ(NAV.start, true);
    }, 3400);
  }, [plan, start, speakQ]);
  useEffect(() => {
    const t = setTimeout(runIntro, 1500); // web preview / slow onMapReady
    return () => clearTimeout(t);
  }, [runIntro]);

  // ---- simulation loop
  useEffect(() => {
    if (phase !== 'go') return;
    const id = setInterval(() => {
      setDist((d) => {
        const li = legAt(plan, d);
        const m = plan.legMode[li];
        const nd = d + SPEED[m] * (TICK / 1000) * speedRef.current * (m === 'walk' ? 1 : 1.6);
        return Math.min(nd, plan.track.total);
      });
    }, TICK);
    return () => clearInterval(id);
  }, [phase, plan]);
  useEffect(
    () => () => {
      stop();
      clearNavNotification();
      clearNav();
    },
    [clearNav],
  );

  const { p: pos, heading } = pointAt(plan.track, dist);
  const li = legAt(plan, dist);
  const mode = plan.legMode[li];
  const under = plan.legUnder[li];
  const stops = plan.stops[li];
  const stopK = stops ? stopIndex(stops, dist) : 0;
  const nextIdx = plan.steps.findIndex((s) => s.atM > dist + 2);
  const next = nextIdx >= 0 ? plan.steps[nextIdx] : null;
  const toNext = next ? next.atM - dist : plan.track.total - dist;
  const stepInfo = next ? STEP_TEXT[next.type] ?? STEP_TEXT.straight : STEP_TEXT.arrive;
  const remainingM = Math.max(0, plan.track.total - dist);
  const remMin = remainingMinutes(plan, dist);
  const hazardIdx = plan.hazards.findIndex((h) => h.atM - dist > 8 && h.atM - dist < 120);
  const hazard: Hazard | null = hazardIdx >= 0 && mode === 'walk' ? plan.hazards[hazardIdx] : null;
  const lmAlert = mode === 'taxi' && option.lastMeters?.wrongSide && plan.legEnd[li] - dist < 300 ? option.lastMeters : null;
  const alightName = stops ? stops.stations[stops.stations.length - 1]?.name : '';
  const street =
    mode === 'metro'
      ? `${alightName}-də düş`
      : mode === 'bus'
        ? `${alightName} dayanacağında düş`
        : mode === 'taxi'
          ? `${destShort} · taksi`
          : next?.street || (mode === 'scooter' ? 'Velosiped zolağı' : 'Piyada yolu');
  const maneuver = mode === 'metro' ? 'Metroda' : mode === 'bus' ? 'Avtobusda' : mode === 'taxi' ? 'Taksidə' : stepInfo.text;
  const maneuverIcon = mode === 'metro' ? 'subway-variant' : mode === 'bus' ? 'bus' : mode === 'taxi' ? 'taxi' : stepInfo.icon;

  // ---- camera per mode
  const lastCamLeg = useRef(-1);
  const camHeading = useRef<number | null>(null);
  const camHold = useRef(0);
  useEffect(() => {
    if (phase !== 'go' || !follow) return;
    if (under) {
      if (lastCamLeg.current !== li) {
        lastCamLeg.current = li;
        const legPts = plan.track.pts.slice(plan.legIdx[li], li + 1 < plan.legIdx.length ? plan.legIdx[li + 1] : undefined);
        mapRef.current?.animateCamera({ pitch: 0, heading: 0 }, { duration: 500 });
        setTimeout(() => mapRef.current?.fitToCoordinates(legPts, { edgePadding: { top: 160, right: 70, bottom: 260, left: 70 }, animated: true }), 380);
      }
      return;
    }
    const ride = mode === 'taxi' || mode === 'bus';
    // smooth the bearing so the 3D camera eases through turns instead of snapping
    const prevH = camHeading.current ?? heading;
    let dh = ((heading - prevH + 540) % 360) - 180;
    if (Math.abs(dh) < 0.5) dh = 0;
    camHeading.current = (prevH + dh * 0.35 + 360) % 360;
    const now = Date.now();
    if (lastCamLeg.current !== li) {
      // leg change (e.g. out of the metro): one long cinematic move back into 3D
      lastCamLeg.current = li;
      camHeading.current = heading;
      camHold.current = now + 1300;
      mapRef.current?.animateCamera({ center: pos, heading, pitch: ride ? 45 : PITCH, zoom: ride ? ZOOM_RIDE : ZOOM_WALK }, { duration: 1200 });
      return;
    }
    if (now < camHold.current) return;
    mapRef.current?.animateCamera({ center: pos, heading: camHeading.current, pitch: ride ? 45 : PITCH, zoom: ride ? ZOOM_RIDE : ZOOM_WALK }, { duration: TICK + 40 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dist, follow, phase]);

  // ---- voice, haptics, notification, widget snapshot
  const once = (key: string, fn: () => void) => {
    if (spoken.current.has(key)) return;
    spoken.current.add(key);
    fn();
  };
  useEffect(() => {
    if (phase !== 'go') return;
    // leg transitions
    if (mode === 'metro') once(`board-${li}`, () => speakQ(NAV.metroBoard));
    if (mode === 'bus') once(`board-${li}`, () => speakQ(NAV.busBoard));
    if (mode === 'taxi') once(`board-${li}`, () => speakQ(NAV.taxiBoard));
    if (li > 0 && plan.legMode[li - 1] === 'metro' && mode === 'walk') once(`exit-${li}`, () => speakQ(NAV.metroExit));
    if (stops && stops.stations.length >= 2 && stopK === stops.stations.length - 2 && dist > stops.atM[0] + 30) {
      once(`next-${li}`, () => speakQ(mode === 'bus' ? NAV.busNext : NAV.metroNext));
    }
    if (stops && stopK > 0) once(`stop-${li}-${stopK}`, () => Haptics.selectionAsync().catch(() => {}));
    if (mode === 'taxi' && option.lastMeters?.wrongSide && plan.legEnd[li] - dist < 260) once(`lm-${li}`, () => speakQ(NAV.taxiWrongSide, true));
    // turns (walking / riding on the surface)
    if (!under && next && toNext < 38 && TURN_LINE[next.type]) once(`turn-${nextIdx}`, () => speakQ(TURN_LINE[next.type]));
    // risky crossing ahead -> Əhməd re-routes to the signalized one
    if (hazard && hazard.atM - dist <= 85) {
      once(`hz-${hazardIdx}`, () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        speakQ(hazard.kind === 'unmarked' ? NAV.hazardUnmarked : NAV.hazardUnsignalized, true);
      });
    }
    if (remainingM < 70 && mode === 'walk' && plan.track.total > 200) once('almost', () => speakQ(NAV.almost));

    const title = hazard ? `Diqqət: ${hazard.text}` : `${under ? '' : fmtDist(toNext) + ' · '}${maneuver}${street ? ' · ' + street : ''}`;
    const body = `${remMin} dəq · ${fmtDist(remainingM)} · bal ${score}`;
    const key = `${nextIdx}|${hazard ? hazardIdx : -1}|${remMin}|${li}`;
    const now = Date.now();
    if (key !== lastNotif.current.key || now - lastNotif.current.t > 8000) {
      lastNotif.current = { key, t: now };
      showNavNotification(title, hazard ? `Əhməd: səni işıqforlu keçidə yönləndirirəm · ${body}` : body);
    }
    setNav({
      active: true,
      destName,
      maneuver,
      maneuverIcon,
      distToNext: under ? remainingM : toNext,
      street,
      remainingM,
      remainingMin: remMin,
      eta: clockPlus(remMin),
      score,
      speedKmh: Math.round(SPEED[mode] * 3.6),
      route: plan.track.pts,
      pos,
      hazard: hazard?.text ?? null,
    });

    if (dist >= plan.track.total - 0.5) {
      setPhase('arrived');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      clearNavNotification();
      setNav({ active: false, hazard: null });
      speakQ(COMMON.arrived, true);
      setTimeout(() => addPoints(5, 'Yaşıl addım'), 900);
      mapRef.current?.animateCamera({ center: end, pitch: 30, zoom: 17.2 }, { duration: 900 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dist, phase]);

  // ---- lines: done legs faded, the current leg split at the puck, the rest active
  const bucket = Math.floor(dist / 8);
  const lines = useMemo(() => {
    const out: { key: string; leg: Leg; state: 'done' | 'active' }[] = [];
    option.legs.forEach((leg, i) => {
      if (i < li) out.push({ key: `d${i}`, leg, state: 'done' });
      else if (i > li || phase === 'intro') out.push({ key: `a${i}`, leg, state: 'active' });
      else if (plan.legUnder[i]) out.push({ key: `a${i}`, leg, state: 'active' });
      else {
        const at = pointAt(plan.track, bucket * 8);
        const from = plan.legIdx[i];
        const to = i + 1 < plan.legIdx.length ? plan.legIdx[i + 1] : plan.track.pts.length;
        const cut = Math.max(from, Math.min(at.index, to));
        const donePts = plan.track.pts.slice(from, cut).concat(at.p);
        const restPts = [at.p, ...plan.track.pts.slice(cut, to)];
        if (donePts.length > 1) out.push({ key: `dc${i}`, leg: { ...leg, c: donePts.flatMap((p) => [p.latitude, p.longitude]) }, state: 'done' });
        if (restPts.length > 1) out.push({ key: `ac${i}`, leg: { ...leg, c: restPts.flatMap((p) => [p.latitude, p.longitude]) }, state: 'active' });
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, li, plan, option, phase === 'intro']);

  // stations of all metro legs (badges)
  const stationMarks = useMemo(
    () =>
      plan.stops.flatMap((s, i) =>
        s && plan.legMode[i] === 'metro' ? s.stations.map((st, k) => ({ st, major: k === 0 || k === s.stations.length - 1, key: `${i}-${k}` })) : [],
      ),
    [plan],
  );
  const nearReports = useMemo(() => {
    const pts = plan.track.pts.filter((_, i) => i % 4 === 0);
    return reports.filter((r) => pts.some((p) => haversine(r.lat, r.lon, p.latitude, p.longitude) < 400)).slice(0, 5);
  }, [plan, reports]);

  // puck: walking arrow on the surface; vehicle puck in taxi/bus; on metro it hops station → station
  const metroPuck: LatLng | null = under && stops ? { latitude: stops.stations[stopK].lat, longitude: stops.stations[stopK].lon } : null;

  const finish = () => {
    tap();
    stop();
    clearNavNotification();
    router.back();
  };
  const overview = () => {
    tap();
    setFollow(false);
    mapRef.current?.animateCamera({ pitch: 0, heading: 0 }, { duration: 300 });
    setTimeout(() => mapRef.current?.fitToCoordinates(plan.track.pts, { edgePadding: { top: 200, right: 50, bottom: 220, left: 50 }, animated: true }), 250);
  };
  const recenter = () => {
    tap();
    lastCamLeg.current = -1;
    setFollow(true);
  };

  const initialZoom = zoomFromDelta(overviewRegion.latitudeDelta);
  const headerTop = insets.top + 8;

  return (
    <View style={{ flex: 1, backgroundColor: night ? '#17223A' : C.bg }}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        mapType={look.mapType}
        customMapStyle={look.customMapStyle}
        initialCamera={{ center: { latitude: overviewRegion.latitude, longitude: overviewRegion.longitude }, heading: 0, pitch: 0, zoom: initialZoom, altitude: 2000 }}
        onMapReady={runIntro}
        showsBuildings
        toolbarEnabled={false}
        showsCompass={false}
        onPanDrag={() => phase === 'go' && setFollow(false)}
        mapPadding={{ top: insets.top + 130, bottom: 150, left: 0, right: 0 }}
      >
        {lines.map((l) => (
          <LegPolyline key={l.key} leg={l.leg} state={l.state} zIndex={l.state === 'done' ? 3 : 6} dark={look.dark} />
        ))}
        {stationMarks.map((s) => (
          <StationMarker key={`st-${s.key}`} s={s.st} major={s.major} dark={look.dark} />
        ))}
        {plan.hazards.map((h, i) => (
          <SnapMarker key={`hz${i}`} coordinate={{ latitude: h.lat, longitude: h.lon }} anchor={{ x: 0.5, y: 0.5 }} zIndex={20}>
            <View style={styles.hzDot}>
              <Icon name="alert" size={13} color="#FFFFFF" />
            </View>
          </SnapMarker>
        ))}
        {nearReports.map((r) => {
          const m = REPORT_META[r.category];
          return <IconPin key={r.id} latitude={r.lat} longitude={r.lon} icon={m.icon} bg={m.tone === 'danger' ? C.danger : C.warn} size={34} />;
        })}
        {end ? (
          <SnapMarker coordinate={end} anchor={{ x: 0.5, y: 0.5 }} zIndex={25}>
            <View style={styles.finishPin}>
              <Icon name="flag-checkered" size={22} color={C.navy} />
            </View>
          </SnapMarker>
        ) : null}
        {metroPuck ? (
          <SnapMarker key={`mp-${li}`} coordinate={metroPuck} anchor={{ x: 0.5, y: 0.5 }} zIndex={45}>
            <VehiclePuck icon="subway-variant" bg={C.underground} />
          </SnapMarker>
        ) : mode === 'taxi' || mode === 'bus' ? (
          <SnapMarker key={`vp-${mode}`} coordinate={pos} anchor={{ x: 0.5, y: 0.5 }} zIndex={45}>
            <VehiclePuck icon={mode === 'taxi' ? 'taxi' : 'bus'} bg={mode === 'taxi' ? C.navy : C.route} />
          </SnapMarker>
        ) : (
          <SnapMarker
            key="me"
            coordinate={pos}
            anchor={{ x: 0.5, y: 0.55 }}
            flat={false}
            rotation={Platform.OS !== 'web' && (!follow || phase !== 'go') ? Math.round(heading) : 0}
           
            zIndex={45}
          >
            <MeArrow size={54} heading={Platform.OS === 'web' ? heading : 0} />
          </SnapMarker>
        )}
      </MapView>

      <Dissolve trigger={dissolve} night={night} />

      {/* maneuver header */}
      {phase !== 'arrived' ? (
        <Animated.View entering={FadeInDown.springify().damping(18).delay(200)} style={[styles.header, { top: headerTop }]}>
          {phase === 'intro' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <View style={[styles.manIcon, { backgroundColor: C.aiSoft }]}>
                <AhmedAvatar size={34} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="overline" color={C.ai}>
                  Əhməd
                </Txt>
                <Txt w="bold" size={17} numberOfLines={2}>
                  {destShort} · ən az riskli yol hazırdır
                </Txt>
              </View>
            </View>
          ) : (
            <Animated.View key={`${maneuverIcon}-${under}`} entering={FadeIn.duration(220)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <View style={[styles.manIcon, { backgroundColor: under ? C.underground : mode === 'taxi' ? C.navy : C.route }]}>
                {under ? (
                  <Txt w="black" size={22} color="#FFFFFF">
                    M
                  </Txt>
                ) : (
                  <Icon name={maneuverIcon} size={34} color="#FFFFFF" label={maneuver} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                {under || mode === 'taxi' || mode === 'bus' ? (
                  <Txt v="h1" size={24} lh={30} numberOfLines={1}>
                    {maneuver}
                  </Txt>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                    <Txt v="num" size={28} lh={32}>
                      {fmtDist(toNext)}
                    </Txt>
                    <Txt w="bold" size={16} color={C.ink2} numberOfLines={1} style={{ flexShrink: 1 }}>
                      {maneuver}
                    </Txt>
                  </View>
                )}
                <Txt w="semi" size={14.5} color={C.muted} numberOfLines={1}>
                  {street}
                </Txt>
              </View>
            </Animated.View>
          )}
          <CircleButton icon="close" size={42} bg={C.bg2} label="Naviqasiyanı bitir" onPress={finish} />
        </Animated.View>
      ) : null}

      {/* Son 50 metr while still in the taxi */}
      {lmAlert && !hazard && phase === 'go' ? (
        <Animated.View key="lm-alert" entering={FadeInDown.springify().damping(15)} exiting={FadeOut.duration(200)} style={[styles.hazardWrap, { top: headerTop + 100 }]}>
          <View style={[styles.hazard, { backgroundColor: '#FFF1F1', borderColor: C.danger }]}>
            <View style={styles.hazardAvatar}>
              <AhmedAvatar size={30} mood="talk" />
            </View>
            <View style={{ flex: 1 }}>
              <Txt w="black" size={15.5} color="#9B1C22">
                Qarşı tərəfdə düşürür · {lmAlert.lanes} zolaq
              </Txt>
              <Txt w="semi" size={13} color="#B4232A" style={{ marginTop: 2 }}>
                Keçməyə tələsmə, işıqforlu keçidə aparacağam
              </Txt>
            </View>
            <Icon name="traffic-light" size={26} color={C.brandDark} />
          </View>
        </Animated.View>
      ) : null}

      {/* Əhməd hazard alert */}
      {hazard && phase === 'go' ? (
        <Animated.View key={`hz-${hazardIdx}`} entering={FadeInDown.springify().damping(15)} exiting={FadeOut.duration(200)} style={[styles.hazardWrap, { top: headerTop + 100 }]}>
          <View style={styles.hazard}>
            <View style={styles.hazardAvatar}>
              <AhmedAvatar size={30} mood="talk" />
            </View>
            <View style={{ flex: 1 }}>
              <Txt w="black" size={15.5} color="#7A4A00">
                {Math.max(10, Math.round((hazard.atM - dist) / 10) * 10)} m irəlidə {hazard.kind === 'unmarked' ? 'nişansız keçid' : 'işıqforsuz keçid'}
              </Txt>
              <Txt w="semi" size={13} color="#8A5A00" style={{ marginTop: 2 }}>
                Səni işıqforlu keçidə yönləndirirəm{hazard.lanes ? ` · ${hazard.lanes} zolaq` : ''}
              </Txt>
            </View>
            <Icon name="traffic-light" size={26} color={C.brandDark} />
          </View>
        </Animated.View>
      ) : null}

      {/* "Metroda · N stansiya" — dots fill station by station */}
      {phase === 'go' && stops && (mode === 'metro' || mode === 'bus') ? (
        <Animated.View entering={FadeInUp.springify().damping(17)} exiting={FadeOut.duration(220)} style={[styles.transit, { bottom: 150 + Math.max(insets.bottom, 12) }]}>
          <TransitCard mode={mode} stations={stops.stations.map((s) => s.name)} k={stopK} frac={(dist - plan.legStart[li]) / Math.max(1, plan.legEnd[li] - plan.legStart[li])} />
        </Animated.View>
      ) : null}

      {/* bottom bar */}
      {phase !== 'arrived' ? (
        <Animated.View entering={FadeInUp.springify().damping(18).delay(300)} style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <PressableScale accessibilityRole="button" accessibilityLabel={follow ? 'Ümumi baxış' : 'Mərkəzə qayıt'} onPress={follow ? overview : recenter} style={styles.roundBtn}>
            <Icon name={follow ? 'map-outline' : 'navigation-variant'} size={24} color={follow ? C.ink : C.route} />
          </PressableScale>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <Txt v="num" size={26} lh={30} color={C.brandDark}>
                {remMin}
              </Txt>
              <Txt w="bold" size={14} color={C.brandDark}>
                dəq
              </Txt>
            </View>
            <Txt w="semi" size={13.5} color={C.muted}>
              {fmtDist(remainingM)} · çatış {clockPlus(remMin)} · {score} bal
            </Txt>
          </View>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={satPref ? 'Xəritə görünüşü' : 'Peyk görünüşü'}
            onPress={() => {
              tap();
              setSatPref(!satPref);
            }}
            style={[styles.roundBtn, satPref && { backgroundColor: C.purple }]}
          >
            <Icon name={satPref ? 'satellite-variant' : 'layers-outline'} size={23} color={satPref ? C.route : C.ink} />
          </PressableScale>
        </Animated.View>
      ) : null}

      {phase === 'arrived' ? <Arrival destName={destName} avoided={option.avoided} from={pointsAtStart.current} to={pointsAtStart.current + 5} night={night} onDone={finish} bottom={insets.bottom} /> : null}
    </View>
  );
}

function TransitCard({ mode, stations, k, frac }: { mode: 'metro' | 'bus'; stations: string[]; k: number; frac: number }) {
  const n = Math.max(1, stations.length - 1);
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(Math.max(0, Math.min(1, frac)), { duration: 260 });
  }, [frac, w]);
  const bar = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  const tint = mode === 'metro' ? C.underground : C.route;
  return (
    <View style={styles.transitCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={[styles.mBadge, { backgroundColor: tint }]}>
          {mode === 'metro' ? (
            <Txt w="black" size={15} color="#FFFFFF">
              M
            </Txt>
          ) : (
            <Icon name="bus" size={17} color="#FFFFFF" />
          )}
        </View>
        <Txt w="black" size={17} style={{ flex: 1 }}>
          {mode === 'metro' ? 'Metroda' : 'Avtobusda'} · {n} {mode === 'metro' ? 'stansiya' : 'dayanacaq'}
        </Txt>
        <Txt w="semi" size={13} color={C.muted}>
          {Math.min(k, n)}/{n}
        </Txt>
      </View>
      <View style={{ marginTop: 14, marginHorizontal: 8, height: 22, justifyContent: 'center' }}>
        <View style={styles.track} />
        <Animated.View style={[styles.trackFill, { backgroundColor: tint }, bar]} />
        <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
          {stations.map((s, i) => {
            const passed = i <= k;
            const current = i === k + 1;
            return (
              <View key={`${s}-${i}`} style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
                {current ? <Pulse size={30} color={tint} duration={1400} style={{ left: -4, top: -4 }} /> : null}
                <View style={[styles.stDot, { borderColor: tint, backgroundColor: passed ? tint : '#FFFFFF' }]}>{passed ? <Icon name="check" size={10} color="#FFFFFF" /> : null}</View>
              </View>
            );
          })}
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Txt w="semi" size={12.5} color={C.muted} numberOfLines={1} style={{ maxWidth: '48%' }}>
          {stations[0]}
        </Txt>
        <Txt w="bold" size={12.5} color={C.ink} numberOfLines={1} style={{ maxWidth: '48%' }}>
          {stations[stations.length - 1]}
        </Txt>
      </View>
    </View>
  );
}

function Arrival({ destName, avoided, from, to, night, onDone, bottom }: { destName: string; avoided: number; from: number; to: number; night: boolean; onDone: () => void; bottom: number }) {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={[StyleSheet.absoluteFill, styles.scrim]}>
      <Animated.View entering={FadeInUp.springify().damping(15).stiffness(150)} style={[styles.arrive, { marginBottom: bottom + 16 }]}>
        <View style={{ alignItems: 'center', justifyContent: 'center', height: 120 }}>
          <Burst size={240} count={16} />
          <Pop>
            <View style={styles.arriveBadge}>
              <Icon name="flag-checkered" size={40} color="#FFFFFF" />
            </View>
          </Pop>
        </View>
        <Txt v="hero" center>
          Çatdın!
        </Txt>
        <Txt w="semi" size={15.5} color={C.muted} center style={{ marginTop: 4 }}>
          {destName}
        </Txt>
        <View style={styles.arriveStats}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Icon name="shield-check" size={22} color={C.safe} />
            <Txt w="bold" size={13.5} center style={{ marginTop: 4 }}>
              {avoided > 0 ? `${avoided} riskli keçiddən yan keçdin` : 'Ən az riskli yolla gəldin'}
            </Txt>
          </View>
          <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: C.line }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="star-circle" size={22} color={C.warn} />
              <Txt w="black" size={16} color={C.brandDark}>
                +5
              </Txt>
            </View>
            <AnimatedNumber value={to} v="h3" duration={1200} delay={700} style={{ marginTop: 2 }} />
            <Txt w="med" size={12} color={C.muted}>
              xal
            </Txt>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, backgroundColor: C.aiSoft, borderRadius: 16, padding: 10 }}>
          <AhmedAvatar size={26} />
          <Txt w="med" size={13.5} color={C.ink2} style={{ flex: 1 }}>
            {night ? 'Gecə yolu işıqlı küçələrdən keçdi.' : 'Yaxşı yol oldu. Növbəti dəfə də yanındayam.'}
          </Txt>
          <DayNightIcon night={night} size={18} />
        </View>
        <PressableScale accessibilityRole="button" haptic="medium" onPress={onDone} style={styles.done}>
          <Txt w="black" size={17} color="#FFFFFF">
            Bitir
          </Txt>
        </PressableScale>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.bg,
    borderRadius: 24,
    padding: 12,
    ...shadow(3),
  },
  manIcon: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  hazardWrap: { position: 'absolute', left: 12, right: 12 },
  hazard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF6E0',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1.5,
    borderColor: C.warn,
    ...shadow(2),
  },
  hazardAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  hzDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.warn, borderWidth: 2.5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  finishPin: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(2),
  },
  transit: { position: 'absolute', left: 12, right: 12 },
  transitCard: { backgroundColor: C.bg, borderRadius: 22, padding: 14, ...shadow(3) },
  mBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  track: { position: 'absolute', left: 11, right: 11, height: 4, borderRadius: 2, backgroundColor: C.line },
  trackFill: { position: 'absolute', left: 11, height: 4, borderRadius: 2, maxWidth: '96%' },
  stDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.bg,
    paddingTop: 14,
    paddingHorizontal: 16,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    ...shadow(3),
  },
  roundBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: C.bg2, alignItems: 'center', justifyContent: 'center' },
  scrim: { backgroundColor: 'rgba(15,27,45,0.35)', justifyContent: 'flex-end', paddingHorizontal: 14 },
  arrive: { backgroundColor: C.bg, borderRadius: 30, padding: 20, ...shadow(3) },
  arriveBadge: { width: 84, height: 84, borderRadius: 42, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: '#FFFFFF', ...shadow(2) },
  arriveStats: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, backgroundColor: C.surface, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 8 },
  done: { height: 56, borderRadius: R.pill, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
});
