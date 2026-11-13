import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { PressableScale } from '@/motion/PressableScale';
import { SPRING } from '@/motion/springs';
import { useAppStore, useIsNight } from '@/store/useAppStore';
import { usePrefs } from '@/store/prefs';
import { Icon, Txt } from '@/components/ui';
import { C, shadow } from '@/theme';

/** Sun ⇄ moon morph: the outgoing glyph spins and shrinks away while the new one springs in. */
export function DayNightIcon({ night, size = 22, color = C.ink }: { night: boolean; size?: number; color?: string }) {
  const v = useSharedValue(night ? 1 : 0);
  useEffect(() => {
    v.value = withSpring(night ? 1 : 0, SPRING.gentle);
  }, [night, v]);
  const sun = useAnimatedStyle(() => ({
    opacity: interpolate(v.value, [0, 0.6], [1, 0], 'clamp'),
    transform: [{ rotate: `${v.value * 120}deg` }, { scale: interpolate(v.value, [0, 1], [1, 0.3]) }],
  }));
  const moon = useAnimatedStyle(() => ({
    opacity: interpolate(v.value, [0.4, 1], [0, 1], 'clamp'),
    transform: [{ rotate: `${(v.value - 1) * 90}deg` }, { scale: interpolate(v.value, [0, 1], [0.3, 1]) }],
  }));
  return (
    <View style={{ width: size + 4, height: size + 4, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, sun]}>
        <Icon name="white-balance-sunny" size={size} color={night ? color : C.warn} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, moon]}>
        <Icon name="weather-night" size={size} color={C.ai} />
      </Animated.View>
    </View>
  );
}

/**
 * Cinematic day/night veil: a quick tinted wash over the map while the style, the safety
 * layer and the scores swap underneath. Mount once per map screen.
 */
export function NightVeil({ night }: { night: boolean }) {
  const first = useRef(true);
  const v = useSharedValue(0);
  const tone = useSharedValue(night ? 1 : 0);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    tone.value = night ? 1 : 0;
    v.value = withSequence(withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 620, easing: Easing.inOut(Easing.quad) }));
  }, [night, v, tone]);
  const a = useAnimatedStyle(() => ({
    opacity: v.value * 0.55,
    backgroundColor: tone.value > 0.5 ? '#0B1426' : '#FFFFFF',
  }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, a]} />;
}

/** Toggle helpers shared by the map screens. */
export function useDayNightToggle() {
  const night = useIsNight();
  const setTimeMode = useAppStore((s) => s.setTimeMode);
  return {
    night,
    toggle: () => {
      Haptics.selectionAsync().catch(() => {});
      setTimeMode(night ? 'day' : 'night');
    },
  };
}

function Btn({ icon, label, onPress, active, children }: { icon?: string; label: string; onPress: () => void; active?: boolean; children?: React.ReactNode }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }} scaleTo={0.88} onPress={onPress} style={styles.btn}>
      {active ? <View style={styles.activeDot} /> : null}
      {children ?? <Icon name={icon!} size={22} color={active ? C.route : C.ink} />}
    </PressableScale>
  );
}

/** Right-side glass control pill: satellite · day/night · locate. */
export function MapControls({
  onLocate,
  showSatellite = true,
  showDayNight = true,
  style,
  locateIcon = 'crosshairs-gps',
}: {
  onLocate?: () => void;
  showSatellite?: boolean;
  showDayNight?: boolean;
  style?: StyleProp<ViewStyle>;
  locateIcon?: string;
}) {
  const sat = usePrefs((p) => p.mapSatellite);
  const setSat = usePrefs((p) => p.setMapSatellite);
  const dn = useDayNightToggle();
  const items: React.ReactNode[] = [];
  if (showSatellite)
    items.push(
      <Btn
        key="sat"
        icon={sat ? 'satellite-variant' : 'layers-outline'}
        label={sat ? 'Xəritə görünüşü' : 'Peyk görünüşü'}
        active={sat}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          setSat(!sat);
        }}
      />,
    );
  if (showDayNight)
    items.push(
      <Btn key="dn" label={dn.night ? 'Gündüz rejimi' : 'Gecə rejimi'} onPress={dn.toggle}>
        <DayNightIcon night={dn.night} />
      </Btn>,
    );
  if (onLocate) items.push(<Btn key="loc" icon={locateIcon} label="Mənim yerim" onPress={onLocate} />);
  return (
    <View style={[styles.pill, style]}>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <View style={styles.sep} /> : null}
          {it}
        </React.Fragment>
      ))}
    </View>
  );
}

/** Small glass chip: "Gecə · 11° · külək 9 m/s". */
export function GlassChip({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.chip, style]}>{children}</View>;
}

export function ChipText({ children, color = C.ink, w = 'semi' as const }: { children: React.ReactNode; color?: string; w?: 'semi' | 'bold' | 'med' }) {
  return (
    <Txt w={w} size={13} color={color}>
      {children}
    </Txt>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  pill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 26,
    paddingVertical: 4,
    ...shadow(2),
  },
  btn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  activeDot: { position: 'absolute', top: 7, right: 9, width: 7, height: 7, borderRadius: 4, backgroundColor: C.route },
  sep: { height: 1, width: 26, backgroundColor: C.line },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.96)',
    ...shadow(1),
  },
});
