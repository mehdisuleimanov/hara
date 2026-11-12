import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAppStore, useIsNight } from '@/store/useAppStore';
import { CROSSING_TYPE, LAYER, nearestCrossing, visible } from '@/data/layer';
import { REPORT_META } from '@/data/reports-seed';
import { ROUTES } from '@/data/routes';
import { MAP_STYLE_FOR_TYPE, MAP_TYPE, mapTypeFor, useSatelliteType } from '@/components/mapStyle';
import { SafetyLayer } from '@/components/SafetyLayer';
import { IconPin, MeArrow } from '@/components/RouteLines';
import { ScoreRing } from '@/components/ScoreRing';
import { Icon, PillButton, Txt, tap } from '@/components/ui';
import { SlideUp } from '@/components/anim';
import { HourlyRisk } from '@/components/charts';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { haversine } from '@/utils/geo';
import { C, R, shadow } from '@/theme';

const START: Region = { latitude: 40.3795, longitude: 49.8455, latitudeDelta: 0.018, longitudeDelta: 0.018 };

type Sel = { kind: 'crossing'; idx: number } | { kind: 'report'; id: string } | null;

/** "You" = Waze-style 3D navigation arrow. */
function PersonPin({ latitude, longitude }: { latitude: number; longitude: number }) {
  return (
    <Marker coordinate={{ latitude, longitude }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={40}>
      <MeArrow size={44} heading={25} />
    </Marker>
  );
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const night = useIsNight();
  const setTimeMode = useAppStore((s) => s.setTimeMode);
  const reports = useAppStore((s) => s.reports);
  const voteReport = useAppStore((s) => s.voteReport);
  const addPoints = useAppStore((s) => s.addPoints);
  const [region, setRegion] = useState<Region>(START);
  const [sel, setSel] = useState<Sel>(null);
  const [showReports, setShowReports] = useState(true);
  const [onlySignals, setOnlySignals] = useState(false);
  const mapRef = useRef<MapView>(null);

  const vis = useMemo(() => {
    const v = visible(region, night);
    return onlySignals ? { ...v, cross: v.cross.filter((i) => LAYER.crossings[i][2] === 0) } : v;
  }, [region, night, onlySignals]);

  const selCrossing = sel?.kind === 'crossing' ? LAYER.crossings[sel.idx] : null;
  const selReport = sel?.kind === 'report' ? reports.find((r) => r.id === sel.id) : null;
  const nearReport = selCrossing ? reports.find((r) => haversine(r.lat, r.lon, selCrossing[0], selCrossing[1]) < 120) : null;

  const focusCrossing = (idx: number) => {
    const c = LAYER.crossings[idx];
    setSel({ kind: 'crossing', idx });
    mapRef.current?.animateToRegion({ latitude: c[0], longitude: c[1], latitudeDelta: 0.007, longitudeDelta: 0.007 }, 350);
  };
  const vote = (still: boolean) => {
    if (selReport) voteReport(selReport.id, still);
    addPoints(2, still ? 'təsdiq etdin' : 'yenilədin');
    setSel(null);
  };

  const CHIPS = [
    { key: 'risky', label: 'Riskli keçid', icon: 'alert-outline', tint: C.dangerSoft, color: C.danger, on: false, press: () => vis.cross[0] !== undefined && focusCrossing(vis.cross[0]) },
    { key: 'reports', label: 'Bildirişlər', icon: 'bullhorn-outline', tint: C.warnSoft, color: C.warn, on: showReports, press: () => setShowReports((v) => !v) },
    { key: 'night', label: night ? 'Gecə' : 'Gündüz', icon: night ? 'weather-night' : 'white-balance-sunny', tint: C.brandSoft, color: C.ink, on: night, press: () => setTimeMode(night ? 'day' : 'night') },
    { key: 'signals', label: 'İşıqfor', icon: 'traffic-light-outline', tint: C.safeSoft, color: C.safe, on: onlySignals, press: () => setOnlySignals((v) => !v) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        mapType={mapTypeFor(region.latitudeDelta)} customMapStyle={MAP_STYLE_FOR_TYPE}
        initialRegion={START}
        onRegionChangeComplete={setRegion}
        onPress={(e) => {
          if (vis.zoomedOut) return setSel(null);
          const { latitude, longitude } = e.nativeEvent.coordinate;
          const idx = nearestCrossing(latitude, longitude, vis.cross, 35 * (region.latitudeDelta / 0.01));
          setSel(idx >= 0 ? { kind: 'crossing', idx } : null);
          if (idx >= 0) tap();
        }}
        toolbarEnabled={false}
        showsCompass={false}
        mapPadding={{ top: insets.top + 130, bottom: TAB_BAR_SPACE, left: 0, right: 0 }}
      >
        <SafetyLayer
          segs={vis.segs}
          cross={vis.cross}
          heat={vis.heat}
          night={night}
          zoomedOut={vis.zoomedOut}
          selected={sel?.kind === 'crossing' ? sel.idx : undefined}
        />
        {showReports
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
        <PersonPin latitude={ROUTES.origin.lat} longitude={ROUTES.origin.lon} />
      </MapView>

      {/* reference: search bar with mic */}
      <View style={[styles.topWrap, { top: insets.top + 10 }]} pointerEvents="box-none">
        <Pressable
          accessibilityRole="search"
          accessibilityLabel="Hara gedirsən? Axtar"
          onPress={() => router.push('/ahmed?mode=text')}
          style={styles.search}
        >
          <Icon name="magnify" size={26} />
          <Txt w="med" size={17} color={C.muted} style={{ flex: 1 }}>
            Hara gedirsən?
          </Txt>
          <Pressable accessibilityRole="button" accessibilityLabel="Əhmədə səslə de" hitSlop={10} onPress={() => router.push('/ahmed')}>
            <Icon name="microphone-outline" size={26} />
          </Pressable>
        </Pressable>

        {/* reference: category chips with tinted icon squares */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 4 }}>
          {CHIPS.map((c) => (
            <Pressable
              key={c.key}
              accessibilityRole="button"
              accessibilityState={{ selected: c.on }}
              onPress={() => {
                tap();
                c.press();
              }}
              style={[styles.chip, c.on && { borderColor: C.route }]}
            >
              <View style={[styles.chipIcon, { backgroundColor: c.tint }]}>
                <Icon name={c.icon} size={22} color={c.color} />
              </View>
              <Txt w="semi" size={15}>
                {c.label}
              </Txt>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* legend (compact) */}
      {!sel ? (
        <View style={[styles.legend, { bottom: TAB_BAR_SPACE + 10 }]}>
          {[
            { n: vis.counts.safe, color: C.safe, label: 'az riskli' },
            { n: vis.counts.mid, color: C.warn, label: 'orta' },
            { n: vis.counts.risky, color: C.danger, label: 'riskli' },
          ].map((x) => (
            <View key={x.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: x.color }} />
              <Txt w="bold" size={13}>
                {x.n}
              </Txt>
              <Txt w="med" size={12.5} color={C.muted}>
                {x.label}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}

      {/* reference: dark-glass locate button bottom-right */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mənim yerim"
        onPress={() => {
          tap();
          setSel(null);
          mapRef.current?.animateToRegion(START, 400);
        }}
        style={[styles.locate, { bottom: TAB_BAR_SPACE + (sel ? (selCrossing ? 290 : 196) : 8) }]}
      >
        <Icon name="navigation-variant-outline" size={26} color={C.ink} />
      </Pressable>

      {/* selection card */}
      {selCrossing || selReport ? (
        <SlideUp key={JSON.stringify(sel)} distance={70} style={[styles.card, { bottom: TAB_BAR_SPACE + 4 }]}>
          {selCrossing ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Txt w="black" size={19}>
                  {CROSSING_TYPE[selCrossing[2]]}
                </Txt>
                <Txt w="med" size={13.5} color={C.ink2} style={{ marginTop: 4 }}>
                  {[selCrossing[5] ? `${selCrossing[5]} zolaq` : 'Yerin altında', night && selCrossing[4] < 55 ? 'zəif işıqlandırma' : null].filter(Boolean).join(' · ')}
                </Txt>
                <Txt w="med" size={12.5} color={C.muted} style={{ marginTop: 4 }}>
                  {nearReport ? `AI təsdiqlədi · ${nearReport.count} bildiriş · ${nearReport.minutesAgo} dəq əvvəl` : 'OSM datası · prototip bal'}
                </Txt>
              </View>
              <ScoreRing score={night ? selCrossing[4] : selCrossing[3]} size={66} />
            </View>
          ) : null}
          {selCrossing ? (
            <View style={{ marginTop: 12 }}>
              <Txt w="semi" size={12.5} color={C.muted} style={{ marginBottom: 6 }}>
                Risk saatlara görə
              </Txt>
              <HourlyRisk day={selCrossing[3]} night={selCrossing[4]} />
            </View>
          ) : selReport ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.reportIcon, { backgroundColor: REPORT_META[selReport.category].tone === 'danger' ? C.dangerSoft : C.warnSoft }]}>
                <Icon name={REPORT_META[selReport.category].icon} size={24} color={REPORT_META[selReport.category].tone === 'danger' ? C.danger : C.warn} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt w="black" size={19}>
                  {REPORT_META[selReport.category].title}
                </Txt>
                <Txt w="med" size={13} color={C.muted} style={{ marginTop: 4 }}>
                  AI təsdiqlədi {selReport.aiConfidence}% · {selReport.count} bildiriş · {selReport.minutesAgo} dəq əvvəl
                </Txt>
              </View>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <PillButton label="Hələ də var" height={50} variant="black" style={{ flex: 1 }} onPress={() => vote(true)} />
            <PillButton label="Artıq yoxdur" height={50} variant="outline" style={{ flex: 1 }} onPress={() => vote(false)} />
          </View>
        </SlideUp>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topWrap: { position: 'absolute', left: 16, right: 16, gap: 10 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 62,
    borderRadius: 20,
    backgroundColor: C.surface,
    paddingHorizontal: 18,
    ...shadow(2),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    borderRadius: 16,
    backgroundColor: C.surface,
    paddingLeft: 6,
    paddingRight: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...shadow(1),
  },
  chipIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  personHalo: { width: 82, height: 82, borderRadius: 41, backgroundColor: 'rgba(18,183,106,0.30)', alignItems: 'center', justifyContent: 'center' },
  legend: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: R.pill,
    paddingHorizontal: 14,
    height: 40,
    alignItems: 'center',
    ...shadow(1),
  },
  locate: {
    position: 'absolute',
    right: 16,
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { position: 'absolute', left: 14, right: 14, backgroundColor: C.surface, borderRadius: 26, padding: 18, ...shadow(3) },
  reportIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
