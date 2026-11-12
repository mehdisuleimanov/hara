import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Switch, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '@/store/useAppStore';
import { ROUTES } from '@/data/routes';
import { MAP_STYLE_FOR_TYPE, MAP_TYPE, mapTypeFor, useSatelliteType } from '@/components/mapStyle';
import { IconPin } from '@/components/RouteLines';
import { AhmedAvatar, Avatar } from '@/components/Brand';
import { ScoreRing } from '@/components/ScoreRing';
import { CircleButton, Heading, Icon, PillButton, Tag, Txt } from '@/components/ui';
import { makeTrack, pointAt, regionFor, toLatLngs } from '@/utils/geo';
import { triggerFamilyArrival } from '@/utils/notify';
import { C, R, shadow } from '@/theme';

const PRICE = '3,99 ₼';

export default function Family() {
  const subscribed = useAppStore((s) => s.familySubscribed);
  return subscribed ? <Dashboard /> : <Paywall />;
}

function Paywall() {
  const insets = useSafeAreaInsets();
  const setSubscribed = useAppStore((s) => s.setFamilySubscribed);
  const showToast = useAppStore((s) => s.showToast);
  const [paying, setPaying] = useState(false);
  const FEATURES = [
    { icon: 'school-outline', t: 'Uşağın məktəb yolu', s: 'Marşrutda işıqforsuz keçid olmur' },
    { icon: 'bell-ring-outline', t: 'Çatanda bildiriş', s: 'Məktəbə, evə çatdı — dərhal xəbər' },
    { icon: 'human-cane', t: 'Yaşlıların səfəri', s: 'Nənə-baba səfərdə olanda izlə' },
    { icon: 'weather-night', t: 'Gecə səfərini paylaş', s: 'Ailə canlı yeri görür' },
    { icon: 'shield-alert-outline', t: 'SOS düyməsi', s: 'Bir toxunuşla ailəyə canlı yer' },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <LinearGradient colors={[C.purple, '#D6E6FF']} style={[styles.hero, { paddingTop: insets.top + 8 }]}>
          <CircleButton icon="chevron-left" size={52} onPress={() => router.back()} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 18 }}>
            <View style={{ flex: 1 }}>
              <Tag label="PREMIUM" bg="rgba(255,255,255,0.25)" color={C.ink} />
              <Heading light="Hara" bold="Ailə" size={40} color={C.ink} style={{ marginTop: 10 }} />
              <Txt w="semi" size={16} color={C.muted} style={{ marginTop: 6 }}>
                Sevdiklərinin yolu da{'\n'}ən az riskli olsun
              </Txt>
            </View>
            <AhmedAvatar size={100} full />
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: 18, marginTop: -26 }}>
          <View style={[styles.priceCard, shadow(2)]}>
            <View>
              <Txt w="black" size={34}>
                {PRICE}
                <Txt w="semi" size={16} color={C.muted}>
                  {' '}
                  / ay
                </Txt>
              </Txt>
              <Txt w="med" size={13.5} color={C.muted}>
                5 ailə üzvünə qədər · 7 gün pulsuz
              </Txt>
            </View>
            <Tag label="Ucuz və əlçatan" bg={C.brand} color={C.navy} />
          </View>

          <View style={{ gap: 10, marginTop: 14 }}>
            {FEATURES.map((f) => (
              <View key={f.t} style={styles.feature}>
                <View style={styles.fIcon}>
                  <Icon name={f.icon} size={24} color={C.navy} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt w="bold" size={16}>
                    {f.t}
                  </Txt>
                  <Txt w="med" size={13.5} color={C.muted}>
                    {f.s}
                  </Txt>
                </View>
                <Icon name="check-circle" size={22} color={C.safe} />
              </View>
            ))}
          </View>

          <PillButton
            label={paying ? 'Ödəniş təsdiqlənir…' : `Abunə ol · ${PRICE}/ay`}
            variant="black"
            style={{ marginTop: 18 }}
            disabled={paying}
            onPress={() => {
              setPaying(true);
              setTimeout(() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                setSubscribed(true);
                showToast('Hara Ailə aktivdir', 'crown-outline');
              }, 1300);
            }}
          />
          <Txt w="med" size={12.5} color={C.muted} center style={{ marginTop: 10 }}>
            İstənilən vaxt ləğv et · Demo: ödəniş simulyasiyadır{'\n'}Standart paketdə bütün təhlükəsizlik funksiyaları pulsuzdur
          </Txt>
        </View>
      </ScrollView>
    </View>
  );
}

function Dashboard() {
  const insets = useSafeAreaInsets();
  const showToast = useAppStore((s) => s.showToast);
  const f = ROUTES.family;
  const nene = useMemo(() => makeTrack(toLatLngs(f.nene.c)), [f]);
  const murad = useMemo(() => toLatLngs(f.murad.c), [f]);
  const region = useMemo(() => regionFor([...nene.pts, ...murad], 1.5), [nene, murad]);
  const sat = useSatelliteType(region.latitudeDelta);
  const [progress, setProgress] = useState(0.18);
  const [arrived, setArrived] = useState(false);
  const [shareNight, setShareNight] = useState(true);
  const [notifyArrival, setNotifyArrival] = useState(true);
  const [sos, setSos] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => {
        const np = Math.min(1, p + 0.012);
        if (np >= 1 && !fired.current) {
          fired.current = true;
          setArrived(true);
          if (notifyArrival) triggerFamilyArrival('Nənə');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        return np;
      });
    }, 500);
    return () => clearInterval(id);
  }, [notifyArrival]);

  const pos = pointAt(nene, nene.total * progress).p;
  const remaining = Math.max(0, Math.round((nene.total * (1 - progress)) / 1.1 / 60));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <CircleButton icon="chevron-left" size={52} onPress={() => router.back()} />
          <Heading light="Hara" bold="Ailə" size={32} style={{ flex: 1 }} />
          <Tag label="Premium" icon="crown-outline" bg={C.brand} color={C.navy} style={{ height: 36, paddingHorizontal: 14 }} />
        </View>

        {/* reference "Connecting…" visual */}
        <View style={styles.connect}>
          <Txt w="semi" size={17} center>
            {arrived ? 'Nənə evə çatdı ✓' : 'Bağlantı aktivdir…'}
          </Txt>
          <View style={styles.connectStage}>
            <View style={styles.orbit} />
            <View style={styles.orbitIcon}>
              <Icon name={arrived ? 'home-heart' : 'walk'} size={24} color={C.navy} />
            </View>
            <View style={[styles.bigCircle, { backgroundColor: C.brand, left: 22, top: 0 }]}>
              <Avatar size={74} initials="A" />
              <Txt w="semi" size={14} color="#FFFFFF" style={{ marginTop: 6 }}>
                Sən
              </Txt>
            </View>
            <View style={[styles.bigCircle, { backgroundColor: C.route, right: 22, top: 86 }]}>
              <Avatar size={74} initials="N" />
              <Txt w="semi" size={14} color="#FFFFFF" style={{ marginTop: 6 }}>
                Nənə
              </Txt>
            </View>
            <View style={styles.linkPill}>
              <Icon name="link-variant" size={26} color={C.brand} />
            </View>
          </View>
        </View>

        <View style={[styles.member, { marginTop: 12 }]}>
          <Avatar size={64} initials="M" />
          <View style={{ flex: 1 }}>
            <Txt w="xbold" size={19}>
              Murad · 11 yaş
            </Txt>
            <Tag label="Məktəbə çatdı · 08:12" icon="check-circle" bg={C.safeSoft} color={C.safe} style={{ marginTop: 6 }} />
          </View>
        </View>

        <View style={styles.member}>
          <Avatar size={64} initials="N" />
          <View style={{ flex: 1 }}>
            <Txt w="xbold" size={19}>
              Nənə
            </Txt>
            <Tag
              label={arrived ? 'Evə çatdı ✓' : `Səfərdədir · ${remaining} dəq qalıb`}
              bg={arrived ? C.safeSoft : C.brandSoft}
              color={arrived ? C.safe : C.navy}
              style={{ marginTop: 6 }}
            />
          </View>
          <ScoreRing score={92} size={64} />
        </View>

        <View style={styles.mapWrap}>
          <MapView provider={PROVIDER_GOOGLE} style={StyleSheet.absoluteFill} mapType={sat.mapType} onRegionChangeComplete={sat.onRegionChangeComplete} customMapStyle={MAP_STYLE_FOR_TYPE} initialRegion={region} toolbarEnabled={false}>
            <Polyline coordinates={murad} strokeColor={C.safe} strokeWidth={6} lineCap="round" />
            <Polyline coordinates={nene.pts} strokeColor={C.halo} strokeWidth={14} lineCap="round" />
            <Polyline coordinates={nene.pts} strokeColor={C.route} strokeWidth={6} lineCap="round" />
            <IconPin latitude={f.home.lat} longitude={f.home.lon} icon="home-outline" bg={C.black} color={C.ink} />
            <IconPin latitude={f.school.lat} longitude={f.school.lon} icon="school-outline" bg={C.safe} color={C.ink} />
            <Marker coordinate={pos} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={30}>
              <View style={styles.neneDot}>
                <Txt w="xbold" size={14} color={C.navy}>
                  N
                </Txt>
              </View>
            </Marker>
          </MapView>
          <View style={styles.mapLabel}>
            <Txt w="semi" size={13}>
              Məktəb yolu · işıqforsuz keçid yoxdur
            </Txt>
          </View>
        </View>

        <View style={styles.toggles}>
          <View style={styles.toggleRow}>
            <Txt w="semi" size={16}>
              Gecə səfərini paylaş
            </Txt>
            <Switch value={shareNight} onValueChange={setShareNight} trackColor={{ true: C.brand }} thumbColor="#fff" />
          </View>
          <View style={styles.divider} />
          <View style={styles.toggleRow}>
            <Txt w="semi" size={16}>
              Gəlişdə bildiriş
            </Txt>
            <Switch value={notifyArrival} onValueChange={setNotifyArrival} trackColor={{ true: C.brand }} thumbColor="#fff" />
          </View>
        </View>

        <PillButton
          label="SOS"
          icon="shield-alert-outline"
          variant="danger"
          height={64}
          style={{ marginTop: 14 }}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
            setSos(true);
          }}
        />
        <PillButton label="Zəng et" icon="phone-outline" variant="white" style={{ marginTop: 10 }} onPress={() => showToast('Demo: zəng simulyasiyası', 'phone')} />
      </ScrollView>

      <Modal visible={sos} transparent animationType="fade" onRequestClose={() => setSos(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <View style={[styles.okIcon, { backgroundColor: C.danger }]}>
              <Icon name="shield-alert" size={40} color={C.ink} />
            </View>
            <Txt w="black" size={24} center style={{ marginTop: 14 }}>
              SOS göndərildi
            </Txt>
            <Txt w="med" size={15} color={C.ink2} center style={{ marginTop: 8 }}>
              Ailə üzvlərinə canlı yer və marşrut göndərildi.{'\n'}Yaxınlıqdakı işıqlı, insanlı yer: Gənclik m.
            </Txt>
            <Txt w="med" size={12.5} color={C.muted} center style={{ marginTop: 10 }}>
              Demo rejimi · real zəng edilmir
            </Txt>
            <PillButton label="Bağla" variant="black" style={{ marginTop: 18, alignSelf: 'stretch' }} onPress={() => setSos(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 18, paddingBottom: 48, borderBottomLeftRadius: 36, borderBottomRightRadius: 36 },
  priceCard: { backgroundColor: C.surface, borderRadius: R.card, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surface, borderRadius: R.lg, padding: 14 },
  fIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' },
  connect: { backgroundColor: C.surface, borderRadius: R.card, paddingTop: 18, paddingBottom: 10, marginTop: 16, overflow: 'hidden' },
  connectStage: { height: 250, marginTop: 6 },
  orbit: {
    position: 'absolute',
    left: '50%',
    top: 18,
    width: 210,
    height: 210,
    marginLeft: -105,
    borderRadius: 105,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#9AA1B2',
  },
  orbitIcon: { position: 'absolute', right: 44, top: 14, width: 44, height: 44, borderRadius: 22, backgroundColor: C.bg2, alignItems: 'center', justifyContent: 'center' },
  bigCircle: { position: 'absolute', width: 150, height: 150, borderRadius: 75, alignItems: 'center', justifyContent: 'center' },
  linkPill: {
    position: 'absolute',
    left: '50%',
    top: 106,
    marginLeft: -38,
    width: 76,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.navy,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  member: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surface, borderRadius: R.card, padding: 14, marginTop: 10 },
  mapWrap: { height: 230, borderRadius: R.card, overflow: 'hidden', marginTop: 12, backgroundColor: C.surface },
  mapLabel: { position: 'absolute', left: 12, bottom: 12, backgroundColor: C.surface, borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 8 },
  neneDot: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.brand, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  toggles: { backgroundColor: C.surface, borderRadius: R.lg, paddingHorizontal: 16, marginTop: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 58 },
  divider: { height: 1, backgroundColor: C.line },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 22 },
  modal: { backgroundColor: C.bg, borderRadius: 34, padding: 24, alignItems: 'center' },
  okIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
});
