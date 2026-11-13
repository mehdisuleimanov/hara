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
  /** dark basemap (satellite): dark casing under the colored streets */
  dark?: boolean;
  /** meters per screen point at the current zoom — crossing dots keep a readable size */
  mpp?: number;
  /** progressive reveal: 0 nothing, 1 streets, 2 streets + crossings */
  stage?: 0 | 1 | 2;
};

const SEG_WIDTH = [5, 4.5, 4, 3.5, 3, 3];

/**
 * Bakı Təhlükəsizlik Qatı: colored street segments, crossing dots (white halo ring, sized
 * in screen points so they read at any zoom) and a risk heatmap when zoomed out.
 */
export const SafetyLayer = memo(function SafetyLayer({ segs, cross, heat, night, zoomedOut, selected, dark, mpp, stage = 2 }: Props) {
  if (stage === 0) return null;
  const px = mpp ?? 1.2;
  return (
    <>
      {dark
        ? segs.map((i) => (
            <Polyline key={`k${i}`} coordinates={segCoords(i)} strokeColor="rgba(10,18,32,0.55)" strokeWidth={(SEG_WIDTH[LAYER.segments[i].k] ?? 3) + 3} lineCap="round" zIndex={1} />
          ))
        : null}
      {segs.map((i) => {
        const s = LAYER.segments[i];
        const v = night ? s.n : s.d;
        return (
          <Polyline
            key={`s${i}`}
            coordinates={segCoords(i)}
            strokeColor={scoreColor(v) + (dark || night ? 'E6' : zoomedOut ? 'CC' : 'B3')}
            strokeWidth={SEG_WIDTH[s.k] ?? 3}
            lineCap="round"
            zIndex={2}
          />
        );
      })}
      {heat.length > 2 && stage >= 2 ? (
        <Heatmap
          points={heat}
          radius={40}
          opacity={0.75}
          gradient={{ colors: ['#F2A900', '#F57A2E', '#F0435A'], startPoints: [0.1, 0.5, 0.9], colorMapSize: 256 }}
        />
      ) : null}
      {stage >= 2
        ? cross.map((i) => {
            const c = LAYER.crossings[i];
            const v = night ? c[4] : c[3];
            const isSel = i === selected;
            const r = Math.max(5, Math.min(60, px * (isSel ? 9 : v < 55 ? 5.5 : 4.2)));
            return (
              <Circle
                key={`c${i}`}
                center={{ latitude: c[0], longitude: c[1] }}
                radius={r}
                fillColor={scoreColor(v)}
                strokeColor="#FFFFFF"
                strokeWidth={isSel ? 4 : 2}
                zIndex={isSel ? 6 : v < 55 ? 5 : 4}
              />
            );
          })
        : null}
    </>
  );
});
