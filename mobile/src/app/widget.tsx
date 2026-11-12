import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useNavStore } from '@/store/nav';
import { optionOf } from '@/data/routes';
import { LogoMark } from '@/components/Brand';
import { ScoreRing } from '@/components/ScoreRing';
import { Icon, Txt } from '@/components/ui';
import { MAP_STYLE } from '@/components/mapStyle';
import { enter } from '@/motion';
import { useFx } from '@/hooks/useTheme';
import { fmtDist, makeTrack, pointAt, toLatLngs } from '@/utils/geo';
import { C, F, R } from '@/theme';

const DAYS = ['Bazar', 'Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə'];
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];

/** Faint city lines on the wallpaper (brand motif from the logo artwork). */
function Wallpaper() {
  return (
    <>
      <LinearGradient colors={['#0A1A3A', '#071532', '#06122A']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 860" preserveAspectRatio="xMidYMid slice">
        <Path d="M-20 190 C 80 120 160 150 230 110 S 360 40 420 70" stroke="#1A4766" strokeWidth={2} fill="none" />
        <Path d="M230 110 C 250 170 300 220 420 260" stroke="#1A4766" strokeWidth={2} fill="none" />
        <Path d="M-30 640 C 90 600 170 640 260 590 S 380 520 430 540" stroke="#1A4766" strokeWidth={2} fill="none" />
        <Path d="M120 860 C 130 760 170 700 260 590" stroke="#1A4766" strokeWidth={2} fill="none" />
        <Path d="M300 30 l 40 20 l -20 40 l -40 -20 z M320 40 l 20 10 M330 20 l -20 40" stroke="#1A4766" strokeWidth={1.6} fill="none" />
        <Path d="M30 740 l 40 20 l -20 40 l -40 -20 z M50 750 l -20 40 M40 770 l 40 20" stroke="#1A4766" strokeWidth={1.6} fill="none" />
      </Svg>
    </>
  );
}

function LiveDot() {
  const { lite } = useFx();
  const v = useSharedValue(0);
  useEffect(() => {
    if (lite) return;
    v.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false);
  }, [lite, v]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - v.value), transform: [{ scale: 1 + v.value * 1.6 }] }));
  return (
    <View style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[styles.liveRing, ring]} />
      <View style={styles.liveCore} />
    </View>
  );
}

/**
 * "Kilid ekranında belə görünür": the live trip card the app keeps on the lock screen
 * (sticky notification on Android). Mirrors the running navigation, or the Hilton walk.
 */
export default function LockScreenPreview() {
  const insets = useSafeAreaInsets();
  const snap = useNavStore((s) => s.snap);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(id);
  }, []);

  const sample = useMemo(() => {
    const o = optionOf('hilton', 'safest');
    const pts = o ? o.legs.filter((l) => l.mode === 'walk').flatMap((l) => toLatLngs(l.c)) : [];
    const t = makeTrack(pts);
    return { pts, pos: pts.length ? pointAt(t, t.total * 0.35).p : null };
  }, []);
  const route = snap.active && snap.route.length ? snap.route : sample.pts;
  const pos = snap.active && snap.pos ? snap.pos : sample.pos;
  const total = Math.max(1, snap.remainingM + 420);
  const done = Math.min(0.96, Math.max(0.06, 1 - snap.remainingM / total));

  const prog = useSharedValue(0);
  useEffect(() => {
    prog.value = withTiming(done, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [done, prog]);
  const fill = useAnimatedStyle(() => ({ width: `${prog.value * 100}%` }));
  const walker = useAnimatedStyle(() => ({ left: `${prog.value * 100}%` }));

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const hazard = !!snap.hazard;

  return (
    <Pressable
      style={{ flex: 1 }}
      accessibilityRole="button"
      accessibilityLabel="Bağla"
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        router.back();
      }}
    >
      <StatusBar style="light" />
      <Wallpaper />
      <View style={{ flex: 1, paddingTop: insets.top + 14, paddingHorizontal: 16, alignItems: 'center' }}>
        <Animated.View entering={enter(0, 'down')} style={styles.caption}>
          <Icon name="cellphone-lock" size={15} color="#CFE0FF" />
          <Txt w="semi" size={12.5} color="#CFE0FF">
            Kilid ekranında belə görünür
          </Txt>
        </Animated.View>

        <Animated.View entering={enter(1, 'fade')} style={{ alignItems: 'center', marginTop: 18 }}>
          <Icon name="lock-outline" size={20} color="rgba(255,255,255,0.8)" />
          <Txt w="semi" size={15} color="rgba(255,255,255,0.85)" style={{ marginTop: 6 }}>
            {DAYS[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]}
          </Txt>
          <Txt size={86} color="#FFFFFF" style={{ fontFamily: F.semi, letterSpacing: -3, lineHeight: 96 }}>
            {hh}:{mm}
          </Txt>
        </Animated.View>

        {/* live trip card */}
        <Animated.View entering={enter(2, 'up', 120)} style={styles.card}>
          <View style={styles.cardHead}>
            <LogoMark size={26} />
            <Txt w="bold" size={13.5} color={C.ink2} style={{ flex: 1 }}>
              Hara · {snap.destName}
            </Txt>
            <LiveDot />
            <Txt w="bold" size={12.5} color={C.brandDark}>
              {snap.active ? 'Canlı' : 'Yolda'}
            </Txt>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <View style={{ flex: 1, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.turn, hazard && { backgroundColor: C.warn }]}>
                  <Icon name={hazard ? 'alert' : snap.maneuverIcon || 'arrow-top-right-thick'} size={22} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt w="xbold" size={20} color={C.ink} numberOfLines={1}>
                    {fmtDist(snap.distToNext)}
                  </Txt>
                  <Txt w="semi" size={13} color={C.ink2} numberOfLines={1}>
                    {snap.maneuver} · {snap.street}
                  </Txt>
                </View>
              </View>
              {hazard ? (
                <View style={styles.hazard}>
                  <Icon name="alert-circle" size={15} color="#92400E" />
                  <Txt w="semi" size={12.5} color="#92400E" numberOfLines={2} style={{ flex: 1 }}>
                    {snap.hazard} · Əhməd yönləndirir
                  </Txt>
                </View>
              ) : null}
            </View>
            <View style={styles.map}>
              {route.length > 1 ? (
                <MapView
                  style={StyleSheet.absoluteFill}
                  mapType="standard"
                  customMapStyle={MAP_STYLE}
                  liteMode
                  region={{
                    latitude: pos?.latitude ?? route[0].latitude,
                    longitude: pos?.longitude ?? route[0].longitude,
                    latitudeDelta: 0.006,
                    longitudeDelta: 0.006,
                  }}
                  pointerEvents="none"
                >
                  <Polyline coordinates={route} strokeColor={C.halo} strokeWidth={12} />
                  <Polyline coordinates={route} strokeColor={C.route} strokeWidth={5} />
                  {pos ? (
                    <Marker coordinate={pos} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                      <View style={styles.me} />
                    </Marker>
                  ) : null}
                </MapView>
              ) : null}
            </View>
          </View>

          {/* progress */}
          <View style={styles.track}>
            <Animated.View style={[styles.trackFill, fill]} />
            <Animated.View style={[styles.walker, walker]}>
              <Icon name="walk" size={13} color="#FFFFFF" />
            </Animated.View>
          </View>

          <View style={styles.cardFoot}>
            <ScoreRing score={snap.score} size={40} showShield={false} />
            <View style={{ flex: 1 }}>
              <Txt w="bold" size={13.5} color={C.ink}>
                Ən az riskli yol
              </Txt>
              <Txt w="med" size={12.5} color={C.muted}>
                {snap.remainingMin} dəq · {fmtDist(snap.remainingM)} · çatış {snap.eta}
              </Txt>
            </View>
          </View>
        </Animated.View>

        {/* family notification */}
        <Animated.View entering={enter(4, 'up', 220)} style={styles.notif}>
          <LogoMark size={34} />
          <View style={{ flex: 1 }}>
            <Txt w="bold" size={13.5} color="#FFFFFF" numberOfLines={1}>
              Hara Ailə
            </Txt>
            <Txt w="med" size={12.5} color="rgba(255,255,255,0.78)" numberOfLines={2}>
              Murad məktəbə çatdı · yolda işıqforsuz keçid olmadı
            </Txt>
          </View>
          <Txt w="med" size={11.5} color="rgba(255,255,255,0.6)">
            indi
          </Txt>
        </Animated.View>

        <View style={{ flex: 1 }} />
        <Animated.View entering={enter(6, 'fade', 300)} style={{ alignItems: 'center', gap: 10, marginBottom: insets.bottom + 14 }}>
          <View style={styles.homeBar} />
          <Txt w="med" size={12} color="rgba(255,255,255,0.6)">
            Bağlamaq üçün toxun
          </Txt>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  caption: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: R.pill, paddingHorizontal: 12, height: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  card: { width: '100%', backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 28, padding: 14, marginTop: 22 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  turn: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.route, alignItems: 'center', justifyContent: 'center' },
  hazard: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.warnSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  map: { width: 112, height: 92, borderRadius: 16, overflow: 'hidden', backgroundColor: C.surface },
  me: { width: 16, height: 16, borderRadius: 8, backgroundColor: C.route, borderWidth: 3, borderColor: '#FFFFFF' },
  track: { height: 8, borderRadius: 4, backgroundColor: C.bg2, marginTop: 16, marginBottom: 6, marginHorizontal: 4 },
  trackFill: { height: 8, borderRadius: 4, backgroundColor: C.brand },
  walker: { position: 'absolute', top: -7, marginLeft: -11, width: 22, height: 22, borderRadius: 11, backgroundColor: C.brand, borderWidth: 2.5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  liveRing: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: C.brand },
  liveCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.brand },
  notif: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 22, padding: 12, marginTop: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  homeBar: { width: 120, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.5)' },
});
