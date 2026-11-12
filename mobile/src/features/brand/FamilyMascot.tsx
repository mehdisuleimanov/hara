import React from 'react';
import { AhmedAvatar, type AhmedMood } from '@/components/Brand';

export type MascotPose = 'wave' | 'idle' | 'point' | 'celebrate' | 'walk' | 'talk';

const MOOD: Record<MascotPose, AhmedMood> = {
  wave: 'wave',
  idle: 'smile',
  point: 'smile',
  celebrate: 'wave',
  walk: 'smile',
  talk: 'talk',
};

/**
 * Full-body Əhməd for Hara Ailə (family). Single swap point: replace the body with the animated
 * `<Ahmed pose={pose} size={size} speaking={speaking} />` (features/mascot) at merge.
 */
export function FamilyMascot({ pose, size, speaking }: { pose: MascotPose; size: number; speaking?: boolean }) {
  return <AhmedAvatar full size={size} mood={MOOD[pose]} speaking={speaking} bob />;
}
