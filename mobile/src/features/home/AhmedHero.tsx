import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { AhmedAvatar } from '@/components/Brand';
import { Pulse, Float } from '@/components/anim';
import { Icon, Txt } from '@/components/ui';
import { Glow, PressableScale, enter, useTypewriter } from '@/motion';
import { say, useVoice } from '@/voice';
import { C, R, shadow } from '@/theme';

/** Əhməd companion card: glowing mascot, live context line (typewriter), voice + text entry. */
export function AhmedHero({ line }: { line: string }) {
  const [shown] = useTypewriter(line, 48);
  const { speaking, text } = useVoice();
  const talking = speaking && text === line;
  return (
    <Animated.View entering={enter(1)}>
      <LinearGradient colors={['#EEF0FF', '#F2F7FF', '#EEF9F3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.head}>
          <View style={styles.badge}>
            <View style={styles.live} />
            <Txt w="bold" size={12.5} color={C.ai}>
              Əhməd · AI yoldaşın
            </Txt>
          </View>
          <Txt w="semi" size={12} color={C.muted}>
            Azərbaycanca danışır
          </Txt>
        </View>

        <View style={styles.body}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Əhmədi dinlə"
            scaleTo={0.92}
            onPress={() => say(line)}
            style={styles.mascotWrap}
          >
            <Glow size={190} color={C.ai} intensity={0.38} style={{ left: -40, top: -36 }} />
            <Float amplitude={4}>
              <AhmedAvatar size={104} full glow={false} mood={talking ? 'talk' : 'smile'} />
            </Float>
          </PressableScale>
          <View style={styles.bubble}>
            <View style={styles.tail} />
            <Txt w="semi" size={15} lh={21} color={C.ink}>
              {shown}
              <Txt w="semi" size={15} color="transparent">
                {line.slice(shown.length)}
              </Txt>
            </Txt>
          </View>
        </View>

        <PressableScale
          haptic="medium"
          scaleTo={0.97}
          accessibilityRole="button"
          accessibilityLabel="Əhmədə səslə de"
          onPress={() => router.push('/ahmed')}
          style={styles.voice}
        >
          <View style={styles.micWrap}>
            <Pulse size={56} color={C.brand} />
            <View style={styles.mic}>
              <Icon name="microphone" size={26} color="#FFFFFF" />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Txt w="bold" size={17.5} color="#FFFFFF">
              Əhmədə de
            </Txt>
            <Txt w="med" size={12.5} color="rgba(255,255,255,0.72)">
              «Hiltona ən az riskli yol»
            </Txt>
          </View>
          <View style={styles.bars}>
            {[10, 18, 26, 16, 22, 12].map((h, i) => (
              <View key={i} style={[styles.bar, { height: h, opacity: 0.45 + (i % 3) * 0.2 }]} />
            ))}
          </View>
        </PressableScale>
      </LinearGradient>

      <PressableScale
        accessibilityRole="search"
        accessibilityLabel="Yer, ünvan və ya sual yaz"
        scaleTo={0.98}
        onPress={() => router.push('/ahmed?mode=text')}
        style={styles.search}
      >
        <Icon name="magnify" size={24} color={C.ink} />
        <Txt w="med" size={15} color={C.muted} style={{ flex: 1 }} numberOfLines={1}>
          Yer, ünvan və ya sual yaz
        </Txt>
        <View style={styles.kbd}>
          <Icon name="keyboard-outline" size={20} color={C.ink} />
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: R.card, padding: 14, paddingTop: 14, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFFFFF', borderRadius: R.pill, paddingHorizontal: 12, height: 30 },
  live: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.brand },
  body: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  mascotWrap: { width: 112, height: 124, alignItems: 'center', justifyContent: 'center' },
  bubble: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderTopLeftRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...shadow(1),
  },
  tail: {
    position: 'absolute',
    left: -6,
    top: 12,
    width: 14,
    height: 14,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
    borderRadius: 2,
  },
  voice: {
    marginTop: 10,
    height: 72,
    borderRadius: R.pill,
    backgroundColor: C.navy,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingLeft: 8,
    paddingRight: 22,
    ...shadow(2),
  },
  micWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  mic: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  bar: { width: 3.5, borderRadius: 2, backgroundColor: C.brand },
  search: {
    marginTop: 10,
    height: 58,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 20,
    paddingRight: 7,
  },
  kbd: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});
