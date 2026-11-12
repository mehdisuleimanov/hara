import { create } from 'zustand';
import type { AhmedStep } from '@/store/useAppStore';
import type { StepOp } from '@/ai/agent';

/**
 * Əhməd screen session (lives for the app session, not persisted).
 * Steps from the agent arrive in bursts (tool calls finish in milliseconds), so they are
 * staged: each new row appears ≥ ROW_GAP after the previous one and keeps its spinner for
 * ≥ MIN_RUN — the trace stays readable while still showing only real work.
 */
const ROW_GAP = 240;
const MIN_RUN = 460;

type Session = {
  /** greeted once per app session */
  greeted: boolean;
  /** steps currently shown in the thinking trace */
  steps: AhmedStep[];
  /** recent exchanges (follow-up context) */
  history: { q: string; a: string }[];
  markGreeted: () => void;
  push: (op: StepOp) => void;
  resetSteps: () => void;
  remember: (q: string, a: string) => void;
  /** resolves when every queued step change is visible */
  settled: () => Promise<void>;
};

let queue: StepOp[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let lastAddAt = 0;
const addedAt = new Map<string, number>();
let waiters: (() => void)[] = [];
let epoch = 0;

export const useAhmedSession = create<Session>((set, get) => {
  const apply = (op: StepOp) => {
    if (op.type === 'add') {
      addedAt.set(op.step.id, Date.now());
      lastAddAt = Date.now();
      set({ steps: [...get().steps.filter((s) => s.id !== op.step.id), op.step] });
    } else {
      set({ steps: get().steps.map((s) => (s.id === op.id ? { ...s, ...op.patch } : s)) });
    }
  };

  const pump = () => {
    if (timer) return;
    const op = queue[0];
    if (!op) {
      const w = waiters;
      waiters = [];
      w.forEach((f) => f());
      return;
    }
    const now = Date.now();
    let at = now;
    if (op.type === 'add') at = Math.max(now, lastAddAt + ROW_GAP);
    else if (op.patch.state && op.patch.state !== 'run') at = Math.max(now, (addedAt.get(op.id) ?? 0) + MIN_RUN);
    const my = epoch;
    timer = setTimeout(() => {
      timer = null;
      if (my !== epoch) return;
      const next = queue.shift();
      if (next) apply(next);
      pump();
    }, Math.max(0, at - now));
  };

  return {
    greeted: false,
    steps: [],
    history: [],
    markGreeted: () => set({ greeted: true }),
    push: (op) => {
      queue.push(op);
      pump();
    },
    resetSteps: () => {
      epoch++;
      queue = [];
      if (timer) clearTimeout(timer);
      timer = null;
      addedAt.clear();
      lastAddAt = 0;
      const w = waiters;
      waiters = [];
      w.forEach((f) => f());
      set({ steps: [] });
    },
    remember: (q, a) => set({ history: [...get().history, { q, a }].slice(-2) }),
    settled: () =>
      new Promise<void>((resolve) => {
        if (!queue.length && !timer) resolve();
        else waiters.push(resolve);
      }),
  };
});
