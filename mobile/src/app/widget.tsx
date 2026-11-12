import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useNavStore } from '@/store/nav';
import { optionOf } from '@/data/routes';
import { LogoMark } from '@/components/Brand';
import { Icon, Txt } from '@/components/ui';
import { MAP_STYLE } from '@/components/mapStyle';
import { fmtDist, makeTrack, pointAt, toLatLngs } from '@/utils/geo';
import { C, R, shadow } from '@/theme';

const DAYS = ['Bazar', 'Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə'];
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];

/**
 * Lock-screen widget SIMULATION (reference 2: "Smart Navigation").
 * Real home/lock-screen widgets need a native dev build; in Expo Go the live
 * part is the sticky notification (see utils/notify.ts).
 */
export default function WidgetPreview() {
  const insets = useSafeAreaInsets();
  const snap = useNavStore((s) => s.snap);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(id);
  }, []);

  // when no navigation is running, show the Hilton safest walk as a sample
  const sample = useMemo(() => {
    const o = optionOf('hilton', 'safest');
    const pts = o ? o.legs.filter((l) => l.mode === 'walk').flatMap((l) => toLatLngs(l.c)) : [];
    const t = makeTrack(pts);
    return { pts, pos: pts.length ? pointAt(t, t.total * 0.35).p : null };
  }, []);
  const route = snap.active && snap.route.length ? snap.route : sample.pts;
  const pos = snap.active && snap.pos ? snap.pos : sample.pos;

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');

  return (
    <Pressable style={{ flex: 1 }} onPress={() => router.back()}>
      <LinearGradient colors={['#2B2B33', '#4A3328', '#FF6203']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1, paddingTop: insets.top + 30, alignItems: 'center', paddingHorizontal: 18 }}>
        <Icon name="lock-outline" size={22} color="rgba(255,255,255,0.85)" />
        <Txt w="semi" size={16} color="rgba(255,255,255,0.85)" style={{ marginTop: 10 }}>
          {DAYS[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]}
        </Txt>
        <Txt w="semi" size={92} color="#fff" style={{ letterSpacing: -2, lineHeight: 100 }}>
          {hh}:{mm}
        </Txt>

        {/* widget card */}
        <View style={[styles.widget, shadow(3)]}>
          <View style={{ flexDirection: 'row', height: 190 }}>
            <View style={styles.timeline}>
              <View style={styles.tlItem}>
                <View style={styles.dot} />
                <Txt w="semi" size={13} color={C.ink2} numberOfLines={1} style={{ flex: 1 }}>
                  {snap.destName}
                </Txt>
              </View>
              <View style={styles.dash} />
              <View style={styles.tlItem}>
                <View style={styles.ring}>
                  <View style={styles.ringInner} />
                </View>
                <Txt w="bold" size={14} numberOfLines={2} style={{ flex: 1 }}>
                  {fmtDist(snap.distToNext)} {snap.maneuver}
                </Txt>
              </View>
              <View style={styles.dash} />
              <View style={styles.tlItem}>
                <View style={styles.dot} />
                <Txt w="semi" size={13} color={C.ink2}>
                  {snap.speedKmh} km/s
                </Txt>
              </View>
            </View>
            <View style={styles.map}>
              {route.length > 1 ? (
                <MapView
                  provider={PROVIDER_GOOGLE}
                  style={StyleSheet.absoluteFill}
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
                  <Polyline coordinates={route} strokeColor="rgba(255,98,3,0.25)" strokeWidth={14} />
                  <Polyline coordinates={route} strokeColor={C.brand} strokeWidth={6} />
                  {pos ? (
                    <Marker coordinate={pos} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                      <View style={styles.arrow}>
                        <Icon name="navigation" size={18} color="#fff" />
                      </View>
                    </Marker>
                  ) : null}
                </MapView>
              ) : null}
            </View>
          </View>
          <View style={{ padding: 16, paddingTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <LogoMark size={22} />
              <Txt w="black" size={20}>
                Ağıllı naviqasiya
              </Txt>
            </View>
            <Txt w="med" size={14} color={C.muted} style={{ marginTop: 4 }}>
              {snap.hazard
                ? `⚠ ${snap.hazard} · Əhməd yönləndirir`
                : `Ən az riskli yol · ${snap.score} bal · ${snap.remainingMin} dəq · çatış ${snap.eta}`}
            </Txt>
          </View>
        </View>

        {/* notification imitation */}
        <View style={styles.notif}>
          <LogoMark size={18} />
          <View style={{ flex: 1 }}>
            <Txt w="bold" size={13.5} color="#fff" numberOfLines={1}>
              Hara? · {fmtDist(snap.distToNext)} {snap.maneuver} · {snap.street}
            </Txt>
            <Txt w="med" size={12.5} color="rgba(255,255,255,0.75)" numberOfLines={1}>
              {snap.remainingMin} dəq · {fmtDist(snap.remainingM)} · Təhlükəsizlik {snap.score}
            </Txt>
          </View>
          <Txt w="med" size={11.5} color="rgba(255,255,255,0.6)">
            indi
          </Txt>
        </View>

        <View style={{ flex: 1 }} />
        <Txt w="med" size={12} color="rgba(255,255,255,0.7)" center style={{ marginBottom: insets.bottom + 16 }}>
          {snap.active ? 'Canlı · naviqasiya davam edir' : 'Nümunə · naviqasiyanı başladanda canlı olur'}
          {'\n'}Kilid ekranı simulyasiyası · bağlamaq üçün toxun
        </Txt>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  widget: { width: '100%', backgroundColor: '#fff', borderRadius: R.card, overflow: 'hidden', marginTop: 26 },
  timeline: { width: '46%', paddingVertical: 18, paddingLeft: 16, paddingRight: 6, justifyContent: 'space-between' },
  tlItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: C.brand, borderWidth: 4, borderColor: C.brandSoft },
  ring: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,98,3,0.18)', alignItems: 'center', justifyContent: 'center', marginLeft: -3 },
  ringInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff' },
  dash: { width: 2, flex: 1, marginLeft: 7, marginVertical: 4, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,98,3,0.45)' },
  map: { flex: 1, backgroundColor: C.bg, borderBottomLeftRadius: 0 },
  arrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.brand, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  notif: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 22,
    padding: 14,
    marginTop: 12,
  },
});
