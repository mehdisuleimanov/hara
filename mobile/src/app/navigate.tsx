import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppStore, useIsNight } from '@/store/useAppStore';
import { useNavStore } from '@/store/nav';
import { destById } from '@/data/destinations';
import { optionOf, ROUTES } from '@/data/routes';
import type { RouteKind, RouteOption } from '@/data/types';
import { buildPlan, legAt, remainingMinutes, SPEED, STEP_TEXT } from '@/sim/navigationSim';
import { MAP_STYLE } from '@/components/mapStyle';
import { DestPin } from '@/components/RouteLines';
import { AhmedAvatar } from '@/components/Brand';
import { ScoreRing } from '@/components/ScoreRing';
import { CircleButton, Icon, PillButton, Txt } from '@/components/ui';
import { clockPlus, fmtDist, pointAt } from '@/utils/geo';
import { speak, stopSpeaking } from '@/utils/tts';
import { clearNavNotification, showNavNotification } from '@/utils/notify';
import { C, R, shadow } from '@/theme';

const TICK = 200;

export default function Navigate() {
  const { dest: destParam, kind = 'safest', scooter } = useLocalSearchParams<{ dest?: string; kind?: RouteKind; scooter?: 'calm' | 'seafront' }>();
  const dest = scooter ? 'port' : destParam ?? 'hilton';
  const insets = useSafeAreaInsets();
  const night = useIsNight();
  const navSpeed = useAppStore((s) => s.navSpeed);
  const addPoints = useAppStore((s) => s.addPoints);
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
  const mapRef = useRef<MapView>(null);
  const spokenSteps = useRef(new Set<number>());
  const spokenHazards = useRef(new Set<number>());
  const lastNotif = useRef({ key: '', t: 0 });
  const speedRef = useRef(navSpeed);
  speedRef.current = navSpeed;

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
      : next?.street ||
        (mode === 'metro' ? 'Metro' : mode === 'bus' ? 'Avtobus' : mode === 'scooter' ? 'Velosiped zolağı' : 'Piyada yolu');
  const remainingM = plan.track.total - dist;
  const remMin = remainingMinutes(plan, dist);
  const eta = clockPlus(remMin);
  const hazardIdx = plan.hazards.findIndex((h) => h.atM - dist > 15 && h.atM - dist < 95 && mode === 'walk');
  const hazard = hazardIdx >= 0 ? plan.hazards[hazardIdx] : null;
  const maneuverText =
    mode === 'metro' && next?.type === 'alight'
      ? `${next.street}-də düş`
      : mode === 'bus' && next?.type === 'alight'
        ? `${next.street} dayanacağında düş`
        : stepInfo.text;

  // side effects per tick: camera, voice, haptics, notification, widget snapshot
  useEffect(() => {
    mapRef.current?.animateCamera({ center: pos, heading, pitch: 50, zoom: mode === 'walk' ? 17.6 : 15.5 }, { duration: TICK });

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
    const body = `${remMin} dəq · ${fmtDist(remainingM)} · Çatış ${eta} · Təhlükəsizlik ${score}`;
    const key = `${nextIdx}|${hazard ? hazardIdx : -1}|${remMin}`;
    const now = Date.now();
    if (!arrived && (key !== lastNotif.current.key || now - lastNotif.current.t > 8000)) {
      lastNotif.current = { key, t: now };
      showNavNotification(hazard ? `⚠ ${hazard.text}` : title, hazard ? `Əhməd: işıqforlu keçidə yönləndirirəm · ${body}` : body);
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
      eta,
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

  // split the route into traveled / remaining
  const traveledIdx = pointAt(plan.track, dist).index;
  const done = plan.track.pts.slice(0, traveledIdx).concat(pos);
  const rest = [pos, ...plan.track.pts.slice(traveledIdx)];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        customMapStyle={MAP_STYLE}
        initialCamera={{ center: pos, heading, pitch: 50, zoom: 17.5, altitude: 600 }}
        showsBuildings
        toolbarEnabled={false}
        showsCompass={false}
        scrollEnabled={false}
        mapPadding={{ top: 220, bottom: 140, left: 0, right: 0 }}
      >
        <Polyline coordinates={done} strokeColor="#B9B9BE" strokeWidth={7} lineCap="round" zIndex={4} />
        <Polyline coordinates={rest} strokeColor="rgba(255,98,3,0.22)" strokeWidth={18} lineCap="round" zIndex={5} />
        <Polyline coordinates={rest} strokeColor={C.brand} strokeWidth={8} lineCap="round" lineJoin="round" zIndex={6} />
        {d0 ? <DestPin latitude={d0.lat} longitude={d0.lon} icon={d0.icon} /> : null}
        <Marker coordinate={pos} anchor={{ x: 0.5, y: 0.5 }} flat tracksViewChanges={false} zIndex={30}>
          <View style={styles.me}>
            <Icon name="navigation" size={26} color="#fff" />
          </View>
        </Marker>
      </MapView>

      {/* maneuver card (widget style) */}
      <View style={[styles.topWrap, { top: insets.top + 8 }]}>
        <View style={styles.maneuver}>
          <View style={styles.timeline}>
            <View style={styles.tlDot} />
            <View style={styles.tlLine} />
            <View style={[styles.tlRing]}>
              <View style={styles.tlRingInner} />
            </View>
            <View style={styles.tlLine} />
            <View style={styles.tlDot} />
          </View>
          <View style={{ flex: 1, gap: 10 }}>
            <Txt w="semi" size={13.5} color={C.muted} numberOfLines={1}>
              {d0?.name} · çatış {eta}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name={stepInfo.icon} size={34} color={C.brand} />
              <View style={{ flex: 1 }}>
                <Txt w="black" size={26} lh={30}>
                  {fmtDist(toNext)}
                </Txt>
                <Txt w="bold" size={16} numberOfLines={1}>
                  {maneuverText}
                </Txt>
              </View>
            </View>
            <Txt w="semi" size={13.5} color={C.ink2} numberOfLines={1}>
              {street} · {Math.round(SPEED[mode] * 3.6)} km/s
            </Txt>
          </View>
          <CircleButton icon="cellphone-lock" size={44} bg={C.bg} onPress={() => router.push('/widget')} />
        </View>

        {hazard ? (
          <View style={styles.hazard}>
            <Icon name="alert-outline" size={26} color={C.warn} />
            <View style={{ flex: 1 }}>
              <Txt w="xbold" size={16}>
                {Math.round((hazard.atM - dist) / 10) * 10} m irəlidə {hazard.text.split(' · ')[0].toLowerCase()}
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <AhmedAvatar size={22} />
                <Txt w="med" size={13.5} color={C.ink2}>
                  Əhməd: işıqforlu keçidə yönləndirirəm
                </Txt>
              </View>
            </View>
          </View>
        ) : null}
      </View>

      {/* bottom */}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {arrived ? (
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.doneIcon}>
                <Icon name="check-bold" size={30} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Txt w="black" size={24}>
                  Çatdın!
                </Txt>
                <Txt w="med" size={14} color={C.muted}>
                  {d0?.name} · işıqforsuz keçid olmadı
                </Txt>
              </View>
              <ScoreRing score={score} size={64} />
            </View>
            <PillButton label="Bitir" onPress={() => router.dismissTo('/')} />
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Txt w="black" size={30}>
                  {remMin} dəq · {fmtDist(remainingM)}
                </Txt>
                <Txt w="semi" size={15} color={C.muted}>
                  Çatış {eta} · {mode === 'walk' ? 'piyada' : mode === 'metro' ? 'metroda' : mode === 'bus' ? 'avtobusda' : 'taksidə'}
                </Txt>
              </View>
              <ScoreRing score={score} size={70} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <PillButton
                label="Bitir"
                variant="outline"
                style={{ flex: 1, borderColor: C.danger }}
                onPress={() => {
                  clearNavNotification();
                  router.back();
                }}
              />
              <PillButton label="Widget" icon="cellphone-lock" variant="black" style={{ flex: 1 }} onPress={() => router.push('/widget')} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name="volume-high" size={16} color={C.muted} />
              <Txt w="med" size={13} color={C.muted}>
                Səsli bələdçi aktivdir · bildiriş panelində də görünür
              </Txt>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topWrap: { position: 'absolute', left: 14, right: 14, gap: 10 },
  maneuver: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 16,
    alignItems: 'center',
    ...shadow(3),
  },
  timeline: { alignItems: 'center', width: 18, alignSelf: 'stretch', justifyContent: 'center' },
  tlDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.brand },
  tlLine: { width: 2, flex: 1, minHeight: 12, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,98,3,0.5)' },
  tlRing: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,98,3,0.2)', alignItems: 'center', justifyContent: 'center' },
  tlRingInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  hazard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.warnSoft,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1.5,
    borderColor: C.warn,
  },
  me: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#fff',
    ...shadow(3),
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: R.card,
    borderTopRightRadius: R.card,
    padding: 20,
    ...shadow(3),
  },
  doneIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.safe, alignItems: 'center', justifyContent: 'center' },
});
