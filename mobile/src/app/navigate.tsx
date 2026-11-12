import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppStore, useIsNight } from '@/store/useAppStore';
import { useNavStore } from '@/store/nav';
import { destById } from '@/data/destinations';
import { optionOf, ROUTES } from '@/data/routes';
import { REPORT_META } from '@/data/reports-seed';
import type { RouteKind, RouteOption } from '@/data/types';
import { buildPlan, legAt, remainingMinutes, SPEED, STEP_TEXT } from '@/sim/navigationSim';
import { MAP_STYLE_FOR_TYPE, MAP_TYPE, mapTypeFor, useSatelliteType } from '@/components/mapStyle';
import { IconPin, MeArrow } from '@/components/RouteLines';
import { AhmedAvatar } from '@/components/Brand';
import { CircleButton, Icon, Txt, tap } from '@/components/ui';
import { Pop } from '@/components/anim';
import { fmtDist, haversine, pointAt, regionFor } from '@/utils/geo';
import { speak, stopSpeaking } from '@/utils/tts';
import { clearNavNotification, showNavNotification } from '@/utils/notify';
import { C, R, shadow } from '@/theme';

const TICK = 200;
const PITCH = 55; // Waze-like 3D tilt
const ZOOM_WALK = 17.4;

/** Waze-style street name pill with a tail, placed at upcoming turns. */
function StreetPill({ name }: { name: string }) {
  return (
    <View style={{ alignItems: 'flex-start' }}>
      <View style={styles.streetPill}>
        <Txt w="bold" size={15} color="#FFFFFF" numberOfLines={1}>
          {name}
        </Txt>
      </View>
      <View style={styles.streetTail} />
    </View>
  );
}

export default function Navigate() {
  const { dest: destParam, kind = 'safest', scooter } = useLocalSearchParams<{ dest?: string; kind?: RouteKind; scooter?: 'calm' | 'seafront' }>();
  const dest = scooter ? 'port' : destParam ?? 'hilton';
  const insets = useSafeAreaInsets();
  const night = useIsNight();
  const navSpeed = useAppStore((s) => s.navSpeed);
  const addPoints = useAppStore((s) => s.addPoints);
  const reports = useAppStore((s) => s.reports);
  const setNav = useNavStore((s) => s.set);
  const clearNav = useNavStore((s) => s.clear);
  const d0 = destById(dest);
  const option = useMemo<RouteOption>(() => {
    if (scooter) {
      const line = ROUTES.scooter[scooter];
      return {
        id: `scooter-${scooter}`,
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
    return optionOf(dest, kind) ?? optionOf('hilton', 'safest')!;
  }, [scooter, dest, kind]);
  const plan = useMemo(() => buildPlan(option, night), [option, night]);
  const score = night ? option.scoreNight : option.scoreDay;

  const [dist, setDist] = useState(0);
  const [arrived, setArrived] = useState(false);
  const [follow, setFollow] = useState(true);
  const mapRef = useRef<MapView>(null);
  const spokenSteps = useRef(new Set<number>());
  const spokenHazards = useRef(new Set<number>());
  const lastNotif = useRef({ key: '', t: 0 });
  const speedRef = useRef(navSpeed);
  speedRef.current = navSpeed;

  // reports close to the route (Waze-style icons on the map)
  const nearReports = useMemo(() => {
    const pts = plan.track.pts.filter((_, i) => i % 4 === 0);
    return reports.filter((r) => pts.some((p) => haversine(r.lat, r.lon, p.latitude, p.longitude) < 450)).slice(0, 6);
  }, [plan, reports]);

  // simulation loop
  useEffect(() => {
    speak(`Yola düşdük. ${d0?.short ?? ''} istiqamətinə ən az riskli yolla gedirik.`);
    const id = setInterval(() => {
      setDist((d) => {
        const li = legAt(plan, d);
        const nd = d + SPEED[plan.legMode[li]] * (TICK / 1000) * speedRef.current * (plan.legMode[li] === 'walk' ? 1 : 1.6);
        return Math.min(nd, plan.track.total);
      });
    }, TICK);
    return () => {
      clearInterval(id);
      stopSpeaking();
      clearNavNotification();
      clearNav();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const { p: pos, heading } = pointAt(plan.track, dist);
  const li = legAt(plan, dist);
  const mode = plan.legMode[li];
  const nextIdx = plan.steps.findIndex((s) => s.atM > dist + 2);
  const next = nextIdx >= 0 ? plan.steps[nextIdx] : null;
  const toNext = next ? next.atM - dist : plan.track.total - dist;
  const stepInfo = next ? STEP_TEXT[next.type] ?? STEP_TEXT.straight : STEP_TEXT.arrive;
  const street =
    next?.type === 'board' || next?.type === 'alight'
      ? next.street ?? ''
      : next?.street || (mode === 'metro' ? 'Metro' : mode === 'bus' ? 'Avtobus' : mode === 'scooter' ? 'Velosiped zolağı' : 'Piyada yolu');
  const remainingM = plan.track.total - dist;
  const remMin = remainingMinutes(plan, dist);
  const hazardIdx = plan.hazards.findIndex((h) => h.atM - dist > 15 && h.atM - dist < 95 && mode === 'walk');
  const hazard = hazardIdx >= 0 ? plan.hazards[hazardIdx] : null;
  const maneuverText =
    mode === 'metro' && next?.type === 'alight'
      ? `${next.street}-də düş`
      : mode === 'bus' && next?.type === 'alight'
        ? `${next.street} dayanacağında düş`
        : stepInfo.text;

  // upcoming named turns -> street pills (max 3, unique names); recomputed only when the next step changes
  const pills = useMemo(() => {
    const out: { lat: number; lon: number; name: string }[] = [];
    for (const s of plan.steps) {
      if (s.atM <= dist || !s.street || out.some((o) => o.name === s.street)) continue;
      out.push({ lat: s.lat, lon: s.lon, name: s.street });
      if (out.length >= 3) break;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, nextIdx]);

  // per tick: camera, voice, haptics, notification, widget snapshot
  useEffect(() => {
    if (follow) mapRef.current?.animateCamera({ center: pos, heading, pitch: PITCH, zoom: mode === 'walk' ? ZOOM_WALK : 16 }, { duration: TICK });

    if (next && toNext < 45 && !spokenSteps.current.has(nextIdx)) {
      spokenSteps.current.add(nextIdx);
      if (next.type !== 'depart') speak(`${Math.round(toNext / 10) * 10} metr ${maneuverText}${next.street ? ', ' + next.street : ''}`);
    }
    if (hazard && !spokenHazards.current.has(hazardIdx)) {
      spokenHazards.current.add(hazardIdx);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      speak(`Diqqət. ${Math.round((hazard.atM - dist) / 10) * 10} metr irəlidə ${hazard.text.split(' · ')[0].toLowerCase()} var. İşıqforlu keçidə yönləndirirəm.`);
    }

    const title = `${fmtDist(toNext)} ${maneuverText}${street ? ' · ' + street : ''}`;
    const body = `${remMin} dəq · ${fmtDist(remainingM)} · Təhlükəsizlik ${score}`;
    const key = `${nextIdx}|${hazard ? hazardIdx : -1}|${remMin}`;
    const now = Date.now();
    if (!arrived && (key !== lastNotif.current.key || now - lastNotif.current.t > 8000)) {
      lastNotif.current = { key, t: now };
      showNavNotification(hazard ? `Diqqət: ${hazard.text}` : title, hazard ? `Əhməd: işıqforlu keçidə yönləndirirəm · ${body}` : body);
    }
    setNav({
      active: true,
      destName: d0?.name ?? '',
      maneuver: maneuverText,
      maneuverIcon: stepInfo.icon,
      distToNext: toNext,
      street,
      remainingM,
      remainingMin: remMin,
      eta: '',
      score,
      speedKmh: Math.round(SPEED[mode] * 3.6),
      route: plan.track.pts,
      pos,
      hazard: hazard?.text ?? null,
    });

    if (!arrived && dist >= plan.track.total - 0.5) {
      setArrived(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      speak(`Çatdın! ${d0?.short ?? ''}. Yol boyu işıqforsuz keçiddən keçmədin.`);
      clearNavNotification();
      setTimeout(() => addPoints(5, 'Yaşıl addım'), 800);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dist]);

  // PERF: rebuild the route polylines every ~10 m instead of every 200 ms tick
  const bucket = Math.floor(dist / 10);
  const { rest, done } = useMemo(() => {
    const pt = pointAt(plan.track, bucket * 10);
    return { rest: [pt.p, ...plan.track.pts.slice(pt.index)], done: plan.track.pts.slice(0, pt.index).concat(pt.p) };
  }, [bucket, plan]);
  const end = plan.track.pts[plan.track.pts.length - 1];

  const finish = () => {
    clearNavNotification();
    router.back();
  };
  const overview = () => {
    tap();
    setFollow(false);
    mapRef.current?.animateCamera({ pitch: 0, heading: 0 }, { duration: 300 });
    mapRef.current?.animateToRegion(regionFor(plan.track.pts, 1.4), 500);
  };
  const recenter = () => {
    tap();
    setFollow(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        mapType={follow && mode === 'walk' ? 'hybrid' : 'satellite'} customMapStyle={MAP_STYLE_FOR_TYPE}
        initialCamera={{ center: pos, heading, pitch: PITCH, zoom: ZOOM_WALK, altitude: 400 }}
        showsBuildings
        toolbarEnabled={false}
        showsCompass={false}
        onPanDrag={() => setFollow(false)}
        mapPadding={{ top: insets.top + 150, bottom: 140, left: 0, right: 0 }}
      >
        <Polyline coordinates={done} strokeColor="rgba(15,27,45,0.18)" strokeWidth={8} lineCap="round" zIndex={4} />
        {/* Waze-like thick route: dark rim + navy body + mint center sheen */}
        <Polyline coordinates={rest} strokeColor="rgba(0,0,0,0.45)" strokeWidth={18} lineCap="round" lineJoin="round" zIndex={5} />
        <Polyline coordinates={rest} strokeColor={C.route} strokeWidth={12} lineCap="round" lineJoin="round" zIndex={6} />
        <Polyline coordinates={rest} strokeColor="#FFFFFF" strokeWidth={2.5} lineCap="round" lineJoin="round" zIndex={7} />

        {pills.map((p) => (
          <Marker key={`${p.name}-${p.lat}`} coordinate={{ latitude: p.lat, longitude: p.lon }} anchor={{ x: 0.08, y: 1 }} tracksViewChanges={false} zIndex={22}>
            <StreetPill name={p.name} />
          </Marker>
        ))}

        {nearReports.map((r) => {
          const m = REPORT_META[r.category];
          return <IconPin key={r.id} latitude={r.lat} longitude={r.lon} icon={m.icon} bg={m.tone === 'danger' ? C.danger : C.warn} size={36} />;
        })}

        {end ? (
          <Marker coordinate={end} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={25}>
            <View style={styles.finish}>
              <Icon name="flag-checkered" size={24} color={C.navy} />
            </View>
          </Marker>
        ) : null}

        {/* 3D "you" arrow — the camera turns with the route, so it points up on device */}
        <Marker coordinate={pos} anchor={{ x: 0.5, y: 0.55 }} flat={false} tracksViewChanges={false} zIndex={40}>
          <MeArrow size={56} heading={Platform.OS === 'web' ? heading : 0} />
        </Marker>
      </MapView>

      {/* Waze-like dark maneuver header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        {arrived ? (
          <>
            <Icon name="flag-checkered" size={48} color={C.brand} />
            <View style={{ flex: 1 }}>
              <Txt w="black" size={30} color={C.ink}>
                Çatdın!
              </Txt>
              <Txt w="semi" size={15} color={C.muted} numberOfLines={1}>
                {d0?.name} · işıqforsuz keçid olmadı
              </Txt>
            </View>
          </>
        ) : (
          <>
            <Icon name={stepInfo.icon} size={64} color={C.route} label={maneuverText} />
            <View style={{ flex: 1 }}>
              <Txt w="black" size={34} color={C.ink} lh={38}>
                {fmtDist(toNext)}
              </Txt>
              <Txt w="semi" size={16} color={C.muted} numberOfLines={1}>
                {street}
              </Txt>
            </View>
          </>
        )}
        <View style={{ gap: 8 }}>
          <CircleButton icon="close" size={44} bg={C.bg2} color={C.ink} label="Naviqasiyanı bitir" onPress={finish} />
          <CircleButton icon="cellphone-lock" size={44} bg={C.bg2} color={C.ink} label="Kilid ekranı widget" onPress={() => router.push('/widget')} />
        </View>
      </View>

      {/* Əhməd hazard alert */}
      {hazard ? (
        <Pop key={hazardIdx} style={[styles.hazardWrap, { top: insets.top + 150 }]}>
          <View style={styles.hazard}>
            <Icon name="alert" size={24} color={C.warn} />
            <View style={{ flex: 1 }}>
              <Txt w="bold" size={15}>
                {Math.round((hazard.atM - dist) / 10) * 10} m irəlidə {hazard.text.split(' · ')[0].toLowerCase()}
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <AhmedAvatar size={18} />
                <Txt w="med" size={12.5} color={C.ink2}>
                  Əhməd: işıqforlu keçidə yönləndirirəm
                </Txt>
              </View>
            </View>
          </View>
        </Pop>
      ) : null}

      {/* Waze-like bottom bar: Re-center · time/distance · Overview */}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Mərkəzə qayıt" onPress={recenter} style={styles.recenter}>
          <View style={styles.recenterInner}>
            <Icon name="navigation" size={22} color="#FFFFFF" />
          </View>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Txt w="bold" size={20} numberOfLines={1}>
            {arrived ? 'Səfər bitdi' : follow ? d0?.name ?? '' : 'Mərkəzə qayıt'}
          </Txt>
          <Txt w="med" size={16} color={C.muted}>
            {remMin} dəq • {fmtDist(remainingM)} • {score} bal
          </Txt>
        </View>
        <Pressable accessibilityRole="button" onPress={arrived ? finish : overview} style={styles.overview}>
          <Txt w="bold" size={16}>
            {arrived ? 'Bitir' : 'Ümumi baxış'}
          </Txt>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: C.bg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  streetPill: {
    backgroundColor: C.route,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 220,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...shadow(2),
  },
  streetTail: {
    width: 14,
    height: 14,
    backgroundColor: C.route,
    transform: [{ rotate: '45deg' }],
    marginTop: -9,
    marginLeft: 10,
  },
  finish: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.surface,
    borderWidth: 3,
    borderColor: C.route,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(2),
  },
  hazardWrap: { position: 'absolute', left: 14, right: 14 },
  hazard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.warnSoft,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1.5,
    borderColor: C.warn,
    ...shadow(2),
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.surface,
    paddingTop: 14,
    paddingHorizontal: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...shadow(3),
  },
  recenter: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(15,27,45,0.05)', alignItems: 'center', justifyContent: 'center' },
  recenterInner: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.route, alignItems: 'center', justifyContent: 'center' },
  overview: { height: 52, paddingHorizontal: 20, borderRadius: R.pill, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', ...shadow(1) },
});
