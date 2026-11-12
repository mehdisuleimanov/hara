import { create } from 'zustand';
import type { VisionAttrs } from '@/ai/vision';

/** One AI Göz analysis (sample photo or live camera). */
export type ScanRecord = {
  id: string;
  at: number;
  source: 'sample' | 'live';
  sampleId?: string;
  attrs: VisionAttrs;
  score: number;
  stars: number;
  /** added to the safety layer by the user */
  contributed: boolean;
};

type ScanState = {
  history: ScanRecord[];
  last: ScanRecord | null;
  record: (r: ScanRecord) => void;
  contribute: (id: string) => void;
};

export const useScanStore = create<ScanState>((set, get) => ({
  history: [],
  last: null,
  record: (r) => set({ last: r, history: [r, ...get().history.filter((h) => h.id !== r.id)].slice(0, 30) }),
  contribute: (id) =>
    set({
      history: get().history.map((h) => (h.id === id ? { ...h, contributed: true } : h)),
      last: get().last?.id === id ? { ...get().last!, contributed: true } : get().last,
    }),
}));
