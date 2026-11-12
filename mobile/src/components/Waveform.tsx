import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { C } from '@/theme';

/** Small live waveform; bar heights follow the mic level when active. */
export function Waveform({
  level,
  active,
  bars = 9,
  color = C.ink,
  height = 34,
}: {
  level: number;
  active: boolean;
  bars?: number;
  color?: string;
  height?: number;
}) {
  const [seed, setSeed] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setSeed((s) => s + 1), 90);
    return () => clearInterval(id);
  }, [active]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height }}>
      {Array.from({ length: bars }).map((_, i) => {
        const center = 1 - Math.abs(i - (bars - 1) / 2) / ((bars - 1) / 2);
        const jitter = active ? 0.55 + 0.45 * Math.abs(Math.sin(seed * 0.9 + i * 1.7)) : 0.3;
        const h = Math.max(5, height * (0.18 + 0.82 * center * Math.max(0.25, level) * jitter));
        return (
          <View
            key={i}
            style={{ width: 5, height: h, borderRadius: 3, backgroundColor: color, opacity: 0.35 + center * 0.65 }}
          />
        );
      })}
    </View>
  );
}
