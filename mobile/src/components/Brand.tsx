import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { C } from '@/theme';
import { Txt } from './ui';
import { LOGO_PATHS, LOGO_RATIO, LOGO_VIEWBOX } from './logoPaths';

/**
 * Brand marks drawn as SVG from the team's references:
 *  - Əhməd: turquoise pin mascot with a navy flat cap (user's mascot image)
 *  - "hara" logo: the team's own SVG (assets/brand/hara-logo.svg), transparent background
 */

const PIN = 'M50 4C26.8 4 8 22.4 8 45.2c0 27.6 33.3 59.6 39.1 64.9a4.3 4.3 0 0 0 5.8 0C58.7 104.8 92 72.8 92 45.2 92 22.4 73.2 4 50 4Z';

/** Colors sampled from the mascot artwork. */
const MASCOT = {
  bodyTop: '#45E0C3',
  bodyBottom: '#1FC2A5',
  limb: '#27C9AC',
  cap: '#1D2536',
  capBrim: '#262F45',
  face: '#101521',
  cheek: '#7FEBD5',
  glow: '#2FE0C0',
};

export function LogoMark({ size = 36, color = C.route }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size * 1.15} viewBox="0 0 100 115">
      <Path d={PIN} fill={color} />
      <SvgText x="50" y="64" fontSize="54" fontWeight="900" fill="#FFFFFF" textAnchor="middle">
        ?
      </SvgText>
    </Svg>
  );
}

/**
 * "hara" logo — the team's original artwork (assets/brand/hara-logo.svg) with the navy
 * background removed, so it sits on any surface. Paths are generated into logoPaths.ts.
 */
export const HaraWordmark = React.memo(function HaraWordmark({ width = 120 }: { width?: number }) {
  return (
    <Svg width={width} height={width * LOGO_RATIO} viewBox={LOGO_VIEWBOX} accessibilityLabel="hara" accessibilityRole="image">
      {LOGO_PATHS.map((p, i) => (
        <Path key={i} d={p.d} fill={p.fill} />
      ))}
    </Svg>
  );
});

export function Logo({ size = 30 }: { size?: number; dark?: boolean }) {
  return <HaraWordmark width={size * 4} />;
}

/**
 * Əhməd — the AI guide. `full` draws the whole character (arms, legs, waving hand, glow)
 * like the mascot artwork; the default is the head-only pin for small avatars.
 */
export function AhmedAvatar({
  size = 64,
  mood = 'smile',
  full = false,
  glow = full,
}: {
  size?: number;
  mood?: 'smile' | 'talk';
  full?: boolean;
  glow?: boolean;
}) {
  const vb = full ? '0 0 140 150' : '20 4 100 116';
  const ratio = full ? 150 / 140 : 116 / 100;
  return (
    <Svg width={size} height={size * ratio} viewBox={vb} accessibilityLabel="Əhməd">
      <Defs>
        <LinearGradient id="ahmedBody" x1="0.2" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor={MASCOT.bodyTop} />
          <Stop offset="1" stopColor={MASCOT.bodyBottom} />
        </LinearGradient>
      </Defs>
      {glow ? (
        <>
          <Circle cx="70" cy="70" r="68" fill={MASCOT.glow} opacity={0.10} />
          <Circle cx="70" cy="66" r="56" fill={MASCOT.glow} opacity={0.14} />
        </>
      ) : null}

      {full ? (
        <>
          {/* short legs + round feet (behind body) */}
          <Path d="M62 108 L 61 130" stroke={MASCOT.limb} strokeWidth={11} strokeLinecap="round" />
          <Path d="M79 108 L 80 130" stroke={MASCOT.limb} strokeWidth={11} strokeLinecap="round" />
          <Ellipse cx="58" cy="136" rx="11.5" ry="7" fill={MASCOT.limb} />
          <Ellipse cx="83" cy="136" rx="11.5" ry="7" fill={MASCOT.limb} />
          {/* left arm hanging, mitten hand */}
          <Path d="M34 76 Q 22 88 24 104" stroke={MASCOT.limb} strokeWidth={11} strokeLinecap="round" fill="none" />
          <Ellipse cx="24" cy="107" rx="7.5" ry="8.5" fill={MASCOT.limb} />
          {/* right arm raised, waving open hand (4 fingers) */}
          <Path d="M104 74 Q 120 68 122 46" stroke={MASCOT.limb} strokeWidth={11} strokeLinecap="round" fill="none" />
          <Ellipse cx="123" cy="38" rx="10" ry="11" fill={MASCOT.limb} />
          <Ellipse cx="114.5" cy="27" rx="3.6" ry="7" fill={MASCOT.limb} transform="rotate(-18 114.5 27)" />
          <Ellipse cx="122" cy="24" rx="3.6" ry="7.5" fill={MASCOT.limb} transform="rotate(-4 122 24)" />
          <Ellipse cx="129.5" cy="26" rx="3.6" ry="7" fill={MASCOT.limb} transform="rotate(12 129.5 26)" />
          <Ellipse cx="134.5" cy="35" rx="3.3" ry="6" fill={MASCOT.limb} transform="rotate(48 134.5 35)" />
        </>
      ) : null}

      <G transform="translate(20 6)">
        {/* body (teal pin, soft vertical shading) */}
        <Path d={PIN} fill="url(#ahmedBody)" />
        <Path d="M22 30 C 26 20 36 14 46 13" stroke="#FFFFFF" strokeOpacity={0.25} strokeWidth={4} strokeLinecap="round" fill="none" />
        {/* big flat cap: dome over the top + brim out to the right */}
        <Path d="M7 42 C 4 18 26 0 52 0 C 77 0 94 13 95 31 C 81 25 65 23 50 24 C 33 25 17 31 7 42 Z" fill={MASCOT.cap} />
        <Path d="M58 30 C 74 23 96 22 103 31 C 98 39 80 39 61 36 Z" fill={MASCOT.capBrim} />
        <Path d="M16 30 C 24 14 40 6 56 6" stroke="#FFFFFF" strokeOpacity={0.10} strokeWidth={4} strokeLinecap="round" fill="none" />
        {/* thick eyebrows */}
        <Path d="M28 42 q 8 -6 15 -2" stroke={MASCOT.face} strokeWidth={3.6} strokeLinecap="round" fill="none" />
        <Path d="M57 40 q 8 -4 15 2" stroke={MASCOT.face} strokeWidth={3.6} strokeLinecap="round" fill="none" />
        {/* big eyes, pupils looking up-left, glints */}
        <Ellipse cx="38" cy="55" rx="8.8" ry="10.5" fill="#FFFFFF" />
        <Ellipse cx="63" cy="55" rx="8.8" ry="10.5" fill="#FFFFFF" />
        <Circle cx="37" cy="55.5" r="5.4" fill={MASCOT.face} />
        <Circle cx="61.8" cy="55.5" r="5.4" fill={MASCOT.face} />
        <Circle cx="38.8" cy="52.6" r="1.9" fill="#FFFFFF" />
        <Circle cx="63.6" cy="52.6" r="1.9" fill="#FFFFFF" />
        {/* cheeks */}
        <Ellipse cx="25" cy="69" rx="7.5" ry="5" fill={MASCOT.cheek} opacity={0.75} />
        <Ellipse cx="76" cy="69" rx="7.5" ry="5" fill={MASCOT.cheek} opacity={0.75} />
        {/* small smile */}
        {mood === 'talk' ? (
          <Ellipse cx="51" cy="71" rx="5.5" ry="4.4" fill={MASCOT.face} />
        ) : (
          <Path d="M43 69 c 4 5.5 12 5.5 16 0" stroke={MASCOT.face} strokeWidth={3.2} strokeLinecap="round" fill="none" />
        )}
      </G>
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
        borderColor: '#FFFFFF',
      }}
    >
      <Txt w="xbold" size={size * 0.38} color={C.brandDark}>
        {initials}
      </Txt>
    </View>
  );
}
