/** Spoken lines owned by lane "scan" — exact strings passed to say(). No RN imports. */
import SAMPLES from '../../features/scan/samples.json';

export const SCAN = {
  unclear: 'Keçidi yaxşı görə bilmədim. Keçidi kadrın ortasına al və yenidən çək.',
  notStreet: 'Bu kadrda keçid görmədim. Kameranı yola tut ki, keçid kadrın ortasında olsun.',
  weak: 'Bağlantı bir az zəifdir. Bir azdan yenidən çək, ya da nümunələrdən birini seç.',
  added: 'Təşəkkürlər! Bu keçid Təhlükəsizlik Qatına əlavə olundu.',
} as const;

/** The bundled sample answers (genuine model output) are spoken verbatim, so they get clips too. */
const sampleSummaries = Object.values((SAMPLES as { samples: Record<string, { summary_az?: string }> }).samples)
  .map((s) => s.summary_az ?? '')
  .filter(Boolean);

export const SCAN_LINES: string[] = [...Object.values(SCAN), ...sampleSummaries];
