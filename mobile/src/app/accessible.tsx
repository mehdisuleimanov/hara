import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ROUTES } from '@/data/routes';
import { destById } from '@/data/destinations';
import type { Leg } from '@/data/types';
import { MAP_STYLE } from '@/components/mapStyle';
import { LegPolyline } from '@/features/map/LegPolyline';
import { AhmedAvatar } from '@/components/Brand';
import { Burst, Pop } from '@/components/anim';
import { CircleButton, Icon, PillButton, Txt } from '@/components/ui';
import { PressableScale, enter } from '@/motion';
import { useTheme } from '@/hooks/useTheme';
import { regionFor, toLatLngs } from '@/utils/geo';
import { say } from '@/voice';
import { A11Y } from '@/voice/lines/a11y';
import { TopFade } from '@/features/home/TopFade';
import { C, C_HC, R, shadow } from '@/theme';

type Step = { icon: string; title: string; sub: string; status: string; tone: 'ok' | 'bad' | 'info' };

const STEPS: Step[] = [
  { icon: 'wheelchair-accessibility', title: 'Başlanğıc → rampalı səki', sub: 'Enişi 4%-dən az, bordürsüz keçid', status: 'Rampa var', tone: 'ok' },
  { icon: 'elevator-passenger-outline', title: 'Nizami m. · lift', sub: '1-ci çıxış · platformaya qədər', status: 'İşləyir', tone: 'ok' },
  { icon: 'elevator-passenger-off-outline', title: '28 May · keçid lifti', sub: 'Əhməd 2-ci çıxışdakı rampaya yönləndirir', status: 'İşləmir', tone: 'bad' },
  { icon: 'elevator-passenger-outline', title: 'Sahil m. · lift', sub: 'Dənizkənarı çıxışı', status: 'İşləyir', tone: 'ok' },
  { icon: 'door-sliding-open', title: 'Hilton Baku · giriş', sub: 'Pilləkənsiz giriş, avtomatik qapı', status: 'Əlçatan', tone: 'ok' },
];

const WHEEL_M_PER_MIN = 55; // ~3.3 km/h

export default function Accessible() {
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const [booked, setBooked] = useState(false);
  const a = ROUTES.accessible;
  const hilton = destById('hilton')!;
  const legs = useMemo(() => a.legs.map((l) => ({ ...l, durationMin: 0 }) as Leg), [a]);
  const region = useMemo(() => regionFor(legs.flatMap((l) => toLatLngs(l.c)), 1.35), [legs]);
  const walkM = a.legs.filter((l) => l.mode === 'walk').reduce((s, l) => s + l.distanceM, 0);
  const metroM = a.legs.filter((l) => l.mode === 'metro').reduce((s, l) => s + l.distanceM, 0);
  const minutes = Math.round(walkM / WHEEL_M_PER_MIN + 4 + metroM / 600);
  const escortAt = useMemo(() => {
    const d = new Date(Date.now() + 25 * 60000);
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes() % 60).padStart(2, '0')}`;
  }, []);
  const okLifts = STEPS.filter((s) => s.icon.startsWith('elevator') && s.tone === 'ok').length;
  const border = t.hc ? { borderWidth: 2, borderColor: C_HC.line } : null;

  const book = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setBooked(true);
    say(A11Y.escortBooked);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={enter(0, 'fade')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <CircleButton icon="chevron-left" size={48} onPress={() => router.back()} />
          <View style={styles.modeTag}>
            <Icon name="wheelchair-accessibility" size={16} color="#FFFFFF" />
            <Txt w="bold" size={13} color="#FFFFFF">
              Əlçatan rejim
            </Txt>
          </View>
        </Animated.View>

        <Animated.View entering={enter(1)}>
          <Txt v="overline" color={C.muted} style={{ marginTop: 18 }}>
            Pilləkənsiz marşrut
          </Txt>
          <Txt v="h1" style={{ marginTop: 6 }} accessibilityRole="header">
            Hiltona pilləkənsiz yol
          </Txt>
        </Animated.View>

        <Animated.View entering={enter(2)}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14, marginHorizontal: -16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {[
              { icon: 'clock-outline', label: `${minutes} dəq`, tint: C.ink },
              { icon: 'wheelchair-accessibility', label: `${Math.round(walkM / 10) * 10} m səki`, tint: C.route },
              { icon: 'elevator-passenger-outline', label: `${okLifts} lift işləyir`, tint: C.safe },
              { icon: 'subway-variant', label: `${a.stations.length - 1} stansiya`, tint: C.underground },
            ].map((c) => (
              <View key={c.label} style={[styles.chip, border]}>
                <Icon name={c.icon} size={16} color={c.tint} />
                <Txt w="semi" size={13}>
                  {c.label}
                </Txt>
              </View>
            ))}
          </ScrollView>
        </Animated.View>

        {/* map */}
        <Animated.View entering={enter(3)} style={[styles.mapWrap, border]}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFill}
            customMapStyle={MAP_STYLE}
            initialRegion={region}
            toolbarEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            {legs.map((l, i) => (
              <LegPolyline key={i} leg={l} />
            ))}
            <Marker coordinate={{ latitude: a.from.lat, longitude: a.from.lon }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={styles.dotOuter}>
                <View style={styles.dotInner} />
              </View>
            </Marker>
            <Marker coordinate={{ latitude: hilton.lat, longitude: hilton.lon }} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
              <View style={styles.pin}>
                <Icon name="wheelchair-accessibility" size={18} color="#FFFFFF" />
              </View>
            </Marker>
          </MapView>
          <View style={styles.mapLabel} pointerEvents="none">
            <Txt w="bold" size={12.5}>
              Nizami m. → Hilton Baku
            </Txt>
          </View>
        </Animated.View>

        {/* timeline */}
        <Animated.View entering={enter(4)} style={[styles.card, border]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Txt v="h3">Yol boyu</Txt>
            <View style={styles.live}>
              <View style={styles.liveDot} />
              <Txt w="semi" size={12} color={C.ink2}>
                Lift statusu · 9 dəq əvvəl
              </Txt>
            </View>
          </View>
          {STEPS.map((s, i) => {
            const bad = s.tone === 'bad';
            const color = bad ? C.danger : C.safe;
            return (
              <Animated.View key={s.title} entering={enter(5 + i, 'fade')} style={{ flexDirection: 'row', gap: 14 }}>
                <View style={{ alignItems: 'center' }}>
                  <View style={[styles.stepIcon, { backgroundColor: bad ? C.dangerSoft : '#FFFFFF', borderColor: color }]}>
                    <Icon name={s.icon} size={22} color={bad ? C.danger : C.ink} />
                  </View>
                  {i < STEPS.length - 1 ? <View style={[styles.vline, { backgroundColor: bad ? C.dangerSoft : C.brandSoft }]} /> : null}
                </View>
                <View style={{ flex: 1, paddingTop: 2, paddingBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <Txt w="bold" size={15} style={{ flex: 1 }}>
                      {s.title}
                    </Txt>
                    <View style={[styles.status, { backgroundColor: bad ? C.dangerSoft : C.safeSoft }]}>
                      <Icon name={bad ? 'close-circle' : 'check-circle'} size={13} color={color} />
                      <Txt w="bold" size={12} color={color}>
                        {s.status}
                      </Txt>
                    </View>
                  </View>
                  <Txt w="med" size={13} color={bad ? C.ink2 : C.muted} style={{ marginTop: 2 }}>
                    {s.sub}
                  </Txt>
                </View>
              </Animated.View>
            );
          })}
          <View style={styles.ahmedNote}>
            <AhmedAvatar size={30} />
            <Txt w="semi" size={13} color={C.ink2} style={{ flex: 1 }}>
              İşləməyən lifti nəzərə aldım — yol 2-ci çıxışdakı rampadan keçir, pilləkən yoxdur.
            </Txt>
          </View>
        </Animated.View>

        {/* escort booking */}
        <Animated.View entering={enter(6)} layout={LinearTransition.springify().damping(18)} style={[styles.card, booked && { backgroundColor: C.brandSoft }, border]}>
          {!booked ? (
            <Animated.View entering={FadeIn.duration(200)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={styles.escort}>
                  <Icon name="human-wheelchair" size={30} color={C.brandDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt w="xbold" size={17}>
                    Metroda müşayiət
                  </Txt>
                  <Txt w="med" size={13.5} color={C.muted}>
                    Nizami m. · bu gün {escortAt} · «Əlçatan metro»
                  </Txt>
                </View>
              </View>
              <PillButton label="Bir toxunuşla sifariş et" icon="calendar-check" style={{ marginTop: 14 }} onPress={book} />
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn.duration(260)} style={{ alignItems: 'center' }}>
              <View style={{ width: 92, height: 92, alignItems: 'center', justifyContent: 'center' }}>
                <Burst size={220} />
                <Pop>
                  <View style={styles.okIcon}>
                    <Icon name="check-bold" size={38} color="#FFFFFF" />
                  </View>
                </Pop>
              </View>
              <Txt v="h3" center style={{ marginTop: 10 }}>
                Müşayiət sifariş edildi
              </Txt>
              <Txt w="semi" size={14} color={C.ink2} center style={{ marginTop: 4 }}>
                Nizami m. · 1-ci çıxış · {escortAt}
              </Txt>
              <Txt w="med" size={13} color={C.muted} center style={{ marginTop: 4 }}>
                Əməkdaş səni lift qarşısında gözləyəcək
              </Txt>
              <PressableScale scaleTo={0.95} accessibilityRole="button" onPress={() => setBooked(false)} style={styles.undo}>
                <Txt w="semi" size={13} color={C.ink2}>
                  Vaxtı dəyiş
                </Txt>
              </PressableScale>
            </Animated.View>
          )}
        </Animated.View>
      </ScrollView>
      <TopFade />

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        <PillButton
          label="Yola düş"
          icon="navigation-variant"
          variant="brand"
          style={!t.hc ? shadow(2) : undefined}
          onPress={() => router.push('/navigate?dest=hilton&kind=safest')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modeTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.route, borderRadius: R.pill, paddingHorizontal: 14, height: 36 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 13, borderRadius: R.pill, backgroundColor: C.surface },
  mapWrap: { height: 196, borderRadius: R.card, overflow: 'hidden', marginTop: 14, backgroundColor: C.surface },
  mapLabel: { position: 'absolute', left: 12, top: 12, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: R.pill, paddingHorizontal: 12, height: 30, justifyContent: 'center' },
  dotOuter: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(31,111,235,0.25)', alignItems: 'center', justifyContent: 'center' },
  dotInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.route, borderWidth: 2, borderColor: '#FFFFFF' },
  pin: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  card: { backgroundColor: C.surface, borderRadius: R.card, padding: 16, marginTop: 12 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', borderRadius: R.pill, paddingHorizontal: 10, height: 28 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.brand },
  stepIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  vline: { width: 3, flex: 1, borderRadius: 2, marginVertical: 3 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: R.pill, paddingHorizontal: 9, height: 26 },
  ahmedNote: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.aiSoft, borderRadius: R.md, padding: 10 },
  escort: { width: 58, height: 58, borderRadius: 29, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' },
  okIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: C.safe, alignItems: 'center', justifyContent: 'center' },
  undo: { marginTop: 12, paddingHorizontal: 16, height: 36, borderRadius: R.pill, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, backgroundColor: 'rgba(255,255,255,0.96)' },
});
