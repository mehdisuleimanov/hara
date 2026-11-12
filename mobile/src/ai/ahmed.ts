/**
 * Public entry for Əhməd (kept for older imports). The real work lives in agent.ts;
 * deterministic replies in script.ts (RN-free).
 */
import type { AhmedResult } from '@/store/useAppStore';
import { runAgent, type AgentInput, type AgentOpts } from './agent';

export { scriptedReply, speakable, AHMED_SAY } from './script';
export { KIND_TITLE } from '@/data/routes';
export { DEMO_SENTENCE } from './fallback';
export type { StepOp } from './agent';

/** Ask Əhməd (understand → tool loop → reply). Never throws. */
export async function askAhmed(input: AgentInput, opts: Omit<AgentOpts, 'onStep'> & Partial<Pick<AgentOpts, 'onStep'>>): Promise<AhmedResult> {
  const steps: NonNullable<AhmedResult['steps']> = [];
  const result = await runAgent(input, {
    ...opts,
    onStep: (op) => {
      if (op.type === 'add') steps.push({ ...op.step });
      else {
        const s = steps.find((x) => x.id === op.id);
        if (s) Object.assign(s, op.patch);
      }
      opts.onStep?.(op);
    },
  });
  return { ...result, steps };
}
