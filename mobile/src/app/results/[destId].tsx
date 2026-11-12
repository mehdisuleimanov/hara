import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAppStore, useIsNight } from '@/store/useAppStore';
import { destById } from '@/data/destinations';
import { optionsFor, ROUTES } from '@/data/routes';
import type { RouteKind } from '@/data/types';
import { scriptedReply } from '@/ai/ahmed';
import { MAP_STYLE } from '@/components/mapStyle';
import { DestPin, OriginPin, RouteLines } from '@/components/RouteLines';
import { RouteCard } from '@/components/RouteCard';
import { AhmedAvatar } from '@/components/Brand';
import { CircleButton, DemoBadge, Icon, PillButton, Tag, Txt } from '@/components/ui';
import { regionFor, toLatLngs } from '@/utils/geo';
import { speak, stopSpeaking } from '@/utils/tts';
import { C, R, shadow } from '@/theme';

const H = Dimensions.get('window').height;

export default function Results() {
  const { destId, kind, speak: speakParam } = useLocalSearchParams<{ destId: string; kind?: RouteKind; speak?: string }>();
  const insets = useSafeAreaInsets();
  const night = useIsNight();
  const lastAhmed = useAppStore((s) => s.lastAhmed);
  const profile = useAppStore((s) => s.profile);
  const dest = destById(destId);
  const options = optionsFor(destId);
  const [selected, setSelected] = useState<RouteKind>(kind ?? 'safest');
  const mapRef = useRef<MapView>(null);

  const reply = useMemo(() => {
    if (lastAhmed && lastAhmed.destId === destId && lastAhmed.reply) return lastAhmed.reply;
    return scriptedReply(destId, 'safest', night);
  }, [lastAhmed, destId, night]);

  useEffect(() => {
    if (speakParam === '1') {
      const t = setTimeout(() => speak(reply), 500);
      return () => {
        clearTimeout(t);
        stopSpeaking();
      };
    }
  }, [speakParam, reply]);

  const opt = options.find((o) => o.kind === selected) ?? options[0];
  const region = useMemo(() => {
    const pts = options.flatMap((o) => o.legs.flatMap((l) => toLatLngs(l.c)));
    return pts.length ? regionFor(pts, 1.35) : undefined;
  }, [options]);

  if (!dest || !opt) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <Txt>Marşrut tapılmadı</Txt>
      </View>
    );
  }
  const others = options.filter((o) => o.kind !== selected);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: H * 0.46 }}
        customMapStyle={MAP_STYLE}
        initialRegion={region}
        mapPadding={{ top: insets.top + 60, bottom: 40, left: 20, right: 20 }}
        toolbarEnabled={false}
        showsCompass={false}
      >
        {others.map((o) => (
          <RouteLines key={o.id} option={o} active={false} />
        ))}
        <RouteLines option={opt} active />
        <OriginPin latitude={ROUTES.origin.lat} longitude={ROUTES.origin.lon} />
        <DestPin latitude={dest.lat} longitude={dest.lon} icon={dest.icon} />
      </MapView>

      {/* top controls */}
      <View style={[styles.top, { top: insets.top + 8 }]}>
        <CircleButton icon="chevron-left" size={52} onPress={() => router.back()} style={shadow(2)} />
        <View style={[styles.titlePill, shadow(2)]}>
          <Icon name="shield-check-outline" size={18} color={C.brand} />
          <Txt w="bold" size={15}>
            {night ? 'Gecə rejimi' : 'Gündüz rejimi'} · 3 variant
          </Txt>
        </View>
        <CircleButton icon="share-variant-outline" size={52} style={shadow(2)} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: H * 0.42, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sheet}>
          {/* From / To */}
          <View style={styles.fromTo}>
            <View style={styles.endpoint}>
              <Txt w="med" size={11} color="rgba(255,255,255,0.6)">
                Haradan
              </Txt>
              <Txt w="xbold" size={14} color="#fff" numberOfLines={1}>
                28 May
              </Txt>
            </View>
            <View style={styles.dashWrap}>
              <View style={styles.dash} />
              <View style={styles.midBadge}>
                <Icon name="clock-outline" size={14} color={C.brand} />
                <Txt w="bold" size={13}>
                  {opt.durationMin} dəq
                </Txt>
              </View>
            </View>
            <View style={styles.endpoint}>
              <Txt w="med" size={11} color="rgba(255,255,255,0.6)">
                Haraya
              </Txt>
              <Txt w="xbold" size={14} color="#fff" numberOfLines={1}>
                {dest.short}
              </Txt>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 12 }}>
            <Txt w="black" size={26} style={{ flex: 1 }} numberOfLines={2}>
              {dest.name}
            </Txt>
            <DemoBadge />
          </View>

          {profile === 'accessible' || lastAhmed?.profile === 'accessible' ? (
            <Pressable onPress={() => router.push('/accessible')} style={styles.accessBanner}>
              <Icon name="wheelchair-accessibility" size={22} color="#fff" />
              <Txt w="semi" size={14} color="#fff" style={{ flex: 1 }}>
                Uşaq arabası / əlil arabası üçün pilləkənsiz variant
              </Txt>
              <Icon name="chevron-right" size={22} color="#fff" />
            </Pressable>
          ) : null}

          <View style={{ gap: 10 }}>
            {options.map((o) => (
              <RouteCard
                key={o.id}
                option={o}
                night={night}
                selected={o.kind === selected}
                recommended={o.kind === 'safest'}
                onPress={() => setSelected(o.kind)}
              />
            ))}
          </View>

          {/* Əhməd */}
          <Pressable onPress={() => speak(reply)} style={styles.ahmed}>
            <View style={styles.ahmedAvatar}>
              <AhmedAvatar size={40} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Txt w="xbold" size={16}>
                  Əhmədin tövsiyəsi
                </Txt>
                {lastAhmed?.destId === destId ? (
                  <Tag label={lastAhmed.source === 'ai' ? 'AI' : 'Offline'} bg={C.brandSoft} color={C.brand} style={{ height: 22 }} />
                ) : null}
              </View>
              <Txt w="med" size={14} color={C.ink2} lh={20} style={{ marginTop: 4 }}>
                {reply}
              </Txt>
            </View>
            <Icon name="volume-high" size={22} color={C.brand} />
          </Pressable>
        </View>
      </ScrollView>

      {/* bottom action bar */}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={{ flex: 1 }}>
          <Txt w="med" size={12.5} color="rgba(255,255,255,0.6)">
            {selected === 'safest' ? 'Tövsiyə olunan' : 'Seçilmiş'}
          </Txt>
          <Txt w="xbold" size={18} color="#fff">
            {opt.durationMin} dəq · {opt.price}
          </Txt>
        </View>
        <PillButton
          label="Yola düş"
          icon="navigation-variant"
          style={{ minWidth: 170 }}
          onPress={() => {
            stopSpeaking();
            router.push(`/navigate?dest=${destId}&kind=${selected}`);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 },
  titlePill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', height: 44, paddingHorizontal: 16, borderRadius: R.pill },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 34, borderTopRightRadius: 34, padding: 18, paddingTop: 20, minHeight: H * 0.6 },
  fromTo: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.brand, borderRadius: R.pill, padding: 6 },
  endpoint: { width: 92, height: 64, borderRadius: 32, backgroundColor: C.black, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  dashWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dash: { position: 'absolute', left: 6, right: 6, borderTopWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.8)' },
  midBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', borderRadius: R.pill, paddingHorizontal: 10, height: 30 },
  accessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.black,
    borderRadius: R.md,
    padding: 14,
    marginBottom: 10,
  },
  ahmed: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.surface,
    borderRadius: R.lg,
    padding: 14,
  },
  ahmedAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.black,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
});
