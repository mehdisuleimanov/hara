import { Platform, ViewStyle } from 'react-native';

// Brand: white + #FF6203. Safety colors are used ONLY for safety scores.
export const C = {
  bg: '#F2F2F4',
  surface: '#FFFFFF',
  ink: '#121212',
  ink2: '#3A3A3C',
  muted: '#8E8E93',
  faint: '#B9B9BE',
  line: '#E6E6EA',
  brand: '#FF6203',
  brandDark: '#E35400',
  brandSoft: '#FFEDE1',
  brandSofter: '#FFF6F0',
  black: '#151515',
  black2: '#2A2A2A',
  safe: '#16A34A',
  safeSoft: '#E4F6EB',
  warn: '#EAA300',
  warnSoft: '#FFF5D9',
  danger: '#E5383B',
  dangerSoft: '#FDE6E6',
  metro: '#D7263D',
  bus: '#2F6FED',
};

export const F = {
  black: 'Inter_900Black',
  xbold: 'Inter_800ExtraBold',
  bold: 'Inter_700Bold',
  semi: 'Inter_600SemiBold',
  med: 'Inter_500Medium',
  reg: 'Inter_400Regular',
};

export const R = { card: 30, lg: 24, md: 18, pill: 999 };

export function shadow(level: 1 | 2 | 3 = 1): ViewStyle {
  const e = level === 1 ? 2 : level === 2 ? 6 : 12;
  return Platform.select<ViewStyle>({
    android: { elevation: e },
    default: {
      shadowColor: '#000',
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
