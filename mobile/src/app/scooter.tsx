import React, { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppStore, GUST_LIMIT, SEAFRONT_WIND_LIMIT } from '@/store/useAppStore';
import { ROUTES } from '@/data/routes';
import { MAP_STYLE } from '@/components/mapStyle';
import { DestPin, OriginPin } from '@/components/RouteLines';
import { AhmedAvatar } from '@/components/Brand';
import { CircleButton, Icon, PillButton, Tag, Txt } from '@/components/ui';
import { AnimatedNumber, Skeleton, SPRING, enter } from '@/motion';
import { useFx } from '@/hooks/useTheme';
import { regionFor, toLatLngs } from '@/utils/geo';
import { useWeather } from '@/utils/weather';
import { say, stop } from '@/voice';
import { BRAND } from '@/voice/lines/brand';
import { useMarkerSnapshot } from '@/features/brand/useMarkerSnapshot';
import { C, R, shadow } from '@/theme';

/**
 * Wind source: live Baku wind (Open-Meteo) by default. The developer panel's wind slider writes
 * the store; once it differs from the store defaults (or a `windManual` flag exists), it wins.
 */
const STORE_DEFAULT = { speed: 9, gust: 13 };
function useWind() {
  const live = useWeather();
  const storeSpeed = useAppStore((s) => s.windSpeed);
  const storeGust = useAppStore((s) => s.windGust);
  const flag = useAppStore((s) => (s as unknown as { windManual?: boolean }).windManual);
  const manual = flag === true || storeSpeed !== STORE_DEFAULT.speed || storeGust !== STORE_DEFAULT.gust;
  if (manual || (live && live.source === 'store')) {
    return { ready: true, speed: storeSpeed, gust: storeGust, dir: live?.windDir ?? 340, temp: live?.tempC ?? null, live: false };
  }
  if (!live) return { ready: false, speed: storeSpeed, gust: storeGust, dir: 340, temp: null, live: false };
  return { ready: true, speed: live.windSpeed, gust: live.windGust, dir: live.windDir, temp: live.tempC, live: true };
}

/** Wind direction (degrees it blows FROM) → Azerbaijani name. */
function windName(dir: number) {
  const d = ((dir % 360) + 360) % 360;
  if (d >= 290 || d < 45) return 'Xəzri · şimaldan';
  if (d >= 135 && d < 250) return 'Gilavar · cənubdan';
  if (d >= 45 && d < 135) return 'Şərq küləyi';
  return 'Qərb küləyi';
}

function WindArrow({ dir, color }: { dir: number; color: string }) {
  const { lite } = useFx();
  const rot = useSharedValue(dir + 180);
  const sway = useSharedValue(0);
  useEffect(() => {
    rot.value = withSpring(dir + 180, SPRING.gentle);
  }, [dir, rot]);
  useEffect(() => {
    if (lite) return;
    sway.value = withRepeat(withSequence(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), withTiming(-1, { duration: 900, easing: Easing.inOut(Easing.sin) })), -1, true);
  }, [lite, sway]);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value + sway.value * 6}deg` }] }));
  return (
    <View style={styles.compass}>
      <Txt w="bold" size={10} color={C.muted} style={{ position: 'absolute', top: 4 }}>
        Ş
      </Txt>
      <Animated.View style={a}>
        <Icon name="navigation" size={30} color={color} />
      </Animated.View>
    </View>
  );
}

export default function Scooter() {
  const { speak: speakParam } = useLocalSearchParams<{ speak?: string }>();
  const insets = useSafeAreaInsets();
  const w = useWind();
  const trackMarkers = useMarkerSnapshot(900, `${w.speed > SEAFRONT_WIND_LIMIT}${w.gust > GUST_LIMIT}`);
  const s = ROUTES.scooter;
  const sea = useMemo(() => toLatLngs(s.seafront.c), [s]);
  const calm = useMemo(() => toLatLngs(s.calm.c), [s]);
  const region = useMemo(() => regionFor([...sea, ...calm], 1.35), [sea, calm]);

  const banned = w.gust > GUST_LIMIT;
  const useCalm = w.speed > SEAFRONT_WIND_LIMIT;
  const chosen = useCalm ? calm : sea;
  const other = useCalm ? sea : calm;
  const chosenMin = useCalm ? s.calm.durationMin : s.seafront.durationMin;
  const tip = banned ? BRAND.scooterBanned : useCalm ? BRAND.scooterCalm : BRAND.scooterSeafront;
  const tone = banned ? { fg: C.danger, bg: C.dangerSoft, label: 'Skuter üçün təhlükəli' } : useCalm ? { fg: '#B45309', bg: C.warnSoft, label: 'Güclü külək' } : { fg: C.brandDark, bg: C.brandSoft, label: 'Skuter üçün uyğun' };

  const prev = useRef({ useCalm, banned });
  useEffect(() => {
    if (prev.current.useCalm !== useCalm || prev.current.banned !== banned) {
      Haptics.notificationAsync(banned ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success).catch(() => {});
      prev.current = { useCalm, banned };
    }
  }, [useCalm, banned]);

  useEffect(() => {
    if (speakParam !== '1' || !w.ready) return;
    const t = setTimeout(() => say(tip), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakParam, w.ready]);
  useEffect(() => () => stop(), []);

  const mid = chosen[Math.floor(chosen.length * 0.45)];
  const otherMid = other[Math.floor(other.length * 0.6)];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: insets.bottom + 28, gap: 12 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={enter(0, 'fade')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <CircleButton icon="chevron-left" size={48} onPress={() => router.back()} />
          <View style={{ flex: 1 }}>
            <Txt v="h1" accessibilityRole="header">
              Skuter
            </Txt>
            <Txt v="caption" color={C.muted}>
              Küləyə görə marşrut
            </Txt>
          </View>
          <View style={styles.scooterIcon}>
            <Icon name="scooter" size={24} color={C.route} />
          </View>
        </Animated.View>

        {/* live wind */}
        {w.ready ? (
          <Animated.View entering={enter(1, 'up')} style={[styles.wind, { backgroundColor: tone.bg }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <WindArrow dir={w.dir} color={tone.fg} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <AnimatedNumber value={w.speed} decimals={w.speed % 1 ? 1 : 0} v="num" color={C.ink} />
                  <Txt v="label" color={C.ink2}>
                    m/s külək
                  </Txt>
                </View>
                <Txt v="bodyS" color={C.ink2}>
                  {windName(w.dir)} · qasırğa {String(w.gust).replace('.', ',')} m/s
                </Txt>
              </View>
              {w.live ? (
                <View style={styles.livePill}>
                  <View style={[styles.liveDot, { backgroundColor: tone.fg }]} />
                  <Txt w="bold" size={11} color={tone.fg}>
                    CANLI
                  </Txt>
                </View>
              ) : null}
            </View>
            <View style={styles.windFoot}>
              <Icon name={banned ? 'alert-octagon' : useCalm ? 'weather-windy' : 'check-circle'} size={18} color={tone.fg} />
              <Txt w="bold" size={14} color={tone.fg} style={{ flex: 1 }}>
                {tone.label}
              </Txt>
              {w.temp != null ? (
                <Txt v="label" color={C.ink2}>
                  {w.temp}°C · Bakı
                </Txt>
              ) : null}
            </View>
          </Animated.View>
        ) : (
          <View style={[styles.wind, { backgroundColor: C.surface, gap: 12 }]}>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              <Skeleton width={58} height={58} radius={29} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width="55%" height={22} />
                <Skeleton width="80%" height={14} />
              </View>
            </View>
            <Skeleton height={16} width="60%" />
          </View>
        )}

        {/* Əhməd's decision */}
        <Animated.View entering={enter(2, 'up')} style={styles.tip}>
          <AhmedAvatar size={46} mood={banned ? 'alert' : useCalm ? 'think' : 'smile'} />
          <Txt v="body" style={{ flex: 1 }}>
            {tip}
          </Txt>
        </Animated.View>

        <Animated.View entering={enter(3, 'up')} style={styles.mapWrap}>
          <MapView style={StyleSheet.absoluteFill} mapType="standard" customMapStyle={MAP_STYLE} initialRegion={region} toolbarEnabled={false} pitchEnabled={false} rotateEnabled={false}>
            {!banned ? (
              <>
                <Polyline coordinates={other} strokeColor="#A7B1C2" strokeWidth={4} lineDashPattern={[8, 8]} zIndex={2} />
                <Polyline coordinates={chosen} strokeColor={C.halo} strokeWidth={15} zIndex={3} lineCap="round" />
                <Polyline coordinates={chosen} strokeColor={C.route} strokeWidth={6} zIndex={4} lineCap="round" lineJoin="round" />
                {mid ? (
                  <Marker coordinate={mid} anchor={{ x: 0.5, y: 1.2 }} tracksViewChanges={trackMarkers}>
                    <View style={styles.label}>
                      <Txt w="bold" size={12.5} color="#FFFFFF">
                        {useCalm ? 'Daxili küçələr' : 'Dənizkənarı'} · {chosenMin} dəq
                      </Txt>
                    </View>
                  </Marker>
                ) : null}
                {otherMid && useCalm ? (
                  <Marker coordinate={otherMid} anchor={{ x: 0.5, y: -0.3 }} tracksViewChanges={trackMarkers}>
                    <View style={[styles.label, { backgroundColor: C.dangerSoft }]}>
                      <Txt w="bold" size={12} color={C.danger}>
                        Dənizkənarı · qarşı külək
                      </Txt>
                    </View>
                  </Marker>
                ) : null}
              </>
            ) : null}
            <OriginPin latitude={s.from.lat} longitude={s.from.lon} />
            <DestPin latitude={s.to.lat} longitude={s.to.lon} icon="storefront-outline" />
          </MapView>
          {banned ? (
            <View style={styles.bannedVeil}>
              <Icon name="scooter-off" size={34} color={C.danger} />
              <Txt w="bold" size={15} color={C.ink} center>
                Bu gün skuter marşrutu gizlədilib
              </Txt>
            </View>
          ) : null}
        </Animated.View>

        {!banned ? (
          <Animated.View entering={enter(4, 'up')} style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Tag label={useCalm ? '72% velosiped zolağı' : '85% velosiped zolağı'} icon="bike" bg={C.surface} color={C.ink} style={{ height: 34 }} />
            <Tag label={useCalm ? 'Qarşı külək yoxdur' : 'Külək arxadan'} icon="weather-windy" bg={C.surface} color={C.ink} style={{ height: 34 }} />
            <Tag label="Yoxuş az" icon="slope-uphill" bg={C.surface} color={C.ink} style={{ height: 34 }} />
          </Animated.View>
        ) : null}

        <Animated.View entering={enter(5, 'up')}>
          {banned ? (
            <PillButton label="Metro variantına bax" icon="subway-variant" variant="black" onPress={() => router.push('/results/port')} />
          ) : (
            <PillButton label="Başla" icon="navigation-variant" onPress={() => router.push(`/navigate?scooter=${useCalm ? 'calm' : 'seafront'}`)} />
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scooterIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' },
  wind: { borderRadius: R.lg, padding: 16, gap: 14 },
  compass: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', ...shadow(1) },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: R.pill, paddingHorizontal: 9, height: 24, alignSelf: 'flex-start' },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  windFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: 'rgba(15,27,45,0.08)', paddingTop: 12 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.aiSoft, borderRadius: R.lg, padding: 14 },
  mapWrap: { height: 300, borderRadius: R.lg, overflow: 'hidden', backgroundColor: C.surface },
  label: { backgroundColor: C.navy, borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 6 },
  bannedVeil: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.72)', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
});
