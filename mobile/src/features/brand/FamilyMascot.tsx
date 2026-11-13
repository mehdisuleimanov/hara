import React from 'react';
import { Ahmed } from '@/features/mascot';

export type MascotPose = 'wave' | 'idle' | 'point' | 'celebrate' | 'walk' | 'talk';


/**
 * Full-body Əhməd for Hara Ailə (family). Single swap point: replace the body with the animated
 * `<Ahmed pose={pose} size={size} speaking={speaking} />` (features/mascot) at merge.
 */
export function FamilyMascot({ pose, size, speaking }: { pose: MascotPose; size: number; speaking?: boolean }) {
  return <Ahmed size={size * 1.07} pose={speaking ? 'talk' : pose} speaking={speaking} glow interactive />;
}
