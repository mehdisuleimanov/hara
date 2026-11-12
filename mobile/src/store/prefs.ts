import { Platform } from 'react-native';
import { create } from 'zustand';

/**
 * Device-level preferences (persisted). Frozen API — lanes read it, only the
 * foundation adds fields.
 */
export type A11yMode = 'standard' | 'senior' | 'lowVision';

type Persisted = {
  a11yMode: A11yMode;
  liteFx: boolean;
  onboarded: boolean;
  stageFallback: boolean;
  voiceMuted: boolean;
  mapSatellite: boolean;
};

type Prefs = Persisted & {
  hydrated: boolean;
  setA11yMode: (m: A11yMode) => void;
  setLiteFx: (v: boolean) => void;
  setOnboarded: (v: boolean) => void;
  setStageFallback: (v: boolean) => void;
  setVoiceMuted: (v: boolean) => void;
  setMapSatellite: (v: boolean) => void;
  hydrate: () => Promise<void>;
};

const DEFAULTS: Persisted = {
  a11yMode: 'standard',
  liteFx: false,
  onboarded: false,
  stageFallback: false,
  voiceMuted: false,
  mapSatellite: false,
};

const KEY = 'hara-prefs-v1';

async function readRaw(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
    const { File, Paths } = await import('expo-file-system');
    const f = new File(Paths.document, `${KEY}.json`);
    return f.exists ? await f.text() : null;
  } catch {
    return null;
  }
}

async function writeRaw(s: string) {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.setItem(KEY, s);
    const { File, Paths } = await import('expo-file-system');
    const f = new File(Paths.document, `${KEY}.json`);
    if (!f.exists) f.create();
    f.write(s);
  } catch {}
}

function pick(s: Persisted): Persisted {
  return {
    a11yMode: s.a11yMode,
    liteFx: s.liteFx,
    onboarded: s.onboarded,
    stageFallback: s.stageFallback,
    voiceMuted: s.voiceMuted,
    mapSatellite: s.mapSatellite,
  };
}

export const usePrefs = create<Prefs>((set, get) => {
  const save = (patch: Partial<Persisted>) => {
    set(patch);
    writeRaw(JSON.stringify(pick({ ...get(), ...patch })));
  };
  return {
    ...DEFAULTS,
    hydrated: false,
    setA11yMode: (a11yMode) => save({ a11yMode }),
    setLiteFx: (liteFx) => save({ liteFx }),
    setOnboarded: (onboarded) => save({ onboarded }),
    setStageFallback: (stageFallback) => save({ stageFallback }),
    setVoiceMuted: (voiceMuted) => save({ voiceMuted }),
    setMapSatellite: (mapSatellite) => save({ mapSatellite }),
    hydrate: async () => {
      const raw = await readRaw();
      let data: Partial<Persisted> = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {}
      set({ ...DEFAULTS, ...data, hydrated: true });
    },
  };
});

/** Non-hook accessor (for worklets-free utility code). */
export const prefs = () => usePrefs.getState();
