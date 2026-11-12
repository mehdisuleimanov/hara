import type { ImageSourcePropType } from 'react-native';
import { sanitize, type VisionAttrs } from '@/ai/vision';
import DATA from './samples.json';
import CREDITS from '../../../assets/scan/credits.json';

export type SampleId = 'signal' | 'unmarked' | 'underpass';

export type Sample = {
  id: SampleId;
  title: string;
  sub: string;
  image: ImageSourcePropType;
  width: number;
  height: number;
  /** genuine Gemini Vision answer, produced by scripts/precompute-scan.mjs */
  attrs: VisionAttrs;
  credit: string;
};

const META: Record<SampleId, { title: string; sub: string; image: ImageSourcePropType }> = {
  signal: { title: 'Azad Mirzəyev', sub: 'Zebra keçid', image: require('../../../assets/scan/signal.jpg') },
  unmarked: { title: 'Koroğlu', sub: 'Geniş prospekt', image: require('../../../assets/scan/unmarked.jpg') },
  underpass: { title: 'Yeraltı keçid', sub: 'Eskalatorlu giriş', image: require('../../../assets/scan/underpass.jpg') },
};

type Credit = { file: string; author: string; license: string; width: number; height: number };
const samplesRaw = (DATA as unknown as { samples: Record<string, Partial<VisionAttrs>> }).samples;

export const SAMPLES: Sample[] = (['signal', 'unmarked', 'underpass'] as SampleId[]).map((id) => {
  const c = (CREDITS as Credit[]).find((x) => x.file === `${id}.jpg`);
  return {
    id,
    ...META[id],
    width: c?.width ?? 1280,
    height: c?.height ?? 960,
    attrs: sanitize(samplesRaw[id] ?? {}),
    credit: c ? `Foto: ${c.author}, ${c.license}` : '',
  };
});

export const SAMPLE_CREDITS = `Fotolar: ${(CREDITS as Credit[]).map((c) => c.author).join(', ')} · CC BY-SA · Wikimedia Commons`;
