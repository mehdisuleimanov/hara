import React, { memo } from 'react';
import { View } from 'react-native';
import { Marker, Polyline } from 'react-native-maps';
import type { RouteOption } from '@/data/types';
import { toLatLngs } from '@/utils/geo';
import { C } from '@/theme';
import { Icon } from './ui';

const LEG_COLOR: Record<string, string> = {
  walk: C.brand,
  metro: C.metro,
  bus: C.bus,
  taxi: C.black,
  scooter: C.brand,
  bike: C.brand,
};

export const RouteLines = memo(function RouteLines({
  option,
  active,
}: {
  option: RouteOption;
  active: boolean;
}) {
  return (
    <>
      {option.legs.map((leg, i) => {
        const coords = toLatLngs(leg.c);
        if (!active) {
          return (
            <Polyline
              key={i}
              coordinates={coords}
              strokeColor="#9A9AA0"
              strokeWidth={4}
              lineDashPattern={[8, 8]}
              zIndex={6}
            />
          );
        }
        return (
          <React.Fragment key={i}>
            <Polyline coordinates={coords} strokeColor="rgba(255,98,3,0.18)" strokeWidth={14} zIndex={7} lineCap="round" />
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

export function OriginPin({ latitude, longitude }: { latitude: number; longitude: number }) {
  return (
    <Marker coordinate={{ latitude, longitude }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={20}>
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,98,3,0.22)', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: C.brand, borderWidth: 3, borderColor: '#fff' }} />
      </View>
    </Marker>
  );
}

export function DestPin({ latitude, longitude, icon = 'flag-checkered' }: { latitude: number; longitude: number; icon?: string }) {
  return (
    <Marker coordinate={{ latitude, longitude }} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false} zIndex={21}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.black, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' }}>
          <Icon name={icon} size={20} color="#fff" />
        </View>
        <View style={{ width: 4, height: 10, backgroundColor: C.black, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }} />
      </View>
    </Marker>
  );
}

export function IconPin({
  latitude,
  longitude,
  icon,
  bg = '#fff',
  color = C.ink,
  badge,
  onPress,
  size = 40,
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
  return (
    <Marker coordinate={{ latitude, longitude }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} onPress={onPress} zIndex={15}>
      <View style={{ padding: 4 }}>
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: bg,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2.5,
            borderColor: '#fff',
          }}
        >
          <Icon name={icon} size={size * 0.5} color={color} />
        </View>
        {badge ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: C.black,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 4,
            }}
          >
            <Icon name={`numeric-${Math.min(badge, 9)}`} size={14} color="#fff" />
          </View>
        ) : null}
      </View>
    </Marker>
  );
}
