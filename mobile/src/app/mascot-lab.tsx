import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Easing, useFrameCallback, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Ahmed, AhmedArt, AhmedDropIn, AhmedHead, AhmedWalker, AHMED_POSES, type AhmedCrop, type AhmedPose, type AhmedProp } from '@/features/mascot';
import { useLocalSearchParams } from 'expo-router';
import { C } from '@/theme';

function Btn({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ paddingHorizontal: 12, height: 34, borderRadius: 17, justifyContent: 'center', backgroundColor: on ? C.route : C.bg2, margin: 3 }}
    >
      <Text style={{ color: on ? '#FFF' : C.ink, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

/** Dev screen: every pose / prop / crop of Əhməd + lip-sync oscillator, walker and drop-in. */
export default function MascotLab() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ pose?: string; prop?: string; crop?: string; osc?: string; facing?: string }>();
  const [pose, setPose] = useState<AhmedPose>((params.pose as AhmedPose) || 'idle');
  const [prop, setProp] = useState<AhmedProp>((params.prop as AhmedProp) || 'none');
  const [crop, setCrop] = useState<AhmedCrop>((params.crop as AhmedCrop) || 'full');
  const [facing, setFacing] = useState<'left' | 'right'>(params.facing === 'left' ? 'left' : 'right');
  const [osc, setOsc] = useState(params.osc === '1');
  const [speaking, setSpeaking] = useState(false);
  const [angle, setAngle] = useState(0);
  const [drop, setDrop] = useState(0);
  const level = useSharedValue(0);
  const progress = useSharedValue(0);

  // fake speech-like level: syllable bursts with pauses
  useFrameCallback((fi) => {
    'worklet';
    if (!osc) {
      level.value = 0;
      return;
    }
    const t = fi.timestamp / 1000;
    const syl = Math.max(0, Math.sin(t * 2 * Math.PI * 4.2));
    const phrase = Math.sin(t * 1.3) > -0.6 ? 1 : 0;
    level.value = phrase * Math.pow(syl, 0.7) * (0.55 + 0.45 * Math.abs(Math.sin(t * 2.7)));
  });
  useEffect(() => {
    progress.value = withRepeat(
      withSequence(withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 1500 }), withTiming(0, { duration: 10 })),
      -1,
      false,
    );
  }, [progress]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 60, paddingHorizontal: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: C.ink, marginBottom: 4 }}>Əhməd lab · {pose}</Text>
      <View style={{ height: 300, alignItems: 'center', justifyContent: 'flex-end' }}>
        <Ahmed
          size={crop === 'full' ? 280 : 200}
          pose={pose}
          prop={prop}
          crop={crop}
          facing={facing}
          level={osc ? level : undefined}
          speaking={speaking}
          pointAngle={angle}
          interactive
        />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
        {AHMED_POSES.map((p) => (
          <Btn key={p} label={p} on={p === pose} onPress={() => setPose(p)} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {(['none', 'magnifier', 'flashlight'] as AhmedProp[]).map((p) => (
          <Btn key={p} label={`prop:${p}`} on={p === prop} onPress={() => setProp(p)} />
        ))}
        {(['full', 'bust', 'head'] as AhmedCrop[]).map((c) => (
          <Btn key={c} label={c} on={c === crop} onPress={() => setCrop(c)} />
        ))}
        <Btn label={`facing:${facing}`} onPress={() => setFacing(facing === 'left' ? 'right' : 'left')} />
        <Btn label="level osc" on={osc} onPress={() => setOsc(!osc)} />
        <Btn label="speaking" on={speaking} onPress={() => setSpeaking(!speaking)} />
        {[0, 45, 90, 180, -45, -135].map((a) => (
          <Btn key={a} label={`∠${a}`} on={angle === a} onPress={() => setAngle(a)} />
        ))}
      </View>

      <Text style={{ fontWeight: '800', color: C.ink, marginTop: 16 }}>AhmedWalker</Text>
      <View style={{ height: 70, backgroundColor: C.surface, borderRadius: 16, justifyContent: 'center', paddingHorizontal: 8, marginTop: 6 }}>
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 14, height: 4, borderRadius: 2, backgroundColor: C.line }} />
        <AhmedWalker progress={progress} width={330} size={56} />
      </View>

      <Text style={{ fontWeight: '800', color: C.ink, marginTop: 16 }}>Heads · static art</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 6 }}>
        <AhmedHead size={72} />
        <AhmedHead size={48} mood="talk" />
        <AhmedHead size={36} mood="think" />
        <AhmedArt size={72} crop="head" />
        <AhmedArt size={90} pose="wave" />
      </View>

      <Text style={{ fontWeight: '800', color: C.ink, marginTop: 16 }}>AhmedDropIn</Text>
      <Btn label="replay drop-in" onPress={() => setDrop((d) => d + 1)} />
      <View style={{ height: 200, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}>
        <AhmedDropIn key={drop} size={170} then="wave" />
      </View>
    </ScrollView>
  );
}
