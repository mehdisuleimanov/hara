import React from 'react';
import { useTheme } from '@/hooks/useTheme';
import { StandardHome } from '@/features/home/StandardHome';
import { SimpleHome } from '@/features/a11y/SimpleHome';

/** Home: AI-first companion (standard) or the voice-first Sadə rejim (senior / low vision). */
export default function Home() {
  const { simple } = useTheme();
  return simple ? <SimpleHome /> : <StandardHome />;
}
