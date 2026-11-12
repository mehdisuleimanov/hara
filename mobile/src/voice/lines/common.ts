/**
 * Spoken lines (Azerbaijani). Everything listed in lines/*.ts gets a pre-generated clip
 * (scripts/gen-voice.ts). Keep strings EXACTLY identical to what the app passes to say().
 * No React Native imports in this folder (the generator runs in Node).
 */
export const COMMON = {
  greet: 'Salam! Mən Əhmədəm. Hara gedirik?',
  greetNight: 'Axşamın xeyir! Mən Əhmədəm. Hara gedirik?',
  didntHear: 'Bağışla, səsini aydın eşitmədim. Bir də de, ya da aşağıdan seç.',
  tooShort: 'Bir az uzun de, səni dinləyirəm.',
  unknownPlace: 'Bu yeri hələ tanımıram. Ünvanı bir az dəqiq de, ya da yaxınlıqdakı tanınmış yeri söylə.',
  thinking: 'Bir saniyə, ən az riskli yolu yoxlayıram.',
  arrived: 'Çatdın! Yaxşı yol oldu.',
} as const;

export const COMMON_LINES: string[] = Object.values(COMMON);
