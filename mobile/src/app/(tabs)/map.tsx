import React, { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore, useIsNight } from '@/store/useAppStore';
import { CROSSING_TYPE, LAYER, nearestCrossing, visible } from '@/data/layer';
import { REPORT_META } from '@/data/reports-seed';
import { ROUTES } from '@/data/routes';
import { MAP_STYLE } from '@/components/mapStyle';
import { SafetyLayer } from '@/components/SafetyLayer';
import { IconPin, OriginPin } from '@/components/RouteLines';
import { ScoreRing } from '@/components/ScoreRing';
import { CircleButton, Icon, PillButton, Txt, tap } from '@/components/ui';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { haversine } from '@/utils/geo';
import { C, R, scoreColor, shadow } from '@/theme';

const START: Region = { latitude: 40.3795, longitude: 49.8455, latitudeDelta: 0.022, longitudeDelta: 0.022 };

type Sel = { kind: 'crossing'; idx: number } | { kind: 'report'; id: string } | null;

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const night = useIsNight();
  const setTimeMode = useAppStore((s) => s.setTimeMode);
  const reports = useAppStore((s) => s.reports);
  const voteReport = useAppStore((s) => s.voteReport);
  const addPoints = useAppStore((s) => s.addPoints);
  const [region, setRegion] = useState<Region>(START);
  const [sel, setSel] = useState<Sel>(null);
  const mapRef = useRef<MapView>(null);

  const vis = useMemo(() => visible(region, night), [region, night]);

  const selCrossing = sel?.kind === 'crossing' ? LAYER.crossings[sel.idx] : null;
  const selReport = sel?.kind === 'report' ? reports.find((r) => r.id === sel.id) : null;
  // reports near a selected crossing (for "AI təsdiqlədi · 7 bildiriş")
  const nearReport = selCrossing
    ? reports.find((r) => haversine(r.lat, r.lon, selCrossing[0], selCrossing[1]) < 120)
    : null;

  const zoom = (f: number) => {
    const r = { ...region, latitudeDelta: region.latitudeDelta * f, longitudeDelta: region.longitudeDelta * f };
    mapRef.current?.animateToRegion(r, 250);
  };

  const vote = (still: boolean) => {
    if (selReport) voteReport(selReport.id, still);
    addPoints(2, still ? 'təsdiq etdin' : 'yenilədin');
    setSel(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        customMapStyle={MAP_STYLE}
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
        mapPadding={{ top: 0, bottom: TAB_BAR_SPACE, left: 0, right: 0 }}
      >
        <SafetyLayer
          segs={vis.segs}
          cross={vis.cross}
          heat={vis.heat}
          night={night}
          zoomedOut={vis.zoomedOut}
          selected={sel?.kind === 'crossing' ? sel.idx : undefined}
        />
        {reports.map((r) => {
          const m = REPORT_META[r.category];
          return (
            <IconPin
              key={r.id}
              latitude={r.lat}
              longitude={r.lon}
              icon={m.icon}
              bg={m.tone === 'danger' ? C.danger : C.warn}
              color="#fff"
              badge={r.count > 1 ? r.count : undefined}
              onPress={() => {
                tap();
                setSel({ kind: 'report', id: r.id });
              }}
            />
          );
        })}
        <OriginPin latitude={ROUTES.origin.lat} longitude={ROUTES.origin.lon} />
      </MapView>

      {/* header */}
      <View style={[styles.header, { top: insets.top + 8 }]} pointerEvents="box-none">
        <View style={[styles.titlePill, shadow(2)]}>
          <Icon name="shield-check-outline" size={20} color={C.brand} />
          <Txt w="xbold" size={16}>
            Bakı Təhlükəsizlik Qatı
          </Txt>
        </View>
        <View style={[styles.segment, shadow(2)]}>
          {(['day', 'night'] as const).map((m) => {
            const on = (m === 'night') === night;
            return (
              <Pressable
                key={m}
                onPress={() => {
                  tap();
                  setTimeMode(m);
                }}
                style={[styles.segItem, on && { backgroundColor: C.black }]}
              >
                <Icon name={m === 'day' ? 'white-balance-sunny' : 'weather-night'} size={18} color={on ? '#fff' : C.ink} />
                <Txt w="semi" size={14.5} color={on ? '#fff' : C.ink}>
                  {m === 'day' ? 'Gündüz' : 'Gecə'}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* right controls */}
      <View style={[styles.side, { top: insets.top + 130 }]}>
        <CircleButton icon="plus" size={50} onPress={() => zoom(0.5)} style={shadow(2)} />
        <CircleButton icon="minus" size={50} onPress={() => zoom(2)} style={shadow(2)} />
        <CircleButton icon="crosshairs-gps" size={50} onPress={() => mapRef.current?.animateToRegion(START, 400)} style={shadow(2)} />
      </View>

      {/* bottom card */}
      <View style={[styles.bottom, { bottom: TAB_BAR_SPACE - 4 }]}>
        {selCrossing ? (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon
                    name={selCrossing[2] === 0 ? 'traffic-light' : selCrossing[2] === 3 ? 'stairs-down' : 'alert-outline'}
                    size={22}
                    color={scoreColor(night ? selCrossing[4] : selCrossing[3])}
                  />
                  <Txt w="xbold" size={19} color="#fff">
                    {CROSSING_TYPE[selCrossing[2]]}
                  </Txt>
                </View>
                <Txt w="med" size={14} color="rgba(255,255,255,0.75)" style={{ marginTop: 6 }}>
                  {[
                    selCrossing[5] ? `${selCrossing[5]} zolaq` : 'Yerin altında',
                    night && selCrossing[4] < 55 ? 'Zəif işıqlandırma' : null,
                    selCrossing[2] === 3 ? 'Pilləkən · lift yoxlanılmalı' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Txt>
                <Txt w="med" size={12.5} color="rgba(255,255,255,0.5)" style={{ marginTop: 4 }}>
                  {nearReport ? `AI təsdiqlədi · ${nearReport.count} bildiriş · ${nearReport.minutesAgo} dəq əvvəl` : 'OSM datası · prototip bal'}
                </Txt>
              </View>
              <ScoreRing score={night ? selCrossing[4] : selCrossing[3]} size={72} dark />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <PillButton label="Hələ də var" height={50} style={{ flex: 1 }} onPress={() => vote(true)} />
              <PillButton label="Artıq yoxdur" height={50} variant="white" style={{ flex: 1 }} onPress={() => vote(false)} />
            </View>
          </View>
        ) : selReport ? (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.reportIcon, { backgroundColor: REPORT_META[selReport.category].tone === 'danger' ? C.danger : C.warn }]}>
                <Icon name={REPORT_META[selReport.category].icon} size={24} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Txt w="xbold" size={19} color="#fff">
                  {REPORT_META[selReport.category].title}
                </Txt>
                <Txt w="med" size={13} color="rgba(255,255,255,0.65)" style={{ marginTop: 4 }}>
                  AI təsdiqlədi {selReport.aiConfidence}% · {selReport.count} bildiriş · {selReport.minutesAgo} dəq əvvəl
                </Txt>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <PillButton label="Hələ də var" height={50} style={{ flex: 1 }} onPress={() => vote(true)} />
              <PillButton label="Artıq yoxdur" height={50} variant="white" style={{ flex: 1 }} onPress={() => vote(false)} />
            </View>
          </View>
        ) : (
          <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
            {[
              { label: 'Az riskli', n: vis.counts.safe, color: C.safe },
              { label: 'Orta', n: vis.counts.mid, color: C.warn },
              { label: 'Riskli', n: vis.counts.risky, color: C.danger },
            ].map((x) => (
              <View key={x.label} style={{ alignItems: 'center', flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: x.color }} />
                  <Txt w="xbold" size={20} color="#fff">
                    {x.n}
                  </Txt>
                </View>
                <Txt w="med" size={12.5} color="rgba(255,255,255,0.6)">
                  {x.label} keçid
                </Txt>
              </View>
            ))}
            <View style={styles.vline} />
            <View style={{ alignItems: 'center', flex: 1.1 }}>
              <Txt w="semi" size={12} color="rgba(255,255,255,0.6)" center>
                {vis.zoomedOut ? 'Yaxınlaşdır →\nkeçidlərə bax' : 'Keçidə toxun'}
              </Txt>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { position: 'absolute', left: 16, right: 16, alignItems: 'center', gap: 10 },
  titlePill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', height: 50, paddingHorizontal: 20, borderRadius: R.pill },
  segment: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: R.pill, padding: 5, gap: 4 },
  segItem: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingHorizontal: 18, borderRadius: R.pill },
  side: { position: 'absolute', right: 14, gap: 10 },
  bottom: { position: 'absolute', left: 14, right: 14 },
  card: { backgroundColor: C.black, borderRadius: 28, padding: 18, ...shadow(3) },
  reportIcon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  vline: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 6 },
});
