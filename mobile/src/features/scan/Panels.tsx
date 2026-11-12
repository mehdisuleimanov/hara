import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { Factor, Rating, VisionAttrs } from '@/ai/vision';
import { AhmedAvatar } from '@/components/Brand';
import { Icon, PillButton, Txt } from '@/components/ui';
import { enter, PressableScale, Skeleton, SPRING, useTypewriter } from '@/motion';
import { C, R, scoreColor, scoreSoft } from '@/theme';
import { useVoice } from '@/voice';
import { prefs } from '@/store/prefs';
import { ScoreDial, Stars } from './ScoreDial';
import { SAMPLES, type Sample } from './samples';

const STEPS = ['Keçidi axtarıram…', 'Zolaqları sayıram…', 'İşıqforu və işığı yoxlayıram…', 'iRAP meyarları ilə qiymətləndirirəm…'];

/** While the model looks at the photo: Əhməd narrates real analysis stages + skeleton rows. */
export function ScanningPanel({ expectMs }: { expectMs: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => Math.min(STEPS.length - 1, v + 1)), Math.max(550, expectMs / STEPS.length));
    return () => clearInterval(id);
  }, [expectMs]);
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(0.92, { duration: expectMs, easing: Easing.out(Easing.quad) });
  }, [expectMs, p]);
  const bar = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return (
    <View style={{ padding: 22, gap: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.aiSoft, alignItems: 'center', justifyContent: 'center' }}>
          <AhmedAvatar size={40} mood="smile" />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt v="overline" color={C.ai}>
            Əhməd baxır
          </Txt>
          <Animated.View key={i} entering={FadeIn.duration(220)}>
            <Txt v="title">{STEPS[i]}</Txt>
          </Animated.View>
        </View>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: C.bg2, overflow: 'hidden' }}>
        <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: C.ai }, bar]} />
      </View>
      <View style={{ gap: 12 }}>
        {[0.72, 0.56, 0.64, 0.48].map((w, k) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Skeleton width={30} height={30} radius={15} />
            <Skeleton width={`${Math.round(w * 100)}%` as `${number}%`} height={14} />
          </View>
        ))}
      </View>
    </View>
  );
}

function FactorRow({ f, i, base }: { f: Factor; i: number; base: number }) {
  const col = f.state === 'ok' ? C.brand : f.state === 'warn' ? C.warn : C.danger;
  const soft = f.state === 'ok' ? C.brandSoft : f.state === 'warn' ? C.warnSoft : C.dangerSoft;
  const mark = f.state === 'ok' ? 'check' : f.state === 'warn' ? 'exclamation' : 'close';
  return (
    <Animated.View entering={enter(i, 'up', base)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 }}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: soft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={mark} size={18} color={col} label={f.state === 'ok' ? 'var' : 'risk'} />
      </View>
      <Icon name={f.icon} size={18} color={C.muted} />
      <Txt v="body" style={{ flex: 1 }}>
        {f.label}
      </Txt>
      {f.delta !== 0 ? (
        <View style={{ paddingHorizontal: 8, height: 24, borderRadius: 12, backgroundColor: f.delta > 0 ? C.brandSoft : C.dangerSoft, justifyContent: 'center' }}>
          <Txt w="bold" size={12} color={f.delta > 0 ? C.brandDark : C.danger} style={{ fontVariant: ['tabular-nums'] }}>
            {f.delta > 0 ? `+${f.delta}` : `−${Math.abs(f.delta)}`}
          </Txt>
        </View>
      ) : null}
    </Animated.View>
  );
}

function verdict(score: number, a: VisionAttrs) {
  if (score >= 75) return a.crossing_type === 'underpass' || a.crossing_type === 'footbridge' ? 'Ən az riskli keçid yolu' : 'Az riskli keçid';
  if (score >= 55) return 'Orta risk: diqqətli keç';
  if (score >= 35) return 'Yüksək risk';
  return 'Çox yüksək risk';
}

/** Əhməd's spoken summary as a chat bubble (typewriter, mouth moves while speaking). */
function AhmedBubble({ text, delay }: { text: string; delay: number }) {
  const [go, setGo] = useState(prefs().liteFx);
  useEffect(() => {
    const t = setTimeout(() => setGo(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  const [shown] = useTypewriter(go ? text : '', 55);
  const { speaking } = useVoice();
  return (
    <Animated.View entering={enter(0, 'up', delay)} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.aiSoft, alignItems: 'center', justifyContent: 'center' }}>
        <AhmedAvatar size={36} mood={speaking ? 'talk' : 'smile'} />
      </View>
      <View style={{ flex: 1, backgroundColor: C.aiSoft, borderRadius: 20, borderBottomLeftRadius: 6, padding: 14, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Txt w="bold" size={12.5} color={C.ai}>
            Əhməd
          </Txt>
          {speaking ? <Icon name="volume-high" size={14} color={C.ai} /> : null}
        </View>
        <Txt v="body" color={C.ink} style={{ minHeight: 42 }}>
          {shown || ' '}
        </Txt>
      </View>
    </Animated.View>
  );
}

/** Result: score ring + stars, Əhməd's summary, explainable attribute checklist. */
export function ResultPanel({
  attrs,
  rating,
  base,
  credit,
  bottomPad,
  contributed,
  onContribute,
  onAgain,
}: {
  attrs: VisionAttrs;
  rating: Rating;
  base: number;
  credit?: string;
  bottomPad: number;
  contributed: boolean;
  onContribute: () => void;
  onAgain: () => void;
}) {
  const col = scoreColor(rating.score);
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 24, gap: 18 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={enter(0, 'up', base)} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <ScoreDial score={rating.score} delay={base + 120} size={108} />
          <View style={{ flex: 1, gap: 6 }}>
            <Txt v="overline" color={C.muted}>
              Piyada üçün qiymət
            </Txt>
            <Stars stars={rating.stars} delay={base + 380} />
            <View style={{ alignSelf: 'flex-start', paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: scoreSoft(rating.score), justifyContent: 'center' }}>
              <Txt w="bold" size={13} color={col}>
                {verdict(rating.score, attrs)}
              </Txt>
            </View>
            <Txt v="caption" color={C.muted}>
              iRAP meyarları əsasında · Gemini Vision
            </Txt>
          </View>
        </Animated.View>

        <AhmedBubble text={attrs.summary_az} delay={base + 650} />

        <View>
          <Animated.View entering={enter(0, 'fade', base + 800)}>
            <Txt v="overline" color={C.muted} style={{ marginBottom: 2 }}>
              Nə gördüm
            </Txt>
          </Animated.View>
          {rating.factors.map((f, i) => (
            <FactorRow key={f.id} f={f} i={i} base={base + 850} />
          ))}
        </View>
        {credit ? (
          <Txt v="caption" color={C.faint}>
            {credit} · Wikimedia Commons
          </Txt>
        ) : null}
      </ScrollView>
      <Animated.View entering={enter(0, 'up', base + 1100)} style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: bottomPad, gap: 6, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.bg }}>
        <ContributeButton done={contributed} onPress={onContribute} />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
          <PressableScale onPress={onAgain} accessibilityRole="button" style={{ height: 40, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }}>
            <Txt w="semi" size={14.5} color={C.ink2}>
              Başqa keçidi yoxla
            </Txt>
          </PressableScale>
          {contributed ? (
            <Animated.View entering={enter(0, 'fade')}>
              <PressableScale onPress={() => router.push('/city')} accessibilityRole="button" style={{ height: 40, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="city-variant-outline" size={17} color={C.route} />
                <Txt w="semi" size={14.5} color={C.route}>
                  Şəhər paneli
                </Txt>
              </PressableScale>
            </Animated.View>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

/** Primary CTA that springs into a confirmation state. */
function ContributeButton({ done, onPress }: { done: boolean; onPress: () => void }) {
  const s = useSharedValue(1);
  useEffect(() => {
    if (!done) return;
    s.value = 0.92;
    s.value = withSpring(1, SPRING.bouncy);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [done, s]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  if (done)
    return (
      <Animated.View style={[{ height: 58, borderRadius: R.pill, backgroundColor: C.brandSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }, st]}>
        <Animated.View entering={enter(0, 'pop')}>
          <Icon name="check-circle" size={24} color={C.brand} />
        </Animated.View>
        <Txt w="bold" size={16} color={C.brandDark}>
          Qata əlavə olundu · +25 xal
        </Txt>
      </Animated.View>
    );
  return <PillButton label="Təhlükəsizlik Qatına əlavə et" icon="map-marker-plus-outline" onPress={onPress} />;
}

/** Calm guidance when a live photo can't be read — samples stay one tap away. */
export function GuidePanel({ text, onRetry, onSample, canRetry, bottomPad }: { text: string; onRetry: () => void; onSample: (s: Sample) => void; canRetry: boolean; bottomPad: number }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: bottomPad + 8, gap: 18 }}>
      <Animated.View entering={enter(0, 'up')} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.aiSoft, alignItems: 'center', justifyContent: 'center' }}>
          <AhmedAvatar size={40} />
        </View>
        <Txt v="title" style={{ flex: 1 }}>
          {text}
        </Txt>
      </Animated.View>
      {canRetry ? (
        <Animated.View entering={enter(1, 'up')}>
          <PillButton label="Yenidən çək" icon="camera-outline" onPress={onRetry} />
        </Animated.View>
      ) : null}
      <Animated.View entering={enter(2, 'up')} style={{ gap: 10 }}>
        <Txt v="overline" color={C.muted}>
          Və ya nümunəni yoxla
        </Txt>
        <SampleRow onPick={onSample} light />
      </Animated.View>
    </ScrollView>
  );
}

/** The 3 bundled Baku photos. */
export function SampleRow({ onPick, light }: { onPick: (s: Sample) => void; light?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {SAMPLES.map((s, i) => (
        <Animated.View key={s.id} entering={enter(i, 'up', 120)} style={{ flex: 1 }}>
          <PressableScale accessibilityRole="button" accessibilityLabel={`Nümunə: ${s.title}`} onPress={() => onPick(s)} style={{ gap: 6 }}>
            <View style={{ height: 76, borderRadius: 16, overflow: 'hidden', backgroundColor: light ? C.bg2 : 'rgba(255,255,255,0.08)', borderWidth: light ? 0 : 1, borderColor: 'rgba(255,255,255,0.18)' }}>
              <Animated.Image source={s.image} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
            </View>
            <Txt w="semi" size={12.5} color={light ? C.ink : '#FFFFFF'} numberOfLines={1}>
              {s.title}
            </Txt>
            <Txt size={11.5} color={light ? C.muted : 'rgba(255,255,255,0.65)'} numberOfLines={1} style={{ marginTop: -5 }}>
              {s.sub}
            </Txt>
          </PressableScale>
        </Animated.View>
      ))}
    </View>
  );
}
