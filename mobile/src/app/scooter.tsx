import React, { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppStore, GUST_LIMIT, SEAFRONT_WIND_LIMIT } from '@/store/useAppStore';
import { ROUTES } from '@/data/routes';
import { MAP_STYLE_FOR_TYPE, MAP_TYPE, mapTypeFor, useSatelliteType } from '@/components/mapStyle';
import { DestPin, OriginPin } from '@/components/RouteLines';
import { AhmedAvatar } from '@/components/Brand';
import { CircleButton, Heading, Icon, PillButton, Tag, Txt } from '@/components/ui';
import { regionFor, toLatLngs } from '@/utils/geo';
import { speak, stopSpeaking } from '@/utils/tts';
import { C, R } from '@/theme';

export default function Scooter() {
  const { speak: speakParam } = useLocalSearchParams<{ speak?: string }>();
  const insets = useSafeAreaInsets();
  const wind = useAppStore((s) => s.windSpeed);
  const gust = useAppStore((s) => s.windGust);
  const setWind = useAppStore((s) => s.setWind);
  const s = ROUTES.scooter;
  const sea = useMemo(() => toLatLngs(s.seafront.c), [s]);
  const calm = useMemo(() => toLatLngs(s.calm.c), [s]);
  const region = useMemo(() => regionFor([...sea, ...calm], 1.35), [sea, calm]);
  const sat = useSatelliteType(region.latitudeDelta);

  const banned = gust > GUST_LIMIT;
  const useCalm = wind > SEAFRONT_WIND_LIMIT;
  const chosen = useCalm ? calm : sea;
  const other = useCalm ? sea : calm;
  const chosenMin = useCalm ? s.calm.durationMin : s.seafront.durationMin;
  const tip = banned
    ? `Qasırğa ${gust} m/s-dir. Skuter bu gün təhlükəlidir — metro ilə getməyi tövsiyə edirəm.`
    : useCalm
      ? 'Dənizkənarında güclü qarşı külək var, daxili küçələrlə gedirik.'
      : 'Külək zəifdir — dənizkənarı velosiped zolağı ilə gedə bilərik.';

  const prev = useRef({ useCalm, banned });
  useEffect(() => {
    if (prev.current.useCalm !== useCalm || prev.current.banned !== banned) {
      Haptics.notificationAsync(banned ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success).catch(() => {});
      prev.current = { useCalm, banned };
    }
  }, [useCalm, banned]);

  useEffect(() => {
    if (speakParam === '1') {
      const t = setTimeout(() => speak(tip), 500);
      return () => {
        clearTimeout(t);
        stopSpeaking();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakParam]);

  const mid = chosen[Math.floor(chosen.length * 0.45)];
  const otherMid = other[Math.floor(other.length * 0.6)];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <CircleButton icon="chevron-left" size={52} onPress={() => router.back()} />
          <Icon name="scooter" size={30} />
          <Heading light="Skuter" bold="rejimi" size={28} style={{ flex: 1 }} />
        </View>

        {/* wind card */}
        <View style={[styles.wind, banned && { backgroundColor: C.danger }]}>
          <View style={styles.windIcon}>
            <Icon name="weather-windy" size={30} color={banned ? C.danger : C.navy} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt w="xbold" size={19} color={C.ink}>
              Külək {wind} m/s · qasırğa {gust} m/s
            </Txt>
            <Txt w="med" size={14} color={C.muted}>
              Şimal-qərbdən · Xəzri
            </Txt>
          </View>
        </View>

        <View style={styles.sliderCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt w="semi" size={13} color={C.muted}>
              KÜLƏK İNDİ
            </Txt>
            <Txt w="bold" size={13} color={banned ? C.danger : useCalm ? C.ink : C.safe}>
              {banned ? 'Skuter gizlədildi' : useCalm ? 'Daxili küçələr' : 'Dənizkənarı'}
            </Txt>
          </View>
          <Slider
            minimumValue={0}
            maximumValue={20}
            step={1}
            value={wind}
            onValueChange={(v) => setWind(Math.round(v))}
            minimumTrackTintColor={C.brand}
            maximumTrackTintColor={C.line}
            thumbTintColor={C.brand}
          />
        </View>

        <View style={styles.mapWrap}>
          <MapView provider={PROVIDER_GOOGLE} style={StyleSheet.absoluteFill} mapType={sat.mapType} onRegionChangeComplete={sat.onRegionChangeComplete} customMapStyle={MAP_STYLE_FOR_TYPE} initialRegion={region} toolbarEnabled={false}>
            {!banned ? (
              <>
                <Polyline coordinates={other} strokeColor="#9A9AA0" strokeWidth={5} lineDashPattern={[8, 8]} zIndex={2} />
                <Polyline coordinates={chosen} strokeColor={C.halo} strokeWidth={16} zIndex={3} lineCap="round" />
                <Polyline coordinates={chosen} strokeColor={C.route} strokeWidth={7} zIndex={4} lineCap="round" lineJoin="round" />
                {mid ? (
                  <Marker coordinate={mid} anchor={{ x: 0.5, y: 1.2 }} tracksViewChanges={false}>
                    <View style={styles.label}>
                      <Txt w="bold" size={13}>
                        {useCalm ? 'Rahat' : 'Dənizkənarı'} · {chosenMin} dəq
                      </Txt>
                    </View>
                  </Marker>
                ) : null}
                {otherMid && useCalm ? (
                  <Marker coordinate={otherMid} anchor={{ x: 0.5, y: -0.3 }} tracksViewChanges={false}>
                    <View style={[styles.label, { borderColor: C.danger }]}>
                      <Txt w="bold" size={12.5} color={C.danger}>
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
        </View>

        {!banned ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <Tag label={useCalm ? '72% velosiped zolağı' : '85% velosiped zolağı'} icon="bike" bg={C.surface} color={C.ink} style={{ height: 36 }} />
            <Tag label={useCalm ? 'Qarşı külək yoxdur' : 'Külək arxadan'} icon="weather-windy" bg={C.surface} color={C.ink} style={{ height: 36 }} />
            <Tag label="Yoxuş az" icon="slope-uphill" bg={C.surface} color={C.ink} style={{ height: 36 }} />
          </View>
        ) : null}

        <View style={styles.tip}>
          <AhmedAvatar size={44} />
          <Txt w="semi" size={15} lh={21} style={{ flex: 1 }}>
            {tip}
          </Txt>
        </View>

        {banned ? (
          <PillButton label="Metro variantına bax" icon="subway-variant" variant="black" style={{ marginTop: 14 }} onPress={() => router.push('/results/port')} />
        ) : (
          <PillButton
            label="Başla"
            icon="navigation-variant"
            style={{ marginTop: 14 }}
            onPress={() => router.push(`/navigate?scooter=${useCalm ? 'calm' : 'seafront'}`)}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wind: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.purple, borderRadius: R.lg, padding: 16, marginTop: 18 },
  windIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  sliderCard: { backgroundColor: C.surface, borderRadius: R.lg, padding: 16, paddingBottom: 8, marginTop: 10 },
  mapWrap: { height: 330, borderRadius: R.card, overflow: 'hidden', marginTop: 12, backgroundColor: C.surface },
  label: { backgroundColor: C.surface, borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1.5, borderColor: C.brand },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: R.lg, padding: 14, marginTop: 12 },
});
