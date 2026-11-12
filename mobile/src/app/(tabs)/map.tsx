import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { SnapMarker } from '@/features/map/SnapMarker';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppStore, useIsNight } from '@/store/useAppStore';
import { CROSSING_TYPE, LAYER, nearestCrossing, visible } from '@/data/layer';
import { REPORT_META } from '@/data/reports-seed';
import { ROUTES } from '@/data/routes';
import { useMapLook } from '@/components/mapStyle';
import { SafetyLayer } from '@/components/SafetyLayer';
import { IconPin, MeArrow, PinView } from '@/components/RouteLines';
import { ScoreRing } from '@/components/ScoreRing';
import { Icon, Txt, tap } from '@/components/ui';
import { Pop, Pulse } from '@/components/anim';
import { HourlyRisk } from '@/components/charts';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { PressableScale } from '@/motion/PressableScale';
import { Anchored, useMapOverlay } from '@/features/map/overlay';
import { MapControls, NightVeil } from '@/features/map/MapControls';
import { haversine } from '@/utils/geo';
import { C, R, shadow } from '@/theme';

const START: Region = { latitude: 40.3795, longitude: 49.8455, latitudeDelta: 0.018, longitudeDelta: 0.018 };
const ME = { latitude: ROUTES.origin.lat, longitude: ROUTES.origin.lon };

type Sel = { kind: 'crossing'; idx: number } | { kind: 'report'; id: string } | null;

const TYPE_ICON = ['traffic-light', 'zebra', 'help-rhombus-outline', 'stairs-down'];

function Attr({ icon, label, value, tone }: { icon: string; label: string; value: string; tone?: 'safe' | 'warn' | 'danger' }) {
  const fg = tone === 'danger' ? C.danger : tone === 'warn' ? '#8A5A00' : tone === 'safe' ? C.brandDark : C.ink;
  return (
    <View style={styles.attr}>
      <Icon name={icon} size={18} color={fg} />
      <Txt w="bold" size={14} color={fg} numberOfLines={1} style={{ marginTop: 4 }}>
        {value}
      </Txt>
      <Txt w="med" size={11.5} color={C.muted}>
        {label}
      </Txt>
    </View>
  );
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const night = useIsNight();
  const reports = useAppStore((s) => s.reports);
  const voteReport = useAppStore((s) => s.voteReport);
  const addPoints = useAppStore((s) => s.addPoints);
  const [region, setRegion] = useState<Region>(START);
  const [sel, setSel] = useState<Sel>(null);
  const [showReports, setShowReports] = useState(true);
  const [onlySignals, setOnlySignals] = useState(false);
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [pinsLanded, setPinsLanded] = useState(Platform.OS === 'web');
  const [ghosts, setGhosts] = useState(false);
  const mapRef = useRef<MapView>(null);
  const overlay = useMapOverlay(mapRef);
  const look = useMapLook({ night });

  // safety layer builds up: streets, then crossings; report pins pop in one by one
  useEffect(() => {
    const a = setTimeout(() => setStage(1), 180);
    const b = setTimeout(() => setStage(2), 520);
    const c = setTimeout(() => setGhosts(true), 700);
    return () => [a, b, c].forEach(clearTimeout);
  }, []);
  const ghostReports = useMemo(() => {
    const s = region.latitude - region.latitudeDelta / 2, n = region.latitude + region.latitudeDelta / 2;
    const w = region.longitude - region.longitudeDelta / 2, e = region.longitude + region.longitudeDelta / 2;
    return reports.filter((r) => r.lat > s && r.lat < n && r.lon > w && r.lon < e).slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports]);
  useEffect(() => {
    if (!ghosts || pinsLanded) return;
    const t = setTimeout(() => setPinsLanded(true), 520 + ghostReports.length * 90);
    return () => clearTimeout(t);
  }, [ghosts, pinsLanded, ghostReports.length]);

  const vis = useMemo(() => {
    const v = visible(region, night);
    return onlySignals ? { ...v, cross: v.cross.filter((i) => LAYER.crossings[i][2] === 0) } : v;
  }, [region, night, onlySignals]);
  const mpp = (region.latitudeDelta * 111000) / Math.max(400, winH - 120);

  const selCrossing = sel?.kind === 'crossing' ? LAYER.crossings[sel.idx] : null;
  const selReport = sel?.kind === 'report' ? reports.find((r) => r.id === sel.id) : null;
  const nearReport = selCrossing ? reports.find((r) => haversine(r.lat, r.lon, selCrossing[0], selCrossing[1]) < 120) : null;

  const focusCrossing = (idx: number) => {
    const c = LAYER.crossings[idx];
    setSel({ kind: 'crossing', idx });
    mapRef.current?.animateToRegion({ latitude: c[0] - 0.0012, longitude: c[1], latitudeDelta: 0.006, longitudeDelta: 0.006 }, 450);
  };
  const vote = (still: boolean) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (selReport) voteReport(selReport.id, still);
    addPoints(2, still ? 'təsdiq etdin' : 'yenilədin');
    setSel(null);
  };
  const riskiest = () => {
    if (!vis.cross.length) return;
    const night_ = night ? 4 : 3;
    const idx = [...vis.cross].sort((a, b) => LAYER.crossings[a][night_] - LAYER.crossings[b][night_])[0];
    focusCrossing(idx);
  };

  const CHIPS = [
    { key: 'risky', label: 'Riskli keçid', icon: 'alert-outline', tint: C.dangerSoft, color: C.danger, on: false, press: riskiest },
    { key: 'reports', label: 'Bildirişlər', icon: 'bullhorn-outline', tint: C.warnSoft, color: '#B26B00', on: showReports, press: () => setShowReports((v) => !v) },
    { key: 'signals', label: 'İşıqforlu', icon: 'traffic-light-outline', tint: C.safeSoft, color: C.brandDark, on: onlySignals, press: () => setOnlySignals((v) => !v) },
  ];

  const cardBottom = TAB_BAR_SPACE + 4;
  const lit = selCrossing ? selCrossing[3] - selCrossing[4] <= 5 : true;
  const cScore = selCrossing ? (night ? selCrossing[4] : selCrossing[3]) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: night ? '#17223A' : C.bg }}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        mapType={look.mapType}
        customMapStyle={look.customMapStyle}
        initialRegion={START}
        onRegionChange={overlay.onRegionChange}
        onRegionChangeComplete={(r) => {
          setRegion(r);
          overlay.onRegionChangeComplete();
        }}
        onMapReady={() => setTimeout(overlay.refresh, 400)}
        onPress={(e) => {
          if (vis.zoomedOut) return setSel(null);
          const { latitude, longitude } = e.nativeEvent.coordinate;
          const idx = nearestCrossing(latitude, longitude, vis.cross, Math.max(25, mpp * 22));
          if (idx >= 0) {
            tap();
            focusCrossing(idx);
          } else setSel(null);
        }}
        toolbarEnabled={false}
        showsCompass={false}
        rotateEnabled={false}
        mapPadding={{ top: insets.top + 130, bottom: TAB_BAR_SPACE, left: 0, right: 0 }}
      >
        <SafetyLayer
          segs={vis.segs}
          cross={vis.cross}
          heat={vis.heat}
          night={night}
          zoomedOut={vis.zoomedOut}
          selected={sel?.kind === 'crossing' ? sel.idx : undefined}
          dark={look.satellite}
          mpp={mpp}
          stage={stage}
        />
        {showReports && pinsLanded
          ? reports.map((r) => {
              const m = REPORT_META[r.category];
              return (
                <IconPin
                  key={r.id}
                  latitude={r.lat}
                  longitude={r.lon}
                  icon={m.icon}
                  bg={m.tone === 'danger' ? C.danger : C.warn}
                  badge={r.count > 1 ? r.count : undefined}
                  onPress={() => {
                    tap();
                    setSel({ kind: 'report', id: r.id });
                  }}
                />
              );
            })
          : null}
        <SnapMarker coordinate={ME} anchor={{ x: 0.5, y: 0.5 }} zIndex={40}>
          <MeArrow size={40} heading={25} />
        </SnapMarker>
      </MapView>

      {/* overlays: "you" pulse + report pins popping in (native) */}
      <Anchored api={overlay} coordinate={ME} anchor={{ x: 0.5, y: 0.5 }}>
        <View style={{ width: 84, height: 84 }}>
          <Pulse size={84} color={C.brand} duration={2200} />
        </View>
      </Anchored>
      {showReports && ghosts && !pinsLanded
        ? ghostReports.map((r, i) => {
            const m = REPORT_META[r.category];
            return (
              <Anchored key={`g${r.id}`} api={overlay} coordinate={{ latitude: r.lat, longitude: r.lon }} anchor={{ x: 0.5, y: 1 }}>
                <Pop delay={i * 90}>
                  <View style={{ padding: 6 }}>
                    <PinView icon={m.icon} iconColor={m.tone === 'danger' ? C.danger : C.warn} size={42} badge={r.count > 1 ? r.count : undefined} />
                  </View>
                </Pop>
              </Anchored>
            );
          })
        : null}

      <NightVeil night={night} />

      {/* search + filters */}
      <Animated.View entering={FadeInDown.springify().damping(18)} style={[styles.topWrap, { top: insets.top + 10 }]} pointerEvents="box-none">
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <PressableScale accessibilityRole="search" accessibilityLabel="Hara gedirsən? Əhmədə de" onPress={() => router.push('/ahmed?mode=text')} style={styles.search}>
            <Icon name="magnify" size={24} />
            <Txt w="med" size={16.5} color={C.muted} style={{ flex: 1 }} numberOfLines={1}>
              Hara gedirsən?
            </Txt>
            <Pressable accessibilityRole="button" accessibilityLabel="Əhmədə səslə de" hitSlop={10} onPress={() => router.push('/ahmed')} style={styles.mic}>
              <Icon name="microphone" size={20} color="#FFFFFF" />
            </Pressable>
          </PressableScale>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 4 }}>
          {CHIPS.map((c, i) => (
            <Animated.View key={c.key} entering={FadeInDown.delay(120 + i * 60).springify().damping(18)}>
              <PressableScale
                accessibilityRole="button"
                accessibilityState={{ selected: c.on }}
                onPress={() => {
                  tap();
                  c.press();
                }}
                style={[styles.chip, c.on && { borderColor: C.route, backgroundColor: '#F2F7FF' }]}
              >
                <View style={[styles.chipIcon, { backgroundColor: c.tint }]}>
                  <Icon name={c.icon} size={19} color={c.color} />
                </View>
                <Txt w="semi" size={14}>
                  {c.label}
                </Txt>
              </PressableScale>
            </Animated.View>
          ))}
        </ScrollView>
      </Animated.View>

      {/* right controls */}
      <Animated.View entering={FadeIn.delay(250).duration(300)} style={[styles.controls, { top: insets.top + 132 }]}>
        <MapControls
          onLocate={() => {
            tap();
            setSel(null);
            mapRef.current?.animateToRegion(START, 450);
          }}
        />
      </Animated.View>

      {/* legend pills */}
      {!sel ? (
        <Animated.View entering={FadeInUp.delay(400).springify().damping(18)} exiting={FadeOut.duration(150)} style={[styles.legend, { bottom: TAB_BAR_SPACE + 10 }]}>
          {[
            { n: vis.counts.safe, color: C.safe, label: 'az riskli' },
            { n: vis.counts.mid, color: C.warn, label: 'orta' },
            { n: vis.counts.risky, color: C.danger, label: 'riskli' },
          ].map((x) => (
            <View key={x.label} style={styles.legendPill}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: x.color, borderWidth: 1.5, borderColor: '#FFFFFF' }} />
              <Txt w="bold" size={13} style={{ fontVariant: ['tabular-nums'] }}>
                {x.n}
              </Txt>
              <Txt w="med" size={12.5} color={C.muted}>
                {x.label}
              </Txt>
            </View>
          ))}
        </Animated.View>
      ) : null}

      {/* selection card */}
      {selCrossing || selReport ? (
        <Animated.View
          key={JSON.stringify(sel)}
          entering={FadeInDown.springify().damping(19).stiffness(180)}
          exiting={FadeOut.duration(140)}
          layout={LinearTransition}
          style={[styles.card, { bottom: cardBottom }]}
        >
          {selCrossing ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Txt v="overline" color={C.muted}>
                    Təhlükəsizlik qatı · {night ? 'gecə' : 'gündüz'}
                  </Txt>
                  <Txt v="h3" style={{ marginTop: 3 }}>
                    {CROSSING_TYPE[selCrossing[2]]}
                  </Txt>
                  <Txt w="med" size={12.5} color={C.muted} style={{ marginTop: 3 }} numberOfLines={1}>
                    {nearReport ? `${nearReport.count} bildiriş · ${nearReport.minutesAgo} dəq əvvəl` : 'OpenStreetMap atributları əsasında'}
                  </Txt>
                </View>
                <ScoreRing key={`${sel?.kind === 'crossing' ? sel.idx : ''}`} score={cScore} size={68} />
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <Attr icon={TYPE_ICON[selCrossing[2]] ?? 'help'} label="növ" value={selCrossing[2] === 0 ? 'İşıqfor' : selCrossing[2] === 1 ? 'Zebra' : selCrossing[2] === 3 ? 'Yeraltı' : 'Nişansız'} tone={selCrossing[2] === 0 || selCrossing[2] === 3 ? 'safe' : 'danger'} />
                <Attr icon="road-variant" label="zolaq" value={selCrossing[5] ? `${selCrossing[5]}` : '—'} tone={selCrossing[5] >= 4 ? 'warn' : undefined} />
                <Attr icon={lit ? 'lightbulb-on-outline' : 'lightbulb-off-outline'} label="gecə işığı" value={lit ? 'İşıqlı' : 'Zəif'} tone={lit ? 'safe' : 'warn'} />
              </View>
              <View style={{ marginTop: 12 }}>
                <Txt w="semi" size={12.5} color={C.muted} style={{ marginBottom: 6 }}>
                  Risk saatlara görə
                </Txt>
                <HourlyRisk day={selCrossing[3]} night={selCrossing[4]} />
              </View>
            </>
          ) : selReport ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.reportIcon, { backgroundColor: REPORT_META[selReport.category].tone === 'danger' ? C.dangerSoft : C.warnSoft }]}>
                <Icon name={REPORT_META[selReport.category].icon} size={24} color={REPORT_META[selReport.category].tone === 'danger' ? C.danger : C.warn} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="h3">{REPORT_META[selReport.category].title}</Txt>
                <Txt w="med" size={13} color={C.muted} style={{ marginTop: 4 }}>
                  AI təsdiqlədi {selReport.aiConfidence}% · {selReport.count} bildiriş · {selReport.minutesAgo} dəq əvvəl
                </Txt>
              </View>
            </View>
          ) : null}
          <Txt w="bold" size={14} style={{ marginTop: 14 }}>
            Hələ də belədir?
          </Txt>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <PressableScale accessibilityRole="button" haptic="medium" onPress={() => vote(true)} style={[styles.vote, { backgroundColor: C.navy }]}>
              <Icon name="check" size={19} color="#FFFFFF" />
              <Txt w="bold" size={15} color="#FFFFFF">
                Bəli, var
              </Txt>
            </PressableScale>
            <PressableScale accessibilityRole="button" haptic="medium" onPress={() => vote(false)} style={[styles.vote, { backgroundColor: C.bg2 }]}>
              <Icon name="close" size={19} color={C.ink} />
              <Txt w="bold" size={15}>
                Artıq yoxdur
              </Txt>
            </PressableScale>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topWrap: { position: 'absolute', left: 16, right: 16, gap: 10 },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 58,
    borderRadius: 20,
    backgroundColor: C.bg,
    paddingLeft: 16,
    paddingRight: 8,
    ...shadow(2),
  },
  mic: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.ai, alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    borderRadius: 16,
    backgroundColor: C.bg,
    paddingLeft: 5,
    paddingRight: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...shadow(1),
  },
  chipIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  controls: { position: 'absolute', right: 14 },
  legend: { position: 'absolute', left: 14, flexDirection: 'row', gap: 6 },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 36,
    paddingHorizontal: 11,
    borderRadius: R.pill,
    backgroundColor: 'rgba(255,255,255,0.96)',
    ...shadow(1),
  },
  card: { position: 'absolute', left: 12, right: 12, backgroundColor: C.bg, borderRadius: 26, padding: 18, ...shadow(3) },
  attr: { flex: 1, alignItems: 'center', backgroundColor: C.surface, borderRadius: R.md, paddingVertical: 10 },
  reportIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  vote: { flex: 1, height: 50, borderRadius: R.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
