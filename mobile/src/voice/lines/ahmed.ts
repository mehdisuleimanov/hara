/**
 * Spoken lines owned by lane "ahmed" — exact strings passed to say(). No RN imports.
 * Scripted replies are derived from the route data, so regenerating clips after a data
 * rebuild keeps them in sync (scripts/gen-voice.ts).
 */
import { scriptLines } from '../../ai/script';

export const AHMED_LINES: string[] = scriptLines();
