import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import {
  accessBarriers,
  ATTRACTOR_KIND,
  cityKpis,
  CROSSING_LABEL,
  primeCity,
  topRisks,
  type Barrier,
  type Mode,
  type RiskSpot,
} from '@/data/city';
import OSM from './osm-city.json';
import { CircleButton, Icon, Segmented, Surface, Tag, Txt, tap } from '@/components/ui';
import { Donut } from '@/components/charts';
import { AnimatedNumber, enter, PressableScale, Skeleton } from '@/motion';
import { C, R, scoreColor, scoreSoft } from '@/theme';
import { CityMap, type CityMapHandle, type MapLayer } from './CityMap';
import { useScanStore } from '@/store/scan';

const fmt = (n: number, d = 0) => (d ? n.toFixed(d).replace('.', ',') : Math.round(n).toLocaleString('en-US').replace(/,/g, ' '));

function KpiTile({ icon, tint, color, value, decimals = 0, suffix = '', label, caption, i }: { icon: string; tint: string; color: string; value: number; decimals?: number; suffix?: string; label: string; caption: string; i: number }) {
  return (
    <Animated.View entering={enter(i, 'up', 80)} style={{ flexBasis: '47%', flexGrow: 1 }}>
      <Surface style={{ borderRadius: R.lg, padding: 14, gap: 8, minHeight: 148 }}>
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={20} color={color} />
        </View>
        <AnimatedNumber value={value} decimals={decimals} suffix={suffix} v="num" size={26} color={C.ink} />
        <Txt w="semi" size={13} color={C.ink} lh={17}>
          {label}
        </Txt>
        <Txt v="caption" color={C.muted} numberOfLines={2}>
          {caption}
        </Txt>
      </Surface>
    </Animated.View>
  );
}

function KpiSkeleton() {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {[0, 1, 2, 3].map((k) => (
        <View key={k} style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: C.surface, borderRadius: R.lg, padding: 14, gap: 10, minHeight: 148 }}>
          <Skeleton width={36} height={36} radius={12} />
          <Skeleton width="60%" height={24} />
          <Skeleton width="85%" height={12} />
          <Skeleton width="50%" height={10} />
        </View>
      ))}
    </View>
  );
}

function SectionTitle({ over, title, right }: { over?: string; title: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8 }}>
      <View style={{ flex: 1, gap: 2 }}>
        {over ? (
          <Txt v="overline" color={C.muted}>
            {over}
          </Txt>
        ) : null}
        <Txt v="h3">{title}</Txt>
      </View>
      {right}
    </View>
  );
}

function RiskRow({ s, rank, selected, onPress, i }: { s: RiskSpot; rank: number; selected: boolean; onPress: () => void; i: number }) {
  const col = scoreColor(s.score);
  return (
    <Animated.View entering={enter(i, 'up', 60)}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${rank}. ${s.name}, bal ${s.score}`}
        onPress={onPress}
        scaleTo={0.98}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 12,
          borderRadius: 20,
          backgroundColor: selected ? C.purpleSoft : C.surface,
          borderWidth: 1.5,
          borderColor: selected ? C.route : 'transparent',
        }}
      >
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: selected ? C.route : C.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Txt w="xbold" size={13} color={selected ? '#FFFFFF' : C.ink}>
            {rank}
          </Txt>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt w="bold" size={15} numberOfLines={1}>
            {s.name}
          </Txt>
          <Txt v="caption" color={C.muted} numberOfLines={1}>
            {CROSSING_LABEL[s.type]} · {s.lanes} zolaq{s.stops ? ` · ${s.stops} dayanacaq yaxında` : ''}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Icon name="lightbulb-on-outline" size={13} color={C.brandDark} />
            <Txt w="semi" size={12} color={C.brandDark} numberOfLines={1} style={{ flex: 1 }}>
              {s.rec.title}
            </Txt>
          </View>
        </View>
        <View style={{ minWidth: 46, height: 34, paddingHorizontal: 8, borderRadius: 17, backgroundColor: scoreSoft(s.score), alignItems: 'center', justifyContent: 'center' }}>
          <Txt w="xbold" size={15} color={col} style={{ fontVariant: ['tabular-nums'] }}>
            {s.score}
          </Txt>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

function SpotDetail({ s, mode }: { s: RiskSpot; mode: Mode }) {
  const demandLabel = s.demand >= 0.66 ? 'yüksək' : s.demand >= 0.33 ? 'orta' : 'aşağı';
  return (
    <Animated.View key={`${mode}-${s.idx}`} entering={FadeIn.duration(260)} style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt w="bold" size={16.5} numberOfLines={1}>
            {s.name}
          </Txt>
          <Txt v="caption" color={C.muted}>
            {s.lat.toFixed(5)}, {s.lon.toFixed(5)} · OSM keçidi
          </Txt>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Txt v="num" size={26} color={scoreColor(s.score)}>
            {s.score}
          </Txt>
          <Txt v="caption" color={C.muted}>
            {mode === 'night' ? 'gecə balı' : 'gündüz balı'}
          </Txt>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {s.factors.map((f) => (
          <Tag key={f} label={f} bg={C.bg} />
        ))}
        <Tag label={`Gündüz ${s.day} · Gecə ${s.night}`} icon="weather-night" bg={C.bg} />
        <Tag label={`Təxmini axın: ${demandLabel}`} icon="account-group-outline" bg={C.aiSoft} color={C.ai} />
        {s.metro ? <Tag label={`${s.metro} metro girişi yaxında`} icon="subway-variant" bg={C.bg} /> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 18, backgroundColor: C.brandSofter, borderWidth: 1, borderColor: C.brandSoft }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={s.rec.icon} size={20} color={C.brandDark} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Txt v="overline" color={C.brandDark}>
            Tövsiyə
          </Txt>
          <Txt w="bold" size={15}>
            {s.rec.title}
          </Txt>
          <Txt v="bodyS" color={C.ink2}>
            {s.rec.body}
          </Txt>
        </View>
      </View>
    </Animated.View>
  );
}

export function CityScreen() {
  const insets = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>('night');
  const contributions = useScanStore((s) => s.history.filter((h) => h.contributed).length);
  const [layer, setLayer] = useState<MapLayer>('risk');
  const [ready, setReady] = useState(false);
  const [sel, setSel] = useState<{ lat: number; lon: number } | null>(null);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const mapRef = useRef<CityMapHandle>(null);
  const mapY = useRef(0);

  useEffect(() => {
    // heavy layer math after the first paint; skeletons meanwhile
    let t: ReturnType<typeof setTimeout> | undefined;
    const raf = requestAnimationFrame(() => {
      t = setTimeout(() => {
        primeCity('night');
        setReady(true);
      }, 280);
    });
    return () => {
      cancelAnimationFrame(raf);
      if (t) clearTimeout(t);
    };
  }, []);

  const k = useMemo(() => (ready ? cityKpis(mode) : null), [ready, mode]);
  const spots = useMemo(() => (ready ? topRisks(mode, 10) : []), [ready, mode]);
  const barriers = useMemo(() => (ready ? accessBarriers() : []), [ready]);
  const selSpot = sel ? spots.find((s) => s.lat === sel.lat && s.lon === sel.lon) ?? null : null;
  const selBarrier: Barrier | null = sel && !selSpot ? barriers.find((b) => b.lat === sel.lat && b.lon === sel.lon) ?? null : null;

  const focus = useCallback((lat: number, lon: number) => {
    tap();
    setSel({ lat, lon });
    scroll.current?.scrollTo({ y: Math.max(0, mapY.current - 70), animated: true });
    setTimeout(() => mapRef.current?.flyTo(lat, lon), 250);
  }, []);

  const attractorTotals = useMemo(() => {
    const pc = OSM.poiCounts as number[];
    return { stops: (OSM.stops as number[]).length / 2, metro: pc[0], schools: pc[1] + pc[2], retail: pc[3] + pc[4] };
  }, []);

  const night = mode === 'night';
  const mapH = Math.round(Math.min(360, Math.max(260, H * 0.38)));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />
      <ScrollView ref={scroll} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, paddingHorizontal: 18, gap: 14 }} showsVerticalScrollIndicator={false}>
        {/* header */}
        <Animated.View entering={enter(0, 'down')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <CircleButton icon="chevron-left" size={46} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <View style={{ flex: 1 }}>
            <Txt v="overline" color={C.route}>
              Planlama · Bakı
            </Txt>
            <Txt v="h1">Şəhər paneli</Txt>
          </View>
          <View style={{ paddingHorizontal: 10, height: 30, borderRadius: 15, backgroundColor: C.surface, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon name="database-outline" size={14} color={C.ink2} />
            <Txt w="semi" size={12} color={C.ink2}>
              OSM
            </Txt>
          </View>
        </Animated.View>
        <Animated.View entering={enter(1, 'down')}>
          <Txt v="bodyS" color={C.ink2}>
            Bakının piyada təhlükəsizliyi: hər keçid və küçə OpenStreetMap məlumatı ilə qiymətləndirilib.
          </Txt>
        </Animated.View>
        <Animated.View entering={enter(2, 'down')}>
          <Segmented
            options={[
              { key: 'day', label: 'Gündüz', icon: 'white-balance-sunny' },
              { key: 'night', label: 'Gecə', icon: 'weather-night' },
            ]}
            value={mode}
            onChange={(m) => setMode(m as Mode)}
          />
        </Animated.View>

        {/* KPIs */}
        {k ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <KpiTile i={0} icon="map-marker-radius-outline" tint={C.purple} color={C.route} value={k.crossings} label="Təhlil olunan keçid" caption={`${fmt(k.types[0])} işıqforlu · ${fmt(k.types[3])} pilləkənli`} />
            <KpiTile i={1} icon="traffic-light-outline" tint={C.dangerSoft} color={C.danger} value={k.unsignalizedMultiLane} label="Çoxzolaqlı yolda işıqforsuz keçid" caption="4+ zolaq · zebra və ya nişansız" />
            <KpiTile
              i={2}
              icon={night ? 'weather-night' : 'white-balance-sunny'}
              tint={C.warnSoft}
              color={C.warn}
              value={k.bands.risky}
              label={night ? 'Gecə riskli keçid' : 'Gündüz riskli keçid'}
              caption={`${Math.round((k.bands.risky / k.crossings) * 100)}% · bal 55-dən aşağı`}
            />
            <KpiTile
              i={3}
              icon="lightbulb-question-outline"
              tint={C.aiSoft}
              color={C.ai}
              value={k.noLightData}
              label="İşıqlandırma məlumatı olmayan keçid"
              caption={`${Math.round((k.noLightData / k.atGrade) * 100)}% · AI Göz bu boşluğu doldurur`}
            />
          </View>
        ) : (
          <KpiSkeleton />
        )}

        {/* distribution */}
        {k ? (
          <Animated.View entering={enter(4, 'up', 80)}>
            <Surface style={{ borderRadius: R.lg, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Donut
                key={mode}
                size={118}
                thickness={16}
                segments={[
                  { value: k.bands.safe, color: C.safe, label: 'Az riskli' },
                  { value: k.bands.mid, color: C.warn, label: 'Orta' },
                  { value: k.bands.risky, color: C.danger, label: 'Riskli' },
                ]}
                center={
                  <View style={{ alignItems: 'center' }}>
                    <Txt v="num" size={20}>
                      {Math.round((k.bands.risky / k.crossings) * 100)}%
                    </Txt>
                    <Txt v="caption" color={C.muted}>
                      riskli
                    </Txt>
                  </View>
                }
              />
              <View style={{ flex: 1, gap: 8 }}>
                <Txt w="bold" size={15}>
                  Keçidlər {night ? 'gecə' : 'gündüz'}
                </Txt>
                {[
                  { c: C.safe, l: 'Az riskli (75+)', v: k.bands.safe },
                  { c: C.warn, l: 'Orta (55–74)', v: k.bands.mid },
                  { c: C.danger, l: 'Riskli (55-dən az)', v: k.bands.risky },
                ].map((r) => (
                  <View key={r.l} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: r.c }} />
                    <Txt v="bodyS" color={C.ink2} style={{ flex: 1 }}>
                      {r.l}
                    </Txt>
                    <Txt w="bold" size={13.5} style={{ fontVariant: ['tabular-nums'] }}>
                      {fmt(r.v)}
                    </Txt>
                  </View>
                ))}
              </View>
            </Surface>
          </Animated.View>
        ) : (
          <Skeleton height={150} radius={R.lg} />
        )}

        {/* map */}
        <View onLayout={(e) => (mapY.current = e.nativeEvent.layout.y)} style={{ gap: 10 }}>
          <SectionTitle over="Xəritə" title={layer === 'risk' ? 'Riskli keçidlər' : 'Təxmini piyada axını'} />
          <Segmented
            options={[
              { key: 'risk', label: 'Risk', icon: 'alert-outline' },
              { key: 'flow', label: 'Piyada axını', icon: 'account-group-outline' },
            ]}
            value={layer}
            onChange={(l) => setLayer(l as MapLayer)}
          />
          {ready ? (
            <Animated.View entering={FadeIn.duration(300)}>
              <CityMap ref={mapRef} mode={mode} layer={layer} spots={spots} selected={sel} height={mapH} />
              <View pointerEvents="none" style={{ position: 'absolute', left: 10, top: 10, right: 10, flexDirection: 'row' }}>
                <View style={{ paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: C.glass, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: layer === 'risk' ? C.danger : C.ai }} />
                  <Txt w="semi" size={12} color={C.ink}>
                    {layer === 'risk' ? `${night ? 'Gecə' : 'Gündüz'} ən riskli keçidlər · ilk 10 nöqtə` : 'Təxmini piyada axını · OSM modeli'}
                  </Txt>
                </View>
              </View>
              {sel ? (
                <PressableScale
                  onPress={() => {
                    setSel(null);
                    mapRef.current?.overview();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Bütün şəhər"
                  style={{ position: 'absolute', right: 10, bottom: 10, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: C.glass, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <Icon name="arrow-expand-all" size={15} color={C.ink} />
                  <Txt w="semi" size={12.5}>
                    Bütün şəhər
                  </Txt>
                </PressableScale>
              ) : null}
            </Animated.View>
          ) : (
            <Skeleton height={mapH} radius={24} />
          )}
          {layer === 'flow' ? (
            <Animated.View entering={FadeIn.duration(240)}>
              <Txt v="caption" color={C.muted}>
                Model: {fmt(attractorTotals.stops)} avtobus dayanacağı, {attractorTotals.metro} metro girişi, {attractorTotals.schools} məktəb və universitet, {attractorTotals.retail} ticarət mərkəzi və bazar (OSM). Hər
                işıqforsuz keçidə 500 m daxilindəki yerlərin məsafəyə görə azalan çəkisi toplanır.
              </Txt>
            </Animated.View>
          ) : null}
          {selSpot ? (
            <Surface style={{ borderRadius: R.lg }}>
              <SpotDetail s={selSpot} mode={mode} />
            </Surface>
          ) : selBarrier ? (
            <Surface style={{ borderRadius: R.lg, gap: 6 }}>
              <Txt w="bold" size={16}>
                {selBarrier.name}
              </Txt>
              <Txt v="bodyS" color={C.ink2}>
                Pilləkənli keçid (yeraltı və ya yerüstü). {selBarrier.nearestAtGradeM ? `Ən yaxın pilləkənsiz keçid ${fmt(selBarrier.nearestAtGradeM)} m aralıdadır.` : 'Yaxınlıqda pilləkənsiz keçid yoxdur.'} Lift və ya pandus
                olmadan əlil və uşaq arabası üçün keçid yoxdur.
              </Txt>
            </Surface>
          ) : ready ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
              <Icon name="gesture-tap" size={16} color={C.muted} />
              <Txt v="caption" color={C.muted}>
                Aşağıdakı siyahıdan keçid seç, xəritə ora uçacaq.
              </Txt>
            </View>
          ) : null}
        </View>

        {/* top 10 */}
        <SectionTitle over={night ? 'Gecə balına görə' : 'Gündüz balına görə'} title="Ən riskli 10 keçid" />
        {ready ? (
          <View key={mode} style={{ gap: 8 }}>
            {spots.map((s, i) => (
              <RiskRow key={`${mode}-${s.idx}`} s={s} rank={i + 1} i={i} selected={!!sel && sel.lat === s.lat && sel.lon === s.lon} onPress={() => focus(s.lat, s.lon)} />
            ))}
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {[0, 1, 2, 3].map((x) => (
              <Skeleton key={x} height={78} radius={20} />
            ))}
          </View>
        )}

        {/* accessibility barriers */}
        <SectionTitle
          over="Əlçatanlıq maneələri"
          title="Pilləkənsiz alternativ yoxdur"
          right={
            ready ? (
              <View style={{ paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: C.dangerSoft, justifyContent: 'center' }}>
                <Txt w="bold" size={13} color={C.danger}>
                  {barriers.length} yer
                </Txt>
              </View>
            ) : null
          }
        />
        <Txt v="bodyS" color={C.ink2}>
          Bu yerlərdə yolu yalnız pilləkənli yeraltı və ya yerüstü keçidlə keçmək olur: 300 m daxilində pilləkənsiz keçid yoxdur. Əlil arabası və uşaq arabası üçün alternativ yoxdur. Sıra təxmini piyada axınına görədir.
        </Txt>
        {ready ? (
          <View style={{ gap: 8 }}>
            {barriers.slice(0, 6).map((b, i) => (
              <Animated.View key={`${b.lat},${b.lon}`} entering={enter(i, 'up', 60)}>
                <PressableScale
                  accessibilityRole="button"
                  onPress={() => {
                    setLayer('risk');
                    focus(b.lat, b.lon);
                  }}
                  scaleTo={0.98}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: C.surface }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.dangerSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="wheelchair-accessibility" size={19} color={C.danger} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt w="bold" size={14.5} numberOfLines={1}>
                      {b.name}
                    </Txt>
                    <Txt v="caption" color={C.muted}>
                      {b.nearestAtGradeM ? `Ən yaxın pilləkənsiz keçid: ${fmt(b.nearestAtGradeM)} m` : '1 km daxilində pilləkənsiz keçid yoxdur'}
                    </Txt>
                  </View>
                  <Icon name="chevron-right" size={20} color={C.faint} />
                </PressableScale>
              </Animated.View>
            ))}
          </View>
        ) : (
          <Skeleton height={64} radius={18} />
        )}

        {/* open-data gap */}
        {k ? (
          <Animated.View entering={enter(0, 'up', 120)}>
            <View style={{ padding: 16, borderRadius: R.lg, backgroundColor: C.aiSoft, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="lightbulb-off-outline" size={20} color={C.ai} />
                <Txt w="bold" size={15} color={C.ink} style={{ flex: 1 }}>
                  Məlumat boşluğu: işıqlandırma
                </Txt>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                <AnimatedNumber value={k.noLightData} v="num" size={30} color={C.ai} />
                <Txt v="bodyS" color={C.ink2} style={{ flex: 1, marginBottom: 4 }}>
                  / {fmt(k.atGrade)} keçiddə işıqlandırma OSM-də qeyd olunmayıb
                </Txt>
              </View>
              <Txt v="bodyS" color={C.ink2}>
                Bu keçidlərin gecə balı ehtiyatla hesablanır. Küçələrdə isə işıq qeydi uzunluğun yalnız {fmt(k.litTaggedPct, 1)}%-ində var. AI Göz ilə çəkilən hər keçid
                işığı, zolaqları və adanı qata əlavə edir.
              </Txt>
              {contributions > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="check-circle" size={16} color={C.brand} />
                  <Txt w="semi" size={13} color={C.brandDark}>
                    Bu cihazdan {contributions} keçid AI Göz ilə əlavə olunub
                  </Txt>
                </View>
              ) : null}
              <PressableScale
                accessibilityRole="button"
                onPress={() => router.push('/scan')}
                style={{ alignSelf: 'flex-start', height: 42, paddingHorizontal: 16, borderRadius: 21, backgroundColor: C.ai, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Icon name="line-scan" size={18} color="#FFFFFF" />
                <Txt w="bold" size={14} color="#FFFFFF">
                  AI Göz ilə doldur
                </Txt>
              </PressableScale>
            </View>
          </Animated.View>
        ) : null}

        <Txt v="caption" color={C.faint} style={{ marginTop: 4 }}>
          Mənbə: OpenStreetMap töhfəçiləri (ODbL). Bal iRAP metodikasından ilhamlanan modeldir; piyada axını {ATTRACTOR_KIND.length} növ real OSM nöqtəsinə əsaslanan təxmindir.
        </Txt>
      </ScrollView>
    </View>
  );
}
