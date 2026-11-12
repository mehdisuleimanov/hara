import { DESTINATIONS, destById } from '@/data/destinations';
import { optionOf, routeFacts, summary, score, KIND_TITLE } from '@/data/routes';
import type { Profile, RouteKind, TimeOfDay } from '@/data/types';
import type { AhmedResult } from '@/store/useAppStore';
import { geminiJson, GEMINI_KEY } from './gemini';
import { DEMO_SENTENCE, matchIntent } from './fallback';

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    transcript: { type: 'STRING', description: 'What the user said, Azerbaijani Latin script' },
    destinationId: { type: 'STRING', enum: [...DESTINATIONS.map((d) => d.id), 'unknown'] },
    timeOfDay: { type: 'STRING', enum: ['day', 'night', 'unspecified'] },
    profile: { type: 'STRING', enum: ['daily', 'accessible', 'scooter', 'family'] },
    preference: { type: 'STRING', enum: ['safest', 'cheapest', 'fastest'] },
    companions: { type: 'ARRAY', items: { type: 'STRING', enum: ['stroller', 'wheelchair', 'child', 'elderly'] } },
    reply: { type: 'STRING', description: '1-2 short spoken sentences in Azerbaijani, as Əhməd' },
  },
  required: ['transcript', 'destinationId', 'timeOfDay', 'profile', 'preference', 'companions', 'reply'],
  propertyOrdering: ['transcript', 'destinationId', 'timeOfDay', 'profile', 'preference', 'companions', 'reply'],
};

function systemPrompt(night: boolean) {
  return `You are "Əhməd", the friendly voice guide of "Hara?" — a Baku app that recommends the LEAST RISKY route (not the fastest) for pedestrians, wheelchair users, parents with strollers, elderly people, cyclists and scooter riders.
The user speaks Azerbaijani (sometimes mixed with Russian, Turkish or English). Their input is audio or text.
The user's current location is ALWAYS 28 May metro station (origin). It is currently ${night ? 'NIGHT' : 'DAY'} in Baku.

Return JSON:
- transcript: exactly what the user said, in Azerbaijani Latin script; fix place-name spelling using the catalog.
- destinationId: the catalog id the user wants to go to. Mentions of "28 May" are the ORIGIN, not the destination. If nothing in the catalog matches, use "unknown".
- timeOfDay: "night" if they mention night/evening/dark (gecə, axşam, qaranlıq), "day" if day/morning, else "unspecified".
- profile: "accessible" for wheelchair, stroller (uşaq arabası), elderly with mobility issues, blind or deaf users; "scooter" for scooter or bicycle; "family" if they talk about tracking a child or family member; otherwise "daily".
- preference: "cheapest" if they want cheap (ucuz, sərfəli, qənaət); "fastest" if they are in a hurry (tez, sürətli, tələsirəm); otherwise "safest".
- companions: any of stroller, wheelchair, child, elderly.
- reply: 1–2 short, warm spoken sentences in natural Azerbaijani, as Əhməd talking to the user ("sən"). Explain the recommended option for the chosen preference using ONLY the route facts below (mode, minutes, crossings, warnings). Never invent streets, numbers or facts. Never say "100% təhlükəsiz" or "tam təhlükəsiz" — say "ən az riskli" or "daha təhlükəsiz". If the safest option avoids a risk that the fastest one has (e.g. taxi drops you on the wrong side of a 6-lane road), mention it briefly. If destinationId is "unknown", say kindly that you could not find that place and suggest 2–3 catalog places by name.

Route facts (current time of day already applied to the scores):
${routeFacts(night)}`;
}

type Raw = {
  transcript: string;
  destinationId: string;
  timeOfDay: 'day' | 'night' | 'unspecified';
  profile: Profile;
  preference: RouteKind;
  companions: string[];
  reply: string;
};

export function scriptedReply(destId: string | null, pref: RouteKind, night: boolean): string {
  if (!destId) {
    return 'Bu ünvanı tapa bilmədim. Hilton, İçərişəhər və ya Gənclik Mall-a getmək istəyirsən?';
  }
  const d = destById(destId);
  const o = optionOf(destId, pref) ?? optionOf(destId, 'safest');
  if (!d || !o) return 'Bir saniyə, marşrutu hazırlayıram.';
  const fast = optionOf(destId, 'fastest');
  const s = score(o, night);
  if (pref === 'safest') {
    const why = o.reasons.slice(0, 2).join(', ').toLowerCase();
    const extra = fast?.warning ? ` Taksi isə ${fast.warning.split(' · ')[0].toLowerCase()}.` : '';
    return `${d.short} üçün ən az riskli yol: ${summary(o).toLowerCase()}, ${o.durationMin} dəqiqə. ${why.charAt(0).toUpperCase() + why.slice(1)}, təhlükəsizlik balı ${s}.${extra}`;
  }
  if (pref === 'cheapest') {
    return `${d.short} üçün ən sərfəli yol ${o.price}: ${summary(o).toLowerCase()}, ${o.durationMin} dəqiqə. Amma diqqət: ${o.warning?.toLowerCase() ?? 'bəzi keçidlər risklidir'}.`;
  }
  return `Taksi ilə ${o.durationMin} dəqiqəyə çatarsan, təxminən ${o.price}. ${o.warning ? 'Diqqət: ' + o.warning.toLowerCase() + '.' : ''}`;
}

function fromIntent(text: string, night: boolean, source: AhmedResult['source']): AhmedResult {
  const it = matchIntent(text);
  const tod: TimeOfDay | null = it.timeOfDay;
  return {
    transcript: text,
    destId: it.destId,
    timeOfDay: tod,
    profile: it.profile,
    preference: it.preference,
    companions: it.companions,
    reply: scriptedReply(it.destId, it.preference, tod ? tod === 'night' : night),
    source,
  };
}

/**
 * Ask Əhməd. Uses Gemini when enabled; on any failure (no key, offline, timeout,
 * bad JSON) falls back to the offline keyword matcher + scripted reply.
 */
export async function askAhmed(
  input: { text?: string; audioB64?: string; mime?: string },
  opts: { aiEnabled: boolean; night: boolean },
): Promise<AhmedResult> {
  const useAi = opts.aiEnabled && !!GEMINI_KEY;
  if (useAi) {
    try {
      const parts = input.audioB64
        ? [
            { inlineData: { mimeType: input.mime ?? 'audio/m4a', data: input.audioB64 } },
            { text: 'Bu səsli sorğunu emal et.' },
          ]
        : [{ text: input.text ?? '' }];
      const r = await geminiJson<Raw>({ system: systemPrompt(opts.night), parts, schema: SCHEMA, timeoutMs: 9000 });
      const destId = r.destinationId && r.destinationId !== 'unknown' && destById(r.destinationId) ? r.destinationId : null;
      return {
        transcript: (r.transcript || input.text || '').trim(),
        destId,
        timeOfDay: r.timeOfDay === 'unspecified' ? null : r.timeOfDay,
        profile: r.profile ?? 'daily',
        preference: r.preference ?? 'safest',
        companions: r.companions ?? [],
        reply: (r.reply || '').trim() || scriptedReply(destId, r.preference ?? 'safest', opts.night),
        source: 'ai',
      };
    } catch (e) {
      console.warn('[Əhməd] AI failed, using fallback:', String(e));
    }
  }
  // Offline / fallback path. Audio we can't transcribe -> scripted demo sentence.
  return fromIntent(input.text?.trim() || DEMO_SENTENCE, opts.night, 'fallback');
}

export { KIND_TITLE };
