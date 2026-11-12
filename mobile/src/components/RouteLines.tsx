import React, { memo } from 'react';
import { View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { Marker, Polyline } from 'react-native-maps';
import type { RouteOption } from '@/data/types';
import { toLatLngs } from '@/utils/geo';
import { C } from '@/theme';
import { Icon, Txt } from './ui';

const LEG_COLOR: Record<string, string> = {
  walk: C.route,
  metro: C.metro,
  bus: C.bus,
  taxi: '#5B6478',
  scooter: C.route,
  bike: C.route,
};

export const RouteLines = memo(function RouteLines({ option, active }: { option: RouteOption; active: boolean }) {
  return (
    <>
      {option.legs.map((leg, i) => {
        const coords = toLatLngs(leg.c);
        if (!active) {
          return <Polyline key={i} coordinates={coords} strokeColor="#9AA1B2" strokeWidth={4} lineDashPattern={[8, 8]} zIndex={6} />;
        }
        return (
          <React.Fragment key={i}>
            <Polyline coordinates={coords} strokeColor={C.halo} strokeWidth={16} zIndex={7} lineCap="round" />
            <Polyline
              coordinates={coords}
              strokeColor={LEG_COLOR[leg.mode]}
              strokeWidth={6}
              lineCap="round"
              lineJoin="round"
              lineDashPattern={leg.mode === 'metro' ? [2, 10] : undefined}
              zIndex={8}
            />
          </React.Fragment>
        );
      })}
    </>
  );
});

const PIN = 'M24 2C12.4 2 3 11.2 3 22.6c0 13.8 16.7 29.8 19.6 32.4a2.1 2.1 0 0 0 2.8 0C28.3 52.4 45 36.4 45 22.6 45 11.2 35.6 2 24 2Z';

/** Reference-style navy teardrop pin with a white disc + icon. */
export function PinView({ icon, iconColor = C.ink, size = 44, color = C.navy, badge }: { icon: string; iconColor?: string; size?: number; color?: string; badge?: number }) {
  const h = size * 1.2;
  return (
    <View style={{ width: size, height: h }}>
      <Svg width={size} height={h} viewBox="0 0 48 58" style={{ position: 'absolute' }}>
        <Path d={PIN} fill={color} stroke="#FFFFFF" strokeWidth={2.5} />
      </Svg>
      <View
        style={{
          position: 'absolute',
          top: size * 0.17,
          left: size * 0.17,
          width: size * 0.66,
          height: size * 0.66,
          borderRadius: size,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={size * 0.36} color={iconColor} />
      </View>
      {badge ? (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -6,
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: C.brand,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 5,
            borderWidth: 2,
            borderColor: '#fff',
          }}
        >
          <Txt w="bold" size={11} color={C.navy}>
            {badge}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

/**
 * "You are here" — Waze-style 3D navigation arrow: two shaded faces (mint / darker mint),
 * navy rim, light sheen and a soft ground shadow. Points to `heading` (deg, 0 = up/north).
 */
export function MeArrow({ size = 56, heading = 0, halo = true }: { size?: number; heading?: number; halo?: boolean }) {
  return (
    <View style={{ width: size * 1.35, height: size * 1.35, alignItems: 'center', justifyContent: 'center' }}>
      {halo ? (
        <View
          style={{
            position: 'absolute',
            width: size * 1.3,
            height: size * 1.3,
            borderRadius: size,
            backgroundColor: 'rgba(18,183,106,0.28)',
            borderWidth: 1.5,
            borderColor: 'rgba(18,183,106,0.65)',
          }}
        />
      ) : null}
      <View style={{ transform: [{ rotate: `${heading}deg` }] }}>
        <Svg width={size} height={size * 1.12} viewBox="0 0 64 72">
          <Ellipse cx="32" cy="62" rx="15" ry="5.5" fill="rgba(0,0,0,0.4)" />
          <Path d="M32 5 L10 55 L32 43 Z" fill={C.brand} />
          <Path d="M32 5 L54 55 L32 43 Z" fill={C.brandDark} />
          <Path d="M32 5 L54 55 L32 43 L10 55 Z" fill="none" stroke={C.navy} strokeWidth={3.2} strokeLinejoin="round" />
          <Path d="M31 12 L15 49" stroke="rgba(255,255,255,0.75)" strokeWidth={2} strokeLinecap="round" />
        </Svg>
      </View>
    </View>
  );
}

export function OriginPin({ latitude, longitude, heading = 20 }: { latitude: number; longitude: number; heading?: number }) {
  return (
    <Marker coordinate={{ latitude, longitude }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={20}>
      <MeArrow size={34} heading={heading} />
    </Marker>
  );
}

export function DestPin({ latitude, longitude, icon = 'flag-checkered' }: { latitude: number; longitude: number; icon?: string }) {
  return (
    <Marker coordinate={{ latitude, longitude }} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false} zIndex={21}>
      <PinView icon={icon} />
    </Marker>
  );
}

export function IconPin({
  latitude,
  longitude,
  icon,
  bg,
  color,
  badge,
  onPress,
  size = 42,
}: {
  latitude: number;
  longitude: number;
  icon: string;
  bg?: string;
  color?: string;
  badge?: number;
  onPress?: () => void;
  size?: number;
}) {
  // bg is the semantic tone (danger / warn) -> used for the icon; the pin itself stays navy
  return (
    <Marker coordinate={{ latitude, longitude }} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false} onPress={onPress} zIndex={15}>
      <View style={{ padding: 6 }}>
        <PinView icon={icon} iconColor={bg && bg !== '#fff' && bg !== '#FFFFFF' ? bg : color ?? C.ink} size={size} badge={badge} />
      </View>
    </Marker>
  );
}
