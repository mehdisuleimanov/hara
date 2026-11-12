import React, { memo } from 'react';
import { Circle, Heatmap, Polyline } from 'react-native-maps';
import { LAYER, segCoords } from '@/data/layer';
import { scoreColor } from '@/theme';

type Props = {
  segs: number[];
  cross: number[];
  heat: { latitude: number; longitude: number; weight: number }[];
  night: boolean;
  zoomedOut: boolean;
  selected?: number;
};

const SEG_WIDTH = [5, 4.5, 4, 3.5, 3, 3];

/** Bakı Təhlükəsizlik Qatı: colored street segments, crossing dots and a risk heatmap. */
export const SafetyLayer = memo(function SafetyLayer({ segs, cross, heat, night, zoomedOut, selected }: Props) {
  return (
    <>
      {segs.map((i) => {
        const s = LAYER.segments[i];
        const v = night ? s.n : s.d;
        return (
          <Polyline
            key={`s${i}`}
            coordinates={segCoords(i)}
            strokeColor={scoreColor(v) + (zoomedOut ? 'CC' : 'B3')}
            strokeWidth={SEG_WIDTH[s.k] ?? 3}
            lineCap="round"
            zIndex={1}
          />
        );
      })}
      {heat.length > 2 ? (
        <Heatmap
          points={heat}
          radius={40}
          opacity={0.75}
          gradient={{ colors: ['#F2A900', '#F57A2E', '#F0435A'], startPoints: [0.1, 0.5, 0.9], colorMapSize: 256 }}
        />
      ) : null}
      {cross.map((i) => {
        const c = LAYER.crossings[i];
        const v = night ? c[4] : c[3];
        const isSel = i === selected;
        return (
          <Circle
            key={`c${i}`}
            center={{ latitude: c[0], longitude: c[1] }}
            radius={isSel ? 14 : v < 55 ? 8 : 6}
            fillColor={scoreColor(v)}
            strokeColor="#FFFFFF"
            strokeWidth={isSel ? 4 : 2}
            zIndex={isSel ? 5 : 3}
          />
        );
      })}
    </>
  );
});
