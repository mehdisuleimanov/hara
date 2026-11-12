import { Platform, ViewStyle } from 'react-native';

/**
 * Design v7 (2026-11-13, current): WHITE canvas, BLUE + GREEN brand.
 *  - blue  #1F6FEB = navigation: route line, active/selected states, map controls
 *  - green #12B76A = go / safe / success: primary CTAs ("Başla"), active chips, 3D "you" arrow
 *  - navy  #0F1B2D = text. Cards are #F4F7FB so they separate from the white page.
 * Amber/red only for risk. Text contrast: ink/ink2/muted >= 4.5:1 on bg + surface.
 */
export const C = {
  bg: '#FFFFFF',
  bg2: '#EEF2F8', // round buttons, inputs, inactive chips
  surface: '#F4F7FB', // cards, sheets, map overlays
  ink: '#0F1B2D',
  ink2: '#334155',
  muted: '#5B6779',
  faint: '#A7B1C2',
  line: '#E3E8F0',

  // green: go / safe / success (content on it = white)
  brand: '#12B76A',
  brandDark: '#0E9F5B',
  brandSoft: '#E6F7EE',
  brandSofter: '#F3FBF7',
  onBrand: '#FFFFFF',

  // blue: navigation & primary surfaces
  purple: '#EAF2FF', // light-blue hero / info cards (dark text)
  purpleDark: '#1F6FEB',
  purpleLight: '#D6E6FF',
  purpleSoft: '#F2F7FF',
  route: '#1F6FEB',
  halo: 'rgba(31,111,235,0.22)',

  // navy = dark text/elements; black = dark pills (white content)
  navy: '#0F1B2D',
  navy2: '#1E2B40',
  black: '#0F1B2D',
  black2: '#1E2B40',

  // risk scale (green also = brand "safe")
  safe: '#12B76A',
  safeSoft: '#E6F7EE',
  warn: '#F59E0B',
  warnSoft: '#FEF3C7',
  danger: '#E5484D',
  dangerSoft: '#FDE4E5',
  metro: '#E5484D',
  bus: '#1F6FEB',
};

export const F = {
  black: 'Inter_900Black',
  xbold: 'Inter_800ExtraBold',
  bold: 'Inter_700Bold',
  semi: 'Inter_600SemiBold',
  med: 'Inter_500Medium',
  reg: 'Inter_400Regular',
  light: 'Inter_300Light',
};

export const R = { card: 32, lg: 24, md: 18, pill: 999 };

/** 8dp spacing rhythm */
export const S = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export function shadow(level: 1 | 2 | 3 = 1): ViewStyle {
  const e = level === 1 ? 2 : level === 2 ? 6 : 12;
  return Platform.select<ViewStyle>({
    android: { elevation: e, shadowColor: '#071532' },
    default: {
      shadowColor: '#071532',
      shadowOpacity: 0.06 * level,
      shadowRadius: 6 * level,
      shadowOffset: { width: 0, height: 2 * level },
    },
  })!;
}

export function scoreColor(score: number) {
  if (score >= 75) return C.safe;
  if (score >= 55) return C.warn;
  return C.danger;
}

export function scoreSoft(score: number) {
  if (score >= 75) return C.safeSoft;
  if (score >= 55) return C.warnSoft;
  return C.dangerSoft;
}
