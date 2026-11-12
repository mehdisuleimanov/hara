import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { AhmedAvatar, Avatar } from '@/components/Brand';
import { Icon, Txt } from '@/components/ui';
import { AnimatedNumber, Glow, PressableScale, SPRING, enter, useTypewriter } from '@/motion';
import { morphTo } from '@/features/a11y/morph';
import { useAppStore } from '@/store/useAppStore';
import { usePrefs } from '@/store/prefs';
import { useVoice, say } from '@/voice';
import { BRAND } from '@/voice/lines/brand';
import { C, R } from '@/theme';
import type { Profile } from '@/data/types';
import { MiniMap } from './MiniMap';

/** Parallax for one page: art drifts slower than the page, text slightly faster; both fade. */
export function useParallax(scrollX: SharedValue<number>, i: number, w: number) {
  const art = useAnimatedStyle(() => {
    const d = scrollX.value - i * w;
    const n = Math.min(1, Math.abs(d) / Math.max(1, w));
    return {
      opacity: interpolate(n, [0, 0.75], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateX: d * 0.45 }, { scale: 1 - n * 0.14 }],
    };
  });
  const text = useAnimatedStyle(() => {
    const d = scrollX.value - i * w;
    const n = Math.min(1, Math.abs(d) / Math.max(1, w));
    return { opacity: interpolate(n, [0, 0.55], [1, 0], Extrapolation.CLAMP), transform: [{ translateX: -d * 0.18 }] };
  });
  return { art, text };
}

/** Title + body block shared by the pages. */
function Copy({ overline, title, body, style }: { overline: string; title: string; body: string; style?: object }) {
  return (
    <Animated.View style={[{ gap: 8 }, style]}>
      <Txt v="overline" color={C.brandDark}>
        {overline}
      </Txt>
      <Txt v="h1" accessibilityRole="header">
        {title}
      </Txt>
      <Txt v="body" color={C.ink2} lh={22}>
        {body}
      </Txt>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ 1 · Əhmədlə tanış ol */

export function MeetAhmed({ scrollX, w, active }: { scrollX: SharedValue<number>; w: number; active: boolean }) {
  const { art, text } = useParallax(scrollX, 0, w);
  const voice = useVoice();
  const [greet, setGreet] = useState('');
  const [shown] = useTypewriter(greet, 38);
  const said = useRef(false);

  useEffect(() => {
    if (!active || said.current) return;
    said.current = true;
    const t1 = setTimeout(() => setGreet('Salam! Mən Əhmədəm.'), 650);
    const t2 = setTimeout(() => say(BRAND.hello), 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [active]);

  // bubble pops in once the greeting starts
  const bubble = useSharedValue(0);
  useEffect(() => {
    if (greet) bubble.value = withSpring(1, SPRING.bouncy);
  }, [greet, bubble]);
  const bubbleA = useAnimatedStyle(() => ({
    opacity: bubble.value,
    transform: [{ translateY: (1 - bubble.value) * 10 }, { scale: 0.85 + 0.15 * bubble.value }],
  }));

  return (
    <View style={[styles.page, { width: w }]}>
      <Animated.View style={[styles.art, art]}>
        <Glow size={Math.min(w * 0.95, 360)} color="#2FE0C0" intensity={0.5} style={{ bottom: -30 }} />
        <Animated.View style={[styles.bubble, bubbleA]}>
          <Txt w="bold" size={15.5} color={C.ink}>
            {shown || ' '}
          </Txt>
          <View style={styles.bubbleTail} />
        </Animated.View>
        <Animated.View entering={enter(0, 'pop', 150)}>
          <AhmedAvatar size={Math.min(w * 0.56, 230)} full mood="wave" speaking={voice.speaking} />
        </Animated.View>
      </Animated.View>
      <Copy
        style={text}
        overline="Səsli yol yoldaşın"
        title="Əhmədlə tanış ol"
        body="Ona sadəcə hara getdiyini de. Əhməd işıqforsuz keçidləri, qaranlıq küçələri və küləyi nəzərə alıb ən az riskli yolu seçir."
      />
    </View>
  );
}

/* ------------------------------------------------------------------ 2 · Ən az riskli yol */

export function SaferRoute({ scrollX, w, active }: { scrollX: SharedValue<number>; w: number; active: boolean }) {
  const { art, text } = useParallax(scrollX, 1, w);
  const said = useRef(false);
  useEffect(() => {
    if (!active || said.current) return;
    said.current = true;
    const t = setTimeout(() => say(BRAND.saferRoute), 500);
    return () => clearTimeout(t);
  }, [active]);
  return (
    <View style={[styles.page, { width: w }]}>
      <Animated.View style={[styles.art, { justifyContent: 'center' }, art]}>
        <View style={styles.mapCard}>
          <MiniMap active={active} />
        </View>
      </Animated.View>
      <Animated.View style={[{ gap: 14 }, text]}>
        <Copy
          overline="Ən qısa yol həmişə ən yaxşısı deyil"
          title="Ən az riskli yol"
          body="6 zolaqlı prospekti işıqforsuz keçmək əvəzinə Əhməd bir az uzaq, amma işıqforlu keçidi seçir."
        />
        <View style={styles.stat}>
          {active ? <AnimatedNumber value={21} v="num" color={C.danger} duration={1100} delay={250} /> : <Txt v="num" color={C.danger}>21</Txt>}
          <Txt v="bodyS" color={C.ink2} style={{ flex: 1 }}>
            piyada Bakıda bu ilin ilk 3 ayında yolda həyatını itirib.
          </Txt>
        </View>
      </Animated.View>
    </View>
  );
}

/* ------------------------------------------------------------------ 3 · Sənə uyğunlaşır */

const PROFILES: { key: Profile; label: string; icon: string; tip: string }[] = [
  { key: 'daily', label: 'Gündəlik', icon: 'walk', tip: 'Hər gün getdiyin yolda ən az riskli keçidləri seçəcəm.' },
  { key: 'accessible', label: 'Əlçatan', icon: 'wheelchair-accessibility', tip: 'Pilləkənsiz yolları, lift və enişləri önə çəkəcəm.' },
  { key: 'family', label: 'Ailə', icon: 'human-male-female-child', tip: 'Uşaq arabası və yaşlılar üçün işıqlı, rahat yollar.' },
  { key: 'scooter', label: 'Skuter', icon: 'scooter', tip: 'Küləyi və velosiped zolaqlarını izləyəcəm.' },
];

function Orbit({ who, x, y, delay, active }: { who: 'aysel' | 'murad' | 'nene'; x: number; y: number; delay: number; active: boolean }) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (active) v.value = withDelay(delay, withSpring(1, SPRING.bouncy));
  }, [active, delay, v]);
  const a = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateX: x * v.value }, { translateY: y * v.value }, { scale: 0.4 + 0.6 * v.value }] }));
  return (
    <Animated.View style={[{ position: 'absolute' }, a]}>
      <Avatar who={who} size={62} ring="#FFFFFF" />
    </Animated.View>
  );
}

export function AdaptsToYou({ scrollX, w, active }: { scrollX: SharedValue<number>; w: number; active: boolean }) {
  const { art, text } = useParallax(scrollX, 2, w);
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  const mode = usePrefs((p) => p.a11yMode);
  const simple = mode !== 'standard';
  const switchRef = useRef<React.ComponentRef<typeof View>>(null);
  const tip = PROFILES.find((p) => p.key === profile)?.tip ?? PROFILES[0].tip;
  const r = Math.min(w * 0.3, 118);

  const toggleSimple = (on: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const go = (origin?: { x: number; y: number }) => {
      morphTo(on ? 'senior' : 'standard', origin);
      if (on) setTimeout(() => say(BRAND.simpleOn), 450);
    };
    if (switchRef.current?.measureInWindow) {
      switchRef.current.measureInWindow((x: number, y: number, ww: number, hh: number) => go({ x: x + ww / 2, y: y + hh / 2 }));
    } else go();
  };

  return (
    <View style={[styles.page, { width: w }]}>
      <Animated.View style={[styles.art, { flex: 0, height: r * 2 + 64, justifyContent: 'center' }, art]}>
        <View style={[styles.ring, { width: r * 2, height: r * 2, borderRadius: r }]} />
        <Orbit who="aysel" x={-r * 0.94} y={-r * 0.34} delay={120} active={active} />
        <Orbit who="murad" x={r * 0.87} y={-r * 0.5} delay={220} active={active} />
        <Orbit who="nene" x={r * 0.62} y={r * 0.78} delay={320} active={active} />
        <AhmedAvatar size={92} mood="smile" />
      </Animated.View>
      <Animated.View style={[{ gap: 14 }, text]}>
        <Copy overline="Sənin üçün qurulur" title="Sənə uyğunlaşır" body="Necə hərəkət edirsən? Əhməd yolu ona görə seçir." />
        <View style={styles.chips}>
          {PROFILES.map((p) => {
            const on = p.key === profile;
            return (
              <PressableScale
                key={p.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => setProfile(p.key)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Icon name={p.icon} size={19} color={on ? '#FFFFFF' : C.ink} />
                <Txt w="semi" size={14.5} color={on ? '#FFFFFF' : C.ink}>
                  {p.label}
                </Txt>
              </PressableScale>
            );
          })}
        </View>
        <View style={styles.tip}>
          <AhmedAvatar size={30} mood="smile" blink={false} />
          <Txt v="bodyS" color={C.ink2} style={{ flex: 1 }}>
            {tip}
          </Txt>
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: simple }}
          onPress={() => toggleSimple(!simple)}
          style={[styles.simple, simple && { borderColor: C.brand, backgroundColor: C.brandSofter }]}
        >
          <View style={styles.simpleIcon}>
            <Icon name="format-size" size={22} color={C.route} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt v="title">Sadə rejim</Txt>
            <Txt v="caption" color={C.muted}>
              Böyük yazı, rahat düymələr, səs önə çıxır
            </Txt>
          </View>
          <View ref={switchRef} collapsable={false}>
            <Switch
              value={simple}
              onValueChange={toggleSimple}
              trackColor={{ true: C.brand, false: C.line }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Sadə rejim"
            />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 24, paddingBottom: 8, justifyContent: 'flex-end', gap: 18 },
  art: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', minHeight: 200 },
  bubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginBottom: 10,
    alignSelf: 'center',
    minWidth: 120,
    alignItems: 'center',
    shadowColor: '#071532',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -6,
    left: '50%',
    marginLeft: -7,
    width: 14,
    height: 14,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
  },
  mapCard: {
    width: '100%',
    borderRadius: R.lg,
    backgroundColor: '#FFFFFF',
    padding: 6,
    shadowColor: '#071532',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.dangerSoft, borderRadius: R.md, paddingHorizontal: 16, paddingVertical: 10 },
  ring: { position: 'absolute', borderWidth: 1.5, borderColor: C.line, borderStyle: 'dashed' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexGrow: 1, flexBasis: '46%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, paddingHorizontal: 14, borderRadius: R.pill, backgroundColor: C.bg2 },
  chipOn: { backgroundColor: C.navy },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.aiSoft, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 10 },
  simple: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: R.lg, borderWidth: 1.5, borderColor: C.line, padding: 12 },
  simpleIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' },
});

