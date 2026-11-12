import { create } from 'zustand';
import type { LatLng } from '@/data/types';

/** Live navigation snapshot, shared with the lock-screen widget simulation. */
export type NavSnap = {
  active: boolean;
  destName: string;
  maneuver: string; // "sonra sağa"
  maneuverIcon: string;
  distToNext: number; // m
  street: string;
  remainingM: number;
  remainingMin: number;
  eta: string;
  score: number;
  speedKmh: number;
  route: LatLng[];
  pos: LatLng | null;
  hazard: string | null;
};

const EMPTY: NavSnap = {
  active: false,
  destName: 'Hilton Baku',
  maneuver: 'sonra sağa',
  maneuverIcon: 'arrow-top-right-thick',
  distToNext: 220,
  street: 'Füzuli küçəsi',
  remainingM: 650,
  remainingMin: 9,
  eta: '22:04',
  score: 92,
  speedKmh: 5,
  route: [],
  pos: null,
  hazard: null,
};

export const useNavStore = create<{ snap: NavSnap; set: (p: Partial<NavSnap>) => void; clear: () => void }>((set, get) => ({
  snap: EMPTY,
  set: (p) => set({ snap: { ...get().snap, ...p } }),
  clear: () => set({ snap: { ...get().snap, active: false, hazard: null } }),
}));
