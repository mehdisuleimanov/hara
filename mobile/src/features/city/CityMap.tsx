import React, { forwardRef, memo, useImperativeHandle, useMemo, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Circle, Heatmap, PROVIDER_GOOGLE } from 'react-native-maps';
import { MAP_STYLE } from '@/components/mapStyle';
import { LAYER } from '@/data/layer';
import { demandHeat, RED, T_UNDERGROUND, type Mode, type RiskSpot } from '@/data/city';
import { C, scoreColor } from '@/theme';

export type CityMapHandle = { flyTo: (lat: number, lon: number, delta?: number) => void; overview: () => void };
export type MapLayer = 'risk' | 'flow';

const CENTER = { latitude: 40.395, longitude: 49.86, latitudeDelta: 0.13, longitudeDelta: 0.13 };

/** Mini-map: red-crossing density + top-10 dots (risk) or modelled pedestrian demand (flow). */
export const CityMap = memo(
  forwardRef<CityMapHandle, { mode: Mode; layer: MapLayer; spots: RiskSpot[]; selected: { lat: number; lon: number } | null; height: number }>(function CityMap(
    { mode, layer, spots, selected, height },
    ref,
  ) {
    const map = useRef<MapView>(null);
    useImperativeHandle(ref, () => ({
      flyTo: (lat, lon, delta = 0.012) => map.current?.animateToRegion({ latitude: lat, longitude: lon, latitudeDelta: delta, longitudeDelta: delta }, 700),
      overview: () => map.current?.animateToRegion(CENTER, 700),
    }));

    // risk density: every at-grade crossing that is red in this mode (real layer scores)
    const riskHeat = useMemo(() => {
      const out: { latitude: number; longitude: number; weight: number }[] = [];
      for (const c of LAYER.crossings) {
        if (c[2] === T_UNDERGROUND) continue;
        const v = mode === 'night' ? c[4] : c[3];
        // only the clearly red ones, weighted by how far below the threshold they are
        if (v < RED - 10) {
          const w = (RED - v) / RED;
          out.push({ latitude: c[0], longitude: c[1], weight: w * w });
        }
      }
      return out;
    }, [mode]);
    const flow = useMemo(() => demandHeat(), []);

    return (
      <View style={{ height, borderRadius: 24, overflow: 'hidden', backgroundColor: C.bg2 }}>
        <MapView
          ref={map}
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          mapType="standard"
          customMapStyle={MAP_STYLE}
          initialRegion={CENTER}
          toolbarEnabled={false}
          showsCompass={false}
          showsPointsOfInterests={false}
          rotateEnabled={false}
          pitchEnabled={false}
          moveOnMarkerPress={false}
        >
          {layer === 'risk' ? (
            <Heatmap
              key={`risk-${mode}`}
              points={riskHeat}
              radius={22}
              opacity={0.62}
              gradient={{ colors: ['#F2A900', '#F57A2E', '#E5484D'], startPoints: [0.08, 0.45, 0.9], colorMapSize: 256 }}
            />
          ) : (
            <Heatmap
              key="flow"
              points={flow}
              radius={30}
              opacity={0.7}
              gradient={{ colors: ['#9EC5FF', '#5B5BF6', '#3A2BB8'], startPoints: [0.08, 0.5, 0.92], colorMapSize: 256 }}
            />
          )}
          {spots.map((s) => {
            const sel = !!selected && selected.lat === s.lat && selected.lon === s.lon;
            return (
              <Circle
                key={`${mode}-${s.idx}`}
                center={{ latitude: s.lat, longitude: s.lon }}
                radius={sel ? 75 : 120}
                fillColor={layer === 'risk' ? scoreColor(s.score) : C.ai}
                strokeColor="#FFFFFF"
                strokeWidth={sel ? 4 : 2.5}
                zIndex={sel ? 6 : 4}
              />
            );
          })}
          {selected ? (
            <Circle
              key={`halo-${selected.lat}-${selected.lon}`}
              center={{ latitude: selected.lat, longitude: selected.lon }}
              radius={230}
              fillColor="rgba(31,111,235,0.12)"
              strokeColor={C.route}
              strokeWidth={2}
              zIndex={3}
            />
          ) : null}
        </MapView>
      </View>
    );
  }),
);
