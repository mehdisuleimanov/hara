import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ROUTES } from '@/data/routes';
import { destById } from '@/data/destinations';
import { MAP_STYLE_FOR_TYPE, MAP_TYPE, mapTypeFor, useSatelliteType } from '@/components/mapStyle';
import { DestPin, OriginPin } from '@/components/RouteLines';
import { CircleButton, Icon, PillButton, Tag, Txt, Heading } from '@/components/ui';
import { regionFor, toLatLngs } from '@/utils/geo';
import { C, R } from '@/theme';

const STEPS = [
  { icon: 'wheelchair-accessibility', title: 'Ev → rampalı səki', sub: '200 m · enişi 4%-dən az', status: 'Rampa var', ok: true },
  { icon: 'elevator-passenger-outline', title: 'Nizami m. · lift', sub: '1-ci çıxış', status: 'İşləyir', ok: true },
  { icon: 'elevator-passenger-off-outline', title: '28 May m. · keçid lifti', sub: 'Alternativ: 2-ci çıxış, rampa', status: 'İşləmir', ok: false },
  { icon: 'elevator-passenger-outline', title: 'Sahil m. · lift', sub: 'Dənizkənarı çıxışı', status: 'İşləyir', ok: true },
  { icon: 'office-building-outline', title: 'Hilton Baku · giriş', sub: 'Pilləkənsiz giriş, avtomatik qapı', status: 'Əlçatan', ok: true },
];

export default function Accessible() {
  const insets = useSafeAreaInsets();
  const [booked, setBooked] = useState(false);
  const a = ROUTES.accessible;
  const hilton = destById('hilton')!;
  const legs = useMemo(() => a.legs.map((l) => ({ mode: l.mode, pts: toLatLngs(l.c) })), [a]);
  const region = useMemo(() => regionFor(legs.flatMap((l) => l.pts), 1.4), [legs]);
  const sat = useSatelliteType(region.latitudeDelta);
  const walkM = a.legs.filter((l) => l.mode === 'walk').reduce((s, l) => s + l.distanceM, 0);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <CircleButton icon="chevron-left" size={52} onPress={() => router.back()} />
          <Tag label="Əlçatan rejim" icon="wheelchair-accessibility" bg={C.brand} color={C.navy} style={{ height: 40, paddingHorizontal: 16 }} />
          <View style={{ flex: 1 }} />
        </View>
        <Heading light="Pilləkənsiz" bold="marşrut" size={34} newline style={{ marginTop: 18 }} />
        <Txt w="semi" size={15} color={C.muted} style={{ marginTop: 6 }}>
          Nizami m. → Hilton Baku · 27 dəq · {Math.round(walkM / 10) * 10} m piyada
        </Txt>

        <View style={styles.mapWrap}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFill}
            mapType={sat.mapType} onRegionChangeComplete={sat.onRegionChangeComplete} customMapStyle={MAP_STYLE_FOR_TYPE}
            initialRegion={region}
            toolbarEnabled={false}
          >
            {legs.map((l, i) => (
              <Polyline
                key={i}
                coordinates={l.pts}
                strokeColor={l.mode === 'metro' ? C.metro : C.navy}
                strokeWidth={6}
                lineDashPattern={l.mode === 'metro' ? [2, 10] : undefined}
                lineCap="round"
              />
            ))}
            <OriginPin latitude={a.from.lat} longitude={a.from.lon} />
            <DestPin latitude={hilton.lat} longitude={hilton.lon} icon="wheelchair-accessibility" />
          </MapView>
        </View>

        <View style={styles.card}>
          {STEPS.map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 14 }}>
              <View style={{ alignItems: 'center' }}>
                <View style={[styles.stepIcon, !s.ok && { backgroundColor: C.dangerSoft }]}>
                  <Icon name={s.icon} size={26} color={s.ok ? C.ink : C.danger} />
                </View>
                {i < STEPS.length - 1 ? <View style={styles.vline} /> : null}
              </View>
              <View style={{ flex: 1, paddingTop: 4, paddingBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Txt w="bold" size={16} style={{ flex: 1 }}>
                    {s.title}
                  </Txt>
                  <Tag label={s.status} bg={s.ok ? C.safeSoft : C.dangerSoft} color={s.ok ? C.safe : C.danger} />
                </View>
                <Txt w="med" size={13.5} color={s.ok ? C.muted : C.ink2} style={{ marginTop: 2 }}>
                  {s.sub}
                </Txt>
              </View>
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="creation" size={16} color={C.muted} />
            <Txt w="med" size={13} color={C.muted}>
              Lift statusu: 4 bildiriş · AI təsdiqi · 9 dəq əvvəl
            </Txt>
          </View>
        </View>

        <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
          <View style={styles.escort}>
            <Icon name="human-wheelchair" size={32} color={C.navy} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt w="xbold" size={18}>
              Metroda müşayiət
            </Txt>
            <Txt w="med" size={14} color={C.muted}>
              Nizami m. · bu gün 18:40 · “Əlçatan metro”
            </Txt>
          </View>
        </View>
        <PillButton
          label={booked ? 'Sifariş göndərildi ✓' : 'Bir toxunuşla sifariş et'}
          style={{ marginTop: 12 }}
          variant={booked ? 'black' : 'brand'}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            setBooked(true);
          }}
        />
        <PillButton
          label="Yola düş"
          icon="navigation-variant"
          variant="white"
          style={{ marginTop: 10 }}
          onPress={() => router.push('/navigate?dest=hilton&kind=safest')}
        />
      </ScrollView>

      <Modal visible={booked} transparent animationType="fade" onRequestClose={() => setBooked(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <View style={styles.okIcon}>
              <Icon name="check-bold" size={40} color={C.ink} />
            </View>
            <Txt w="black" size={24} center style={{ marginTop: 14 }}>
              Müşayiət sifariş edildi
            </Txt>
            <Txt w="med" size={15} color={C.ink2} center style={{ marginTop: 8 }}>
              Nizami m. · 1-ci çıxış · 18:40{'\n'}Əməkdaş sizi lift qarşısında gözləyəcək
            </Txt>
            <Txt w="med" size={12.5} color={C.muted} center style={{ marginTop: 10 }}>
              Bakı Metropoliteninin «Əlçatan metro» xidməti ilə
            </Txt>
            <PillButton label="Oldu" variant="black" style={{ marginTop: 18, alignSelf: 'stretch' }} onPress={() => setBooked(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: { height: 200, borderRadius: R.card, overflow: 'hidden', marginTop: 16, backgroundColor: C.surface },
  card: { backgroundColor: C.surface, borderRadius: R.card, padding: 18, marginTop: 12 },
  stepIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  vline: { width: 2, flex: 1, backgroundColor: C.line, marginVertical: 4 },
  escort: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 22 },
  modal: { backgroundColor: C.bg, borderRadius: 34, padding: 24, alignItems: 'center' },
  okIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.safe, alignItems: 'center', justifyContent: 'center' },
});
