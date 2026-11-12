import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAudioRecorderState, type AudioRecorder } from 'expo-audio';
import { AhmedAvatar } from '@/components/Brand';
import { Pulse } from '@/components/anim';
import { Waveform } from '@/components/Waveform';
import { Icon, Txt } from '@/components/ui';
import { PressableScale, enter, useTypewriter } from '@/motion';
import { useFx, useTheme } from '@/hooks/useTheme';
import { C, R, shadow } from '@/theme';

/**
 * Hidden stage trigger: TWO long-presses (≥ 1.2 s each) within 4 s run the prepared sentence.
 * Looks like a plain avatar to everyone else.
 */
export function StageTrigger({ onFire, children, style }: { onFire: () => void; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const first = useRef(0);
  return (
    <Pressable
      style={style}
      delayLongPress={1200}
      accessible={false}
      onLongPress={() => {
        const now = Date.now();
        if (now - first.current < 4000) {
          first.current = 0;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          onFire();
        } else {
          first.current = now;
          Haptics.selectionAsync().catch(() => {});
        }
      }}
    >
      {children}
    </Pressable>
  );
}

/** Əhməd's face; the mouth opens with the voice level (two static SVGs, opacity on the UI thread). */
export function TalkingAvatar({ size, level, speaking }: { size: number; level: SharedValue<number>; speaking: boolean }) {
  const talk = useAnimatedStyle(() => ({ opacity: speaking && level.value > 0.45 ? 1 : 0 }));
  return (
    <View style={{ width: size, height: size * 1.16 }}>
      <AhmedAvatar size={size} mood="smile" />
      <Animated.View style={[StyleSheet.absoluteFill, talk]}>
        <AhmedAvatar size={size} mood="talk" />
      </Animated.View>
    </View>
  );
}

/** Əhməd's answer: springs in, text writes itself while he speaks. */
export function ReplyBubble({ text, level, speaking }: { text: string; level: SharedValue<number>; speaking: boolean }) {
  const t = useTheme();
  const [shown] = useTypewriter(text, 70);
  return (
    <Animated.View entering={enter(0, 'pop')} style={[styles.reply, t.hc && styles.hc]}>
      <View style={styles.replyAvatar}>
        <TalkingAvatar size={30} level={level} speaking={speaking} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt v="overline" color={C.brandDark} style={{ marginBottom: 4 }}>
          Əhməd
        </Txt>
        <Txt v="body" color={C.ink} lh={22} accessibilityLabel={text}>
          {shown}
          <Txt v="body" color="transparent">
            {text.slice(shown.length)}
          </Txt>
        </Txt>
      </View>
    </Animated.View>
  );
}

export type Suggestion = { label: string; icon: string; onPress: () => void };

/** Staggered suggestion / follow-up chips. */
export function ChipRow({ items, base = 0 }: { items: Suggestion[]; base?: number }) {
  return (
    <View style={styles.chips}>
      {items.map((s, i) => (
        <Animated.View key={s.label} entering={enter(i, 'up', base)}>
          <PressableScale accessibilityRole="button" onPress={s.onPress} style={styles.chip}>
            <Icon name={s.icon} size={17} color={C.route} />
            <Txt v="label" color={C.ink}>
              {s.label}
            </Txt>
          </PressableScale>
        </Animated.View>
      ))}
    </View>
  );
}

/** Big mic button (green → blue). Pulses while listening. */
export function MicButton({ listening, disabled, onPress, size = 84 }: { listening: boolean; disabled?: boolean; onPress: () => void; size?: number }) {
  const t = useTheme();
  const sz = Math.round(size * Math.min(t.s, 1.15));
  return (
    <View style={{ width: sz + 40, height: sz + 40, alignItems: 'center', justifyContent: 'center' }}>
      {listening ? <Pulse size={sz} color={C.brand} duration={1400} /> : null}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={listening ? 'Göndər' : 'Əhmədə danış'}
        haptic="medium"
        scaleTo={0.92}
        disabled={disabled}
        onPress={onPress}
        style={[{ width: sz, height: sz, borderRadius: sz / 2, opacity: disabled ? 0.5 : 1 }, shadow(3)]}
      >
        <LinearGradient colors={['#5FD99E', C.brand, C.route]} start={{ x: 0.1, y: 0 }} end={{ x: 0.95, y: 1 }} style={[styles.mic, { borderRadius: sz / 2 }]}>
          <Icon name={listening ? 'arrow-up' : 'microphone'} size={sz * 0.4} color="#FFFFFF" />
        </LinearGradient>
      </PressableScale>
    </View>
  );
}

/** Reads mic metering (re-renders only itself) → shared level + live waveform + timer. */
export function ListeningMeter({ recorder, level, onLimit, limitMs = 15000 }: { recorder: AudioRecorder; level: SharedValue<number>; onLimit: () => void; limitMs?: number }) {
  const st = useAudioRecorderState(recorder, 80);
  const db = st.metering;
  const l = st.isRecording && db != null ? Math.max(0, Math.min(1, (db + 50) / 40)) : 0;
  useEffect(() => {
    level.value = withTiming(l, { duration: 90 });
  }, [l, level]);
  const ms = st.durationMillis ?? 0;
  const fired = useRef(false);
  useEffect(() => {
    if (ms >= limitMs && !fired.current) {
      fired.current = true;
      onLimit();
    }
  }, [ms, limitMs, onLimit]);
  const s = Math.floor(ms / 1000);
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <Waveform level={l} active={st.isRecording} color={C.route} height={36} bars={30} />
      <Txt v="label" color={C.muted} style={{ fontVariant: ['tabular-nums'] }}>
        {`0:${String(Math.min(s, 59)).padStart(2, '0')}`}
      </Txt>
    </View>
  );
}

/** "Opening the route" card with a progress line; tap to open now. */
export function HandoffCard({ title, sub, ms, onOpen }: { title: string; sub: string; ms: number; onOpen: () => void }) {
  const { lite } = useFx();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    p.value = withTiming(1, { duration: Math.max(300, ms), easing: Easing.linear });
  }, [ms, p]);
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: p.value }] }));
  return (
    <Animated.View entering={lite ? FadeIn : enter(1, 'up')} style={{ alignSelf: 'stretch' }}>
      <PressableScale accessibilityRole="button" accessibilityLabel={`${title}. Marşrutu aç`} haptic="medium" onPress={onOpen} style={styles.handoff}>
        <View style={styles.handoffIcon}>
          <Icon name="map-marker-path" size={22} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Txt v="title" color={C.ink} numberOfLines={1}>
            {title}
          </Txt>
          <Txt v="caption" color={C.muted} numberOfLines={1}>
            {sub}
          </Txt>
        </View>
        <View style={styles.handoffGo}>
          <Txt v="label" color="#FFFFFF">
            Aç
          </Txt>
          <Icon name="arrow-right" size={16} color="#FFFFFF" />
        </View>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, bar]} />
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hc: { borderWidth: 2, borderColor: '#0F1B2D' },
  reply: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 12,
    backgroundColor: C.brandSofter,
    borderRadius: R.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D5F2E3',
  },
  replyAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(1),
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  mic: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  handoff: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: R.lg,
    padding: 12,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
    ...shadow(2),
  },
  handoffIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.route, alignItems: 'center', justifyContent: 'center' },
  handoffGo: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.brand, borderRadius: R.pill, paddingHorizontal: 14, height: 36 },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: C.bg2 },
  fill: { flex: 1, backgroundColor: C.route, transformOrigin: 'left' },
});
