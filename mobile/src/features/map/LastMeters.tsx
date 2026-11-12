import React, { memo, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Marker, Polyline } from 'react-native-maps';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import type { LastMeters, LatLng } from '@/data/types';
import { sliceByFraction } from '@/motion/routeDraw';
import { PressableScale } from '@/motion/PressableScale';
import { Pulse } from '@/components/anim';
import { AhmedAvatar } from '@/components/Brand';
import { CircleButton, Icon, Txt } from '@/components/ui';
import { C, R, shadow } from '@/theme';
import { toLatLngs } from '@/utils/geo';
import { NAV } from '@/voice/lines/nav';
import { Anchored, type MapOverlayApi } from './overlay';
import { midpoint } from './geometry';

/** Red "N zolaq" pill (content shared by the overlay and the web Marker fallback). */
function LanesPill({ lanes }: { lanes: number }) {
  return (
    <View style={styles.lanes}>
      <Icon name="close-octagon" size={15} color="#FFFFFF" />
      <Txt w="black" size={13.5} color="#FFFFFF">
        {lanes} zolaq
      </Txt>
    </View>
  );
}

function PinBadge({ icon, bg, size = 40 }: { icon: string; bg: string; size?: number }) {
  return (
    <View style={{ padding: 4 }}>
      <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
        <Icon name={icon} size={size * 0.5} color="#FFFFFF" />
      </View>
    </View>
  );
}

/**
 * Map part of "Son 50 metr": the risky straight line over the road (red), the safe walk to
 * the signalized crossing (green), the crossing badge and the taxi drop pin (tweened when
 * the drop-off point is moved).
 */
export const LastMetersLayer = memo(function LastMetersLayer({
  lm,
  drop,
  dest,
  tRed,
  tGreen,
  moved,
}: {
  lm: LastMeters;
  /** current (tweened) taxi pin position */
  drop: LatLng;
  dest: LatLng;
  tRed: number;
  tGreen: number;
  moved: boolean;
}) {
  const direct = useMemo(() => toLatLngs(lm.directC), [lm.directC]);
  const safe = useMemo(() => toLatLngs(lm.safeC), [lm.safeC]);
  const redPts = useMemo(() => sliceByFraction(direct, tRed), [direct, tRed]);
  const greenPts = useMemo(() => (moved ? [drop, dest] : sliceByFraction(safe, tGreen)), [moved, drop, dest, safe, tGreen]);
  const mid = useMemo(() => midpoint(direct), [direct]);
  return (
    <>
      {!moved && redPts.length > 1 ? (
        <>
          <Polyline coordinates={redPts} strokeColor="#FFFFFF" strokeWidth={13} lineCap="round" zIndex={40} />
          <Polyline coordinates={redPts} strokeColor={C.danger} strokeWidth={7} lineCap="round" lineDashPattern={[14, 10]} zIndex={41} />
        </>
      ) : null}
      {greenPts.length > 1 && (moved || tGreen > 0) ? (
        <>
          <Polyline coordinates={greenPts} strokeColor="#FFFFFF" strokeWidth={13} lineCap="round" lineJoin="round" zIndex={42} />
          <Polyline coordinates={greenPts} strokeColor={C.brand} strokeWidth={7} lineCap="round" lineJoin="round" zIndex={43} />
        </>
      ) : null}
      {!moved && lm.crossing && tGreen > 0.5 ? (
        <Marker coordinate={{ latitude: lm.crossing.lat, longitude: lm.crossing.lon }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={50}>
          <PinBadge icon={lm.crossing.type === 3 ? 'stairs-down' : 'traffic-light'} bg={C.brand} size={34} />
        </Marker>
      ) : null}
      <Marker coordinate={drop} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={52}>
        <PinBadge icon="taxi" bg={C.navy} />
      </Marker>
      {/* web preview: the pulsing overlay isn't available -> static label */}
      {Platform.OS === 'web' && !moved && mid && tRed >= 1 ? (
        <Marker coordinate={mid} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={55}>
          <LanesPill lanes={lm.lanes} />
        </Marker>
      ) : null}
    </>
  );
});

/** Native: pulsing "N zolaq" label over the middle of the risky line (screen overlay). */
export function LastMetersLabel({ api, lm, visible }: { api: MapOverlayApi; lm: LastMeters; visible: boolean }) {
  const mid = useMemo(() => midpoint(toLatLngs(lm.directC)), [lm.directC]);
  if (!visible || !mid) return null;
  return (
    <Anchored api={api} coordinate={mid} anchor={{ x: 0.5, y: 0.5 }}>
      <View style={{ width: 120, height: 64, alignItems: 'center', justifyContent: 'center' }}>
        <Pulse size={64} color={C.danger} duration={1500} style={{ left: 28, top: 0 }} />
        <LanesPill lanes={lm.lanes} />
      </View>
    </Anchored>
  );
}

function Tile({ tone, icon, value, label }: { tone: 'danger' | 'safe'; icon: string; value: string; label: string }) {
  const bg = tone === 'danger' ? C.dangerSoft : C.safeSoft;
  const fg = tone === 'danger' ? '#B4232A' : '#0A7A47';
  return (
    <View style={[styles.tile, { backgroundColor: bg }]}>
      <Icon name={icon} size={20} color={fg} />
      <View style={{ flex: 1 }}>
        <Txt w="black" size={16} color={fg} numberOfLines={1}>
          {value}
        </Txt>
        <Txt w="semi" size={12} color={fg} numberOfLines={2}>
          {label}
        </Txt>
      </View>
    </View>
  );
}

/** Bottom card of the "Son 50 metr" view. */
export function LastMetersCard({
  lm,
  moved,
  speaking,
  bottomInset,
  onMove,
  onRevert,
  onSend,
  onSpeak,
  onClose,
}: {
  lm: LastMeters;
  moved: boolean;
  speaking: boolean;
  bottomInset: number;
  onMove: () => void;
  onRevert: () => void;
  onSend: () => void;
  onSpeak: () => void;
  onClose: () => void;
}) {
  const crossingWord = lm.crossing?.type === 3 ? 'yeraltı keçidlə' : 'işıqforlu keçidlə';
  return (
    <Animated.View entering={FadeInDown.springify().damping(20).stiffness(170)} style={[styles.card, { paddingBottom: Math.max(bottomInset, 12) + 6 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Txt v="overline" color={moved ? C.brandDark : C.danger}>
            Son 50 metr · {lm.street}
          </Txt>
          <Animated.View key={moved ? 'm' : 'w'} entering={FadeIn.duration(260)}>
            <Txt v="h3" style={{ marginTop: 4 }}>
              {moved ? 'Düşmə nöqtəsi dəyişdi' : lm.wrongSide ? 'Taksi səni qarşı tərəfdə düşürür' : 'Düşmə nöqtəsinə diqqət'}
            </Txt>
          </Animated.View>
        </View>
        <CircleButton icon="close" size={40} bg={C.bg2} label="Marşrutlara qayıt" onPress={onClose} />
      </View>

      <Animated.View layout={LinearTransition.springify().damping(20)} style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        {moved ? (
          <>
            <Tile tone="safe" icon="check-decagram" value="Keçid yoxdur" label={lm.betterDrop?.label ?? 'Giriş bu tərəfdədir'} />
            <Tile tone="safe" icon="clock-fast" value={`−${Math.max(1, lm.extraMin)} dəq`} label="piyada yol qısaldı" />
          </>
        ) : (
          <>
            <Tile tone="danger" icon="alert-octagon-outline" value={`${lm.lanes} zolaq`} label="birbaşa keçmək riskli" />
            <Tile tone="safe" icon={lm.crossing?.type === 3 ? 'stairs-down' : 'traffic-light'} value={`+${Math.max(1, lm.extraMin)} dəq`} label={`${crossingWord} · ${Math.round(lm.extraM / 10) * 10}\u00A0m`} />
          </>
        )}
      </Animated.View>

      <PressableScale accessibilityRole="button" accessibilityLabel="Əhmədi dinlə" onPress={onSpeak} style={styles.ahmed}>
        <View style={styles.ahmedArt}>
          <AhmedAvatar size={30} mood={speaking ? 'talk' : 'smile'} />
        </View>
        <Txt w="med" size={13.5} color={C.ink2} style={{ flex: 1 }} numberOfLines={3}>
          {moved ? NAV.dropMoved : lm.note || NAV.lastMetersFallback}
        </Txt>
        <View style={styles.play}>
          <Icon name={speaking ? 'volume-high' : 'play'} size={18} color="#FFFFFF" />
        </View>
      </PressableScale>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        {moved ? (
          <>
            <ActionBtn label="Əvvəlki nöqtə" icon="undo-variant" variant="ghost" onPress={onRevert} />
            <ActionBtn label="Sürücüyə göndər" icon="send" variant="brand" onPress={onSend} grow />
          </>
        ) : (
          <>
            {lm.betterDrop ? <ActionBtn label="Düşmə nöqtəsini dəyiş" icon="map-marker-path" variant="brand" onPress={onMove} grow /> : null}
            <ActionBtn label="Sürücüyə göndər" icon="send" variant={lm.betterDrop ? 'ghost' : 'brand'} onPress={onSend} grow={!lm.betterDrop} />
          </>
        )}
      </View>
    </Animated.View>
  );
}

function ActionBtn({ label, icon, variant, onPress, grow }: { label: string; icon: string; variant: 'brand' | 'ghost'; onPress: () => void; grow?: boolean }) {
  const brand = variant === 'brand';
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      haptic="medium"
      scaleTo={0.97}
      onPress={onPress}
      style={[styles.action, grow ? { flex: brand ? 1.25 : 1 } : { paddingHorizontal: 16 }, brand ? { backgroundColor: C.brand } : { backgroundColor: C.bg2 }]}
    >
      <Icon name={icon} size={19} color={brand ? '#FFFFFF' : C.ink} />
      <Txt w="bold" size={14} color={brand ? '#FFFFFF' : C.ink} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flexShrink: 1 }}>
        {label}
      </Txt>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  lanes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: C.danger,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...shadow(2),
  },
  badge: { alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFFFFF', ...shadow(2) },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 18,
    ...shadow(3),
  },
  tile: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 10 },
  ahmed: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.aiSoft, borderRadius: 18, padding: 10, marginTop: 12 },
  ahmedArt: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  play: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.ai, alignItems: 'center', justifyContent: 'center' },
  action: { height: 52, borderRadius: R.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12 },
});
