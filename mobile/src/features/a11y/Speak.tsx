import React from 'react';
import { Pressable, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import { create } from 'zustand';
import { say } from '@/voice';
import { tap } from '@/components/ui';
import { C } from '@/theme';
import type { MorphOrigin } from './morph';

/** Which Speak block is being read aloud right now (one shared subscription, no per-item timers). */
const useSpeaking = create<{ cur: string | null }>(() => ({ cur: null }));

export function speakText(text: string) {
  useSpeaking.setState({ cur: text });
  say(text, {
    onDone: () => {
      if (useSpeaking.getState().cur === text) useSpeaking.setState({ cur: null });
    },
  });
  // safety: never leave a highlight stuck if playback is interrupted
  setTimeout(() => {
    if (useSpeaking.getState().cur === text) useSpeaking.setState({ cur: null });
  }, Math.min(9000, 1200 + text.length * 70));
}

/** Tap a text block → Əhməd reads it aloud; the block glows softly while speaking. */
export function Speak({
  text,
  children,
  style,
  radius = 14,
}: {
  text: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
}) {
  const on = useSpeaking((s) => s.cur === text);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityHint="Səsli oxu"
      onPress={() => {
        tap();
        speakText(text);
      }}
      style={[style, { borderRadius: radius }, on && { backgroundColor: C.aiSoft }]}
    >
      {children}
    </Pressable>
  );
}

/** Screen point of a touch → origin for morphTo(). */
export function pointOf(e?: GestureResponderEvent): MorphOrigin | undefined {
  const n = e?.nativeEvent;
  if (!n || typeof n.pageX !== 'number') return undefined;
  return { x: n.pageX, y: n.pageY };
}
