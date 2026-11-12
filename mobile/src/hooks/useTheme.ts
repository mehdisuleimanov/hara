import { useMemo } from 'react';
import { C, C_HC, T } from '@/theme';
import { usePrefs, type A11yMode } from '@/store/prefs';

const SCALE: Record<A11yMode, number> = { standard: 1, senior: 1.25, lowVision: 1.4 };
const HIT: Record<A11yMode, number> = { standard: 44, senior: 56, lowVision: 64 };

export type Theme = {
  mode: A11yMode;
  /** simplified, voice-first UI */
  simple: boolean;
  /** high contrast colors */
  hc: boolean;
  /** font scale factor */
  s: number;
  C: typeof C;
  T: typeof T;
  /** minimum touch target */
  hit: number;
  /** reduced effects */
  lite: boolean;
  /** scale a font size; big headlines grow less so they don't overflow */
  font: (size: number) => number;
};

export function fontFor(mode: A11yMode, size: number) {
  const s = SCALE[mode];
  if (s === 1) return size;
  return size <= 22 ? size * s : size * (1 + (s - 1) * 0.55);
}

export function useTheme(): Theme {
  const mode = usePrefs((p) => p.a11yMode);
  const lite = usePrefs((p) => p.liteFx);
  return useMemo(() => {
    const hc = mode === 'lowVision';
    return {
      mode,
      simple: mode !== 'standard',
      hc,
      s: SCALE[mode],
      C: hc ? C_HC : C,
      T,
      hit: HIT[mode],
      lite,
      font: (size: number) => fontFor(mode, size),
    };
  }, [mode, lite]);
}

/** Just the effects flag (cheap subscription). */
export function useFx() {
  const lite = usePrefs((p) => p.liteFx);
  return { lite };
}
