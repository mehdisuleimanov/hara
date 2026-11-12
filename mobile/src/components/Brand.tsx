import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Text as SvgText } from 'react-native-svg';
import { C, F } from '@/theme';
import { Txt } from './ui';

/**
 * PLACEHOLDER brand assets. The real Əhməd mascot and Hara? logo will be
 * supplied by the team later (drop PNGs into assets/brand/ and swap here).
 */

const PIN = 'M50 4C26.8 4 8 22.4 8 45.2c0 27.6 33.3 59.6 39.1 64.9a4.3 4.3 0 0 0 5.8 0C58.7 104.8 92 72.8 92 45.2 92 22.4 73.2 4 50 4Z';

export function LogoMark({ size = 36, color = C.brand }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size * 1.15} viewBox="0 0 100 115">
      <Path d={PIN} fill={color} />
      <SvgText x="50" y="64" fontSize="54" fontWeight="900" fill="#fff" textAnchor="middle">
        ?
      </SvgText>
    </Svg>
  );
}

export function Logo({ size = 30, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <LogoMark size={size} />
      <Txt w="black" size={size * 0.8} color={dark ? '#fff' : C.ink} style={{ fontFamily: F.black }}>
        Hara?
      </Txt>
    </View>
  );
}

/** Placeholder Əhməd: orange pin with a flat cap, friendly face. */
export function AhmedAvatar({ size = 64, mood = 'smile' }: { size?: number; mood?: 'smile' | 'talk' }) {
  return (
    <Svg width={size} height={size * 1.15} viewBox="0 0 100 115">
      <Path d={PIN} fill={C.brand} />
      {/* cap */}
      <Path d="M20 34c2-14 15-24 31-24s29 9 31 22c-9-5-19-7-31-7-12 0-22 3-31 9Z" fill={C.black} />
      <Ellipse cx="72" cy="31" rx="18" ry="5" fill={C.black2} />
      {/* eyes */}
      <Ellipse cx="38" cy="50" rx="7" ry="8.5" fill="#fff" />
      <Ellipse cx="62" cy="50" rx="7" ry="8.5" fill="#fff" />
      <Circle cx="39.5" cy="51.5" r="3.6" fill={C.black} />
      <Circle cx="63.5" cy="51.5" r="3.6" fill={C.black} />
      {/* cheeks */}
      <Ellipse cx="29" cy="63" rx="5" ry="3" fill="#FFB38A" opacity={0.8} />
      <Ellipse cx="71" cy="63" rx="5" ry="3" fill="#FFB38A" opacity={0.8} />
      {/* mouth */}
      {mood === 'talk' ? (
        <Ellipse cx="50" cy="67" rx="6" ry="4.5" fill={C.black} />
      ) : (
        <Path d="M41 64c4 5 14 5 18 0" stroke={C.black} strokeWidth="3.4" strokeLinecap="round" fill="none" />
      )}
    </Svg>
  );
}

export function Avatar({ size = 52, initials = 'A' }: { size?: number; initials?: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: C.brandSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
      }}
    >
      <Txt w="xbold" size={size * 0.38} color={C.brand}>
        {initials}
      </Txt>
    </View>
  );
}
