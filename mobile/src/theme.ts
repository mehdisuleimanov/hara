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

  // surfaces & effects
  glass: 'rgba(255,255,255,0.88)',
  glassDark: 'rgba(15,27,45,0.72)',
  scrim: 'rgba(15,27,45,0.45)',
  routeGlow: 'rgba(31,111,235,0.28)',
  brandGlow: 'rgba(18,183,106,0.30)',
  underground: '#8E3B5B', // metro tunnel legs (drawn thin/dashed)
  ai: '#5B5BF6', // Əhməd accent (thinking states, AI badges)
  aiSoft: '#EEEEFF',
};

/** Same keys as C — high-contrast palette for "Sadə rejim / zəif görmə". */
export const C_HC: typeof C = {
  ...C,
  bg: '#FFFFFF',
  bg2: '#E6EAF0',
  surface: '#FFFFFF',
  ink: '#000000',
  ink2: '#0B1220',
  muted: '#2B3442',
  faint: '#4A5566',
  line: '#0F1B2D',
  brand: '#0A8A4F',
  brandDark: '#06703F',
  route: '#0B4FC4',
  purpleDark: '#0B4FC4',
  safe: '#0A7A3F',
  warn: '#8A5A00',
  danger: '#B3161A',
};

export const F = {
  black: 'Inter_900Black',
  xbold: 'Inter_800ExtraBold',
  bold: 'Inter_700Bold',
  semi: 'Inter_600SemiBold',
  med: 'Inter_500Medium',
  reg: 'Inter_500Medium', // 400 is not loaded (perf); keep alias safe
  light: 'Inter_500Medium',
  // Display face for headlines: Unbounded covers Ə ə ı İ ş ğ ₼ (verified with fontTools)
  display: 'Unbounded_700Bold',
  displayX: 'Unbounded_800ExtraBold',
};

export const R = { card: 32, lg: 24, md: 18, sm: 12, pill: 999 };

/** 8dp spacing rhythm */
export const S = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

/** z-layers for overlays */
export const Z = { sheet: 10, overlay: 50, toast: 90, morph: 100 };

/**
 * Type scale. `display` variants use Unbounded (wide) — keep them short (≤ 2 lines).
 * Use via <Txt v="h1">…</Txt>; explicit size/w props still override.
 */
export const T = {
  hero: { f: 'displayX', size: 34, lh: 40, ls: -1 },
  h1: { f: 'display', size: 26, lh: 32, ls: -0.6 },
  h2: { f: 'xbold', size: 22, lh: 28, ls: -0.5 },
  h3: { f: 'bold', size: 18, lh: 24, ls: -0.3 },
  title: { f: 'bold', size: 16.5, lh: 22, ls: -0.1 },
  body: { f: 'med', size: 15, lh: 21, ls: 0 },
  bodyS: { f: 'med', size: 13.5, lh: 19, ls: 0 },
  label: { f: 'semi', size: 13, lh: 17, ls: 0 },
  caption: { f: 'med', size: 12, lh: 16, ls: 0 },
  overline: { f: 'bold', size: 11, lh: 14, ls: 1.1 },
  num: { f: 'display', size: 28, lh: 32, ls: -0.8 },
} as const satisfies Record<string, { f: keyof typeof F; size: number; lh: number; ls: number }>;
export type TypeVariant = keyof typeof T;

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
