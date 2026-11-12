import { usePrefs, type A11yMode } from '@/store/prefs';

/**
 * FROZEN API — one-tap adaptive UI. Lane C replaces the body with the animated
 * circular reveal host (A11yMorphHost) but keeps this signature.
 */
export type MorphOrigin = { x: number; y: number };

type MorphImpl = (mode: A11yMode, origin?: MorphOrigin) => void;
let impl: MorphImpl | null = null;

/** Called by the host component to take over the transition. */
export function registerMorph(fn: MorphImpl | null) {
  impl = fn;
}

export function morphTo(mode: A11yMode, origin?: MorphOrigin) {
  if (impl) impl(mode, origin);
  else usePrefs.getState().setA11yMode(mode);
}

export function useA11yMorph() {
  const mode = usePrefs((p) => p.a11yMode);
  return { mode, morphTo };
}
