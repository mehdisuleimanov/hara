import { create } from 'zustand';
import type { Profile, Report, RouteKind, TimeOfDay } from '@/data/types';
import { SEED_REPORTS } from '@/data/reports-seed';

export type TimeMode = 'auto' | TimeOfDay;

export type AhmedResult = {
  transcript: string;
  destId: string | null;
  timeOfDay: TimeOfDay | null;
  profile: Profile;
  preference: RouteKind;
  companions: string[];
  reply: string;
  source: 'ai' | 'fallback';
};

type Toast = { id: number; text: string; icon?: string };

type State = {
  timeMode: TimeMode;
  windSpeed: number; // m/s
  windGust: number; // m/s
  aiEnabled: boolean;
  navSpeed: number; // simulation multiplier
  profile: Profile;
  points: number;
  reportsMade: number;
  helped: number;
  reports: Report[];
  familySubscribed: boolean;
  lastAhmed: AhmedResult | null;
  toast: Toast | null;
  demoPanelOpen: boolean;

  setTimeMode: (m: TimeMode) => void;
  setWind: (speed: number) => void;
  setAiEnabled: (v: boolean) => void;
  setNavSpeed: (v: number) => void;
  setProfile: (p: Profile) => void;
  addPoints: (n: number, reason?: string) => void;
  addReport: (r: Report) => void;
  voteReport: (id: string, stillThere: boolean) => void;
  setFamilySubscribed: (v: boolean) => void;
  setLastAhmed: (r: AhmedResult | null) => void;
  showToast: (text: string, icon?: string) => void;
  setDemoPanelOpen: (v: boolean) => void;
  reset: () => void;
};

const initial = {
  timeMode: 'auto' as TimeMode,
  windSpeed: 9,
  windGust: 13,
  aiEnabled: true,
  navSpeed: 6,
  profile: 'daily' as Profile,
  points: 1240,
  reportsMade: 48,
  helped: 1320,
  reports: SEED_REPORTS,
  familySubscribed: false,
  lastAhmed: null,
  toast: null,
  demoPanelOpen: false,
};

export const useAppStore = create<State>((set, get) => ({
  ...initial,
  setTimeMode: (timeMode) => set({ timeMode }),
  setWind: (windSpeed) => set({ windSpeed, windGust: Math.round(windSpeed * 1.5) }),
  setAiEnabled: (aiEnabled) => set({ aiEnabled }),
  setNavSpeed: (navSpeed) => set({ navSpeed }),
  setProfile: (profile) => set({ profile }),
  addPoints: (n, reason) => {
    set({ points: get().points + n });
    get().showToast(`+${n} xal${reason ? ' · ' + reason : ''}`, 'star-circle');
  },
  addReport: (r) => set({ reports: [r, ...get().reports], reportsMade: get().reportsMade + 1 }),
  voteReport: (id, stillThere) =>
    set({
      reports: get()
        .reports.map((r) => (r.id === id ? { ...r, count: r.count + (stillThere ? 1 : -1) } : r))
        .filter((r) => r.count > 0),
    }),
  setFamilySubscribed: (familySubscribed) => set({ familySubscribed }),
  setLastAhmed: (lastAhmed) => set({ lastAhmed }),
  showToast: (text, icon) => set({ toast: { id: Date.now(), text, icon } }),
  setDemoPanelOpen: (demoPanelOpen) => set({ demoPanelOpen }),
  reset: () => set({ ...initial, reports: SEED_REPORTS }),
}));

/** Night if forced, or automatically between 18:00 and 06:00. */
export function useIsNight() {
  const mode = useAppStore((s) => s.timeMode);
  if (mode === 'night') return true;
  if (mode === 'day') return false;
  const h = new Date().getHours();
  return h >= 18 || h < 6;
}

export function isNightNow(mode: TimeMode) {
  if (mode === 'night') return true;
  if (mode === 'day') return false;
  const h = new Date().getHours();
  return h >= 18 || h < 6;
}

/** Scooter is hidden when gusts exceed this (m/s). */
export const GUST_LIMIT = 17;
/** Above this wind speed, scooter routing avoids the seafront. */
export const SEAFRONT_WIND_LIMIT = 8;
