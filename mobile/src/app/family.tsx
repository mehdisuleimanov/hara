import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming, cancelAnimation } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '@/store/useAppStore';
import { ROUTES } from '@/data/routes';
import { MAP_STYLE } from '@/components/mapStyle';
import { AhmedAvatar, Avatar } from '@/components/Brand';
import { ScoreRing } from '@/components/ScoreRing';
import { Burst, Pop, Pulse } from '@/components/anim';
import { CircleButton, Icon, PillButton, Tag, Txt } from '@/components/ui';
import { PressableScale, SPRING, enter } from '@/motion';
import { makeTrack, pointAt, regionFor, toLatLngs } from '@/utils/geo';
import { triggerFamilyArrival } from '@/utils/notify';
import { say } from '@/voice';
import { BRAND } from '@/voice/lines/brand';
import { C, R, shadow } from '@/theme';

const PRICE = '3,99 ₼';

export default function Family() {
  const subscribed = useAppStore((s) => s.familySubscribed);
  return subscribed ? <Dashboard /> : <Paywall />;
}

/* ------------------------------------------------------------------ paywall */

const FEATURES = [
  { icon: 'school-outline', t: 'Uşağın məktəb yolu', s: 'Marşrutda işıqforsuz keçid olmur' },
  { icon: 'bell-ring-outline', t: 'Çatanda bildiriş', s: 'Məktəbə, evə çatdı — dərhal xəbərin olur' },
  { icon: 'human-cane', t: 'Yaşlıların səfəri', s: 'Nənə yolda olanda canlı izlə' },
  { icon: 'weather-night', t: 'Gecə səfərini paylaş', s: 'Ailən canlı yerini görür' },
  { icon: 'shield-alert-outline', t: 'SOS', s: 'Bir hərəkətlə ailəyə canlı yer' },
];

function Paywall() {
  const insets = useSafeAreaInsets();
  const setSubscribed = useAppStore((s) => s.setFamilySubscribed);
  const showToast = useAppStore((s) => s.showToast);
  const [paying, setPaying] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#EEEEFF', '#F2F7FF', '#FFFFFF']} locations={[0, 0.6, 1]} style={[styles.hero, { paddingTop: insets.top + 8 }]}>
          <CircleButton icon="chevron-left" size={48} bg="rgba(255,255,255,0.8)" onPress={() => router.back()} />
          <View style={styles.cluster}>
            <Animated.View entering={enter(0, 'pop', 80)} style={[styles.clusterItem, { left: 0, top: 46 }]}>
              <Avatar who="nene" size={74} />
            </Animated.View>
            <Animated.View entering={enter(1, 'pop', 80)} style={[styles.clusterItem, { left: 56, top: 8 }]}>
              <Avatar who="aysel" size={86} />
            </Animated.View>
            <Animated.View entering={enter(2, 'pop', 80)} style={[styles.clusterItem, { left: 128, top: 52 }]}>
              <Avatar who="murad" size={70} />
            </Animated.View>
            <Animated.View entering={enter(3, 'pop', 120)} style={{ position: 'absolute', right: 0, top: -6 }}>
              <AhmedAvatar size={112} full mood="wave" />
            </Animated.View>
          </View>
          <Animated.View entering={enter(2, 'up', 120)}>
            <Txt v="overline" color={C.ai}>
              Hara Ailə
            </Txt>
            <Txt v="h1" style={{ marginTop: 6 }} accessibilityRole="header">
              Sevdiklərin də ən az riskli yolla getsin
            </Txt>
          </Animated.View>
        </LinearGradient>

        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          <Animated.View entering={enter(3, 'up', 120)} style={[styles.priceCard, shadow(2)]}>
            <View style={{ flex: 1 }}>
              <Txt v="num">
                {PRICE}
                <Txt v="body" color={C.muted}>
                  {'  / ay'}
                </Txt>
              </Txt>
              <Txt v="caption" color={C.muted} style={{ marginTop: 2 }}>
                5 ailə üzvünə qədər
              </Txt>
            </View>
            <Tag label="7 gün pulsuz" icon="gift-outline" bg={C.brandSoft} color={C.brandDark} />
          </Animated.View>

          {FEATURES.map((f, i) => (
            <Animated.View key={f.t} entering={enter(i + 4, 'up', 120)} style={styles.feature}>
              <View style={styles.fIcon}>
                <Icon name={f.icon} size={22} color={C.ai} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="title">{f.t}</Txt>
                <Txt v="bodyS" color={C.muted}>
                  {f.s}
                </Txt>
              </View>
              <Icon name="check-circle" size={20} color={C.brand} />
            </Animated.View>
          ))}

          <Animated.View entering={enter(9, 'up', 120)}>
            <PillButton
              label={paying ? 'Təsdiqlənir…' : '7 gün pulsuz başla'}
              icon={paying ? 'timer-sand' : 'crown-outline'}
              variant="brand"
              style={{ marginTop: 8 }}
              disabled={paying}
              onPress={() => {
                setPaying(true);
                setTimeout(() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                  setSubscribed(true);
                  showToast('Hara Ailə aktivdir', 'crown-outline');
                }, 1100);
              }}
            />
            <Txt v="caption" color={C.muted} center style={{ marginTop: 10 }}>
              Sonra {PRICE}/ay · istənilən vaxt ləğv et{'\n'}Təhlükəsizlik funksiyaları hər kəs üçün pulsuzdur
            </Txt>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ dashboard */

function LiveBar({ progress, arrived }: { progress: number; arrived: boolean }) {
  const v = useSharedValue(progress);
  useEffect(() => {
    v.value = withTiming(progress, { duration: 420, easing: Easing.out(Easing.quad) });
  }, [progress, v]);
  const fill = useAnimatedStyle(() => ({ width: `${Math.round(v.value * 1000) / 10}%` }));
  return (
    <View style={styles.bar}>
      <Animated.View style={[styles.barFill, { backgroundColor: arrived ? C.brand : C.route }, fill]} />
    </View>
  );
}

/** Hold-to-send SOS (1.2 s) so it never fires by accident. */
function SosButton({ onFire }: { onFire: () => void }) {
  const p = useSharedValue(0);
  const fired = useRef(false);
  const showToast = useAppStore((s) => s.showToast);
  const fill = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="SOS, basıb saxla"
      onPressIn={() => {
        fired.current = false;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        p.value = withTiming(1, { duration: 1200, easing: Easing.linear });
      }}
      onLongPress={() => {
        fired.current = true;
        p.value = withTiming(0, { duration: 300 });
        onFire();
      }}
      delayLongPress={1200}
      onPressOut={() => {
        if (!fired.current) {
          cancelAnimation(p);
          p.value = withSpring(0, SPRING.snappy);
        }
      }}
      onPress={() => showToast('SOS üçün düyməni basıb saxla', 'gesture-tap-hold')}
      style={styles.sos}
    >
      <Animated.View style={[styles.sosFill, fill]} />
      <Icon name="shield-alert" size={24} color="#FFFFFF" />
      <Txt w="xbold" size={17} color="#FFFFFF">
        SOS
      </Txt>
      <Txt w="semi" size={13} color="rgba(255,255,255,0.85)">
        · basıb saxla
      </Txt>
    </Pressable>
  );
}

function Member({ i, who, name, status, tone, right }: { i: number; who: 'aysel' | 'murad' | 'nene'; name: string; status: string; tone: 'safe' | 'live' | 'muted'; right?: React.ReactNode }) {
  const col = tone === 'safe' ? C.brandDark : tone === 'live' ? C.route : C.muted;
  const bg = tone === 'safe' ? C.brandSoft : tone === 'live' ? C.purple : C.bg2;
  return (
    <Animated.View entering={enter(i, 'up', 160)} style={styles.member}>
      <Avatar who={who} size={52} />
      <View style={{ flex: 1, gap: 5 }}>
        <Txt v="title">{name}</Txt>
        <Tag label={status} bg={bg} color={col} icon={tone === 'safe' ? 'check-circle' : tone === 'live' ? 'walk' : 'moon-waning-crescent'} />
      </View>
      {right}
    </Animated.View>
  );
}

function Dashboard() {
  const insets = useSafeAreaInsets();
  const showToast = useAppStore((s) => s.showToast);
  const f = ROUTES.family;
  const nene = useMemo(() => makeTrack(toLatLngs(f.nene.c)), [f]);
  const murad = useMemo(() => toLatLngs(f.murad.c), [f]);
  const region = useMemo(() => regionFor([...nene.pts, ...murad], 1.5), [nene, murad]);
  const [progress, setProgress] = useState(0.2);
  const [arrived, setArrived] = useState(false);
  const [shareNight, setShareNight] = useState(true);
  const [notifyArrival, setNotifyArrival] = useState(true);
  const [sos, setSos] = useState(false);
  const fired = useRef(false);
  const notifyRef = useRef(notifyArrival);
  notifyRef.current = notifyArrival;

  useEffect(() => {
    if (arrived) return;
    const id = setInterval(() => {
      setProgress((p) => {
        const np = Math.min(1, p + 0.02);
        if (np >= 1 && !fired.current) {
          fired.current = true;
          setTimeout(() => {
            setArrived(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            say(BRAND.neneArrived);
            if (notifyRef.current) triggerFamilyArrival('Nənə');
          }, 0);
        }
        return np;
      });
    }, 450);
    return () => clearInterval(id);
  }, [arrived]);

  const pos = pointAt(nene, nene.total * progress).p;
  const remaining = Math.max(1, Math.round((nene.total * (1 - progress)) / 1.1 / 60));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: insets.bottom + 28, gap: 12 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={enter(0, 'fade')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <CircleButton icon="chevron-left" size={48} onPress={() => router.back()} />
          <View style={{ flex: 1 }}>
            <Txt v="h1" accessibilityRole="header">
              Ailəm
            </Txt>
          </View>
          <Tag label="Hara Ailə" icon="crown-outline" bg={C.aiSoft} color={C.ai} style={{ height: 34, paddingHorizontal: 12 }} />
        </Animated.View>

        {/* live hero: Nənə on her way → arrived */}
        <Animated.View entering={enter(1, 'up')} style={[styles.live, arrived && { backgroundColor: C.brandSoft }, shadow(1)]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              {arrived ? null : <Pulse size={78} color={C.route} />}
              <Avatar who="nene" size={62} />
              {arrived ? (
                <Pop style={styles.okBadge}>
                  <Icon name="check" size={16} color="#FFFFFF" />
                </Pop>
              ) : null}
              {arrived ? <Burst size={180} /> : null}
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Txt v="overline" color={arrived ? C.brandDark : C.route}>
                {arrived ? 'Çatdı · indi' : 'Canlı · yoldadır'}
              </Txt>
              <Txt v="h3">{arrived ? 'Nənə evə çatdı' : 'Nənə evə gedir'}</Txt>
              <Txt v="bodyS" color={C.ink2}>
                {arrived ? 'Yolda işıqforsuz keçid olmadı.' : `${remaining} dəq qalıb · işıqforlu keçidlərlə`}
              </Txt>
            </View>
            <ScoreRing score={92} size={58} />
          </View>
          <LiveBar progress={progress} arrived={arrived} />
        </Animated.View>

        <Animated.View entering={enter(2, 'up')} style={styles.mapWrap}>
          <MapView
            style={StyleSheet.absoluteFill}
            mapType="standard"
            customMapStyle={MAP_STYLE}
            initialRegion={region}
            toolbarEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            <Polyline coordinates={murad} strokeColor={C.brand} strokeWidth={5} lineCap="round" />
            <Polyline coordinates={nene.pts} strokeColor={C.halo} strokeWidth={14} lineCap="round" />
            <Polyline coordinates={nene.pts} strokeColor={C.route} strokeWidth={5.5} lineCap="round" lineJoin="round" />
            <Marker coordinate={{ latitude: f.home.lat, longitude: f.home.lon }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={[styles.place, { backgroundColor: C.navy }]}>
                <Icon name="home-variant" size={16} color="#FFFFFF" />
              </View>
            </Marker>
            <Marker coordinate={{ latitude: f.school.lat, longitude: f.school.lon }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={[styles.place, { backgroundColor: C.brand }]}>
                <Icon name="school" size={16} color="#FFFFFF" />
              </View>
            </Marker>
            <Marker coordinate={pos} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={30}>
              <View style={styles.neneDot}>
                <Txt w="xbold" size={13} color="#FFFFFF">
                  N
                </Txt>
              </View>
            </Marker>
          </MapView>
          <View style={styles.mapLabel}>
            <Icon name="traffic-light" size={15} color={C.brandDark} />
            <Txt v="label">Bütün keçidlər işıqforludur</Txt>
          </View>
        </Animated.View>

        <Member i={3} who="murad" name="Murad · 11 yaş" status="Məktəbə çatdı · 08:12" tone="safe" right={<ScoreRing score={88} size={44} showShield={false} />} />
        <Member
          i={4}
          who="nene"
          name="Nənə"
          status={arrived ? 'Evdədir' : `Yoldadır · ${remaining} dəq`}
          tone={arrived ? 'safe' : 'live'}
          right={<CircleButton icon="phone-outline" size={44} bg={C.bg2} label="Nənəyə zəng et" onPress={() => showToast('Nənəyə zəng edilir…', 'phone')} />}
        />
        <Member i={5} who="aysel" name="Sən" status={shareNight ? 'Gecə səfərləri paylaşılır' : 'Paylaşım söndürülüb'} tone="muted" />

        <Animated.View entering={enter(6, 'up', 160)} style={styles.toggles}>
          <View style={styles.toggleRow}>
            <Icon name="weather-night" size={20} color={C.ink2} />
            <Txt v="title" style={{ flex: 1 }}>
              Gecə səfərini paylaş
            </Txt>
            <Switch value={shareNight} onValueChange={(v) => (Haptics.selectionAsync().catch(() => {}), setShareNight(v))} trackColor={{ true: C.brand, false: C.line }} thumbColor="#FFFFFF" />
          </View>
          <View style={styles.divider} />
          <View style={styles.toggleRow}>
            <Icon name="bell-ring-outline" size={20} color={C.ink2} />
            <Txt v="title" style={{ flex: 1 }}>
              Çatanda bildiriş
            </Txt>
            <Switch value={notifyArrival} onValueChange={(v) => (Haptics.selectionAsync().catch(() => {}), setNotifyArrival(v))} trackColor={{ true: C.brand, false: C.line }} thumbColor="#FFFFFF" />
          </View>
        </Animated.View>

        <Animated.View entering={enter(7, 'up', 160)}>
          <SosButton
            onFire={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
              setSos(true);
              say(BRAND.sosSent);
            }}
          />
        </Animated.View>
      </ScrollView>

      <Modal visible={sos} transparent animationType="fade" onRequestClose={() => setSos(false)} statusBarTranslucent>
        <View style={styles.backdrop}>
          <Animated.View entering={enter(0, 'pop')} style={styles.modal}>
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Pulse size={120} color={C.danger} />
              <View style={styles.sosIcon}>
                <Icon name="shield-alert" size={38} color="#FFFFFF" />
              </View>
            </View>
            <Txt v="h2" center style={{ marginTop: 14 }}>
              SOS göndərildi
            </Txt>
            <Txt v="body" color={C.ink2} center style={{ marginTop: 8 }}>
              Ailənə canlı yerin və marşrutun göndərildi. Ən yaxın işıqlı, insanlı yer: Gənclik metrosu.
            </Txt>
            <View style={styles.sosRow}>
              <AhmedAvatar size={34} mood="alert" />
              <Txt v="bodyS" color={C.ink2} style={{ flex: 1 }}>
                Narahat olma, yanındayam. Lazım olsa 112-yə bir toxunuşla zəng et.
              </Txt>
            </View>
            <PillButton label="112-yə zəng et" icon="phone" variant="danger" style={{ marginTop: 16, alignSelf: 'stretch' }} onPress={() => showToast('112 xidmətinə zəng edilir…', 'phone')} />
            <PressableScale accessibilityRole="button" onPress={() => setSos(false)} style={styles.close}>
              <Txt w="semi" size={15} color={C.ink2}>
                Bağla
              </Txt>
            </PressableScale>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 22, gap: 6 },
  cluster: { height: 140, marginTop: 4, marginBottom: 6 },
  clusterItem: { position: 'absolute', borderRadius: 60, ...shadow(1) },
  priceCard: { backgroundColor: C.bg, borderRadius: R.lg, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.line },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surface, borderRadius: R.lg, padding: 14 },
  fIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.aiSoft, alignItems: 'center', justifyContent: 'center' },
  live: { backgroundColor: C.surface, borderRadius: R.lg, padding: 16, gap: 14 },
  okBadge: { position: 'absolute', right: -4, bottom: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: C.brand, borderWidth: 2.5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  bar: { height: 8, borderRadius: 4, backgroundColor: 'rgba(15,27,45,0.08)', overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  mapWrap: { height: 210, borderRadius: R.lg, overflow: 'hidden', backgroundColor: C.surface },
  mapLabel: { position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 7 },
  place: { width: 30, height: 30, borderRadius: 15, borderWidth: 2.5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  neneDot: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.ai, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  member: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surface, borderRadius: R.lg, padding: 12 },
  toggles: { backgroundColor: C.surface, borderRadius: R.lg, paddingHorizontal: 16 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 58 },
  divider: { height: 1, backgroundColor: C.line },
  sos: { height: 62, borderRadius: R.pill, backgroundColor: C.danger, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' },
  sosFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.22)' },
  backdrop: { flex: 1, backgroundColor: C.scrim, justifyContent: 'center', padding: 22 },
  modal: { backgroundColor: C.bg, borderRadius: 32, padding: 24, alignItems: 'center' },
  sosIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' },
  sosRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderRadius: R.md, padding: 12, marginTop: 14, alignSelf: 'stretch' },
  close: { height: 48, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', marginTop: 6 },
});
