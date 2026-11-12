import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { analyzePhoto, rate, type Rating, type VisionAttrs } from '@/ai/vision';
import { GeminiError } from '@/ai/gemini';
import { AhmedAvatar } from '@/components/Brand';
import { CircleButton, Icon, PillButton, Txt } from '@/components/ui';
import { enter, Glow, PressableScale } from '@/motion';
import { C, R } from '@/theme';
import { useAppStore } from '@/store/useAppStore';
import { useScanStore } from '@/store/scan';
import { prefs } from '@/store/prefs';
import { say, stop, voiceState } from '@/voice';
import { SCAN } from '@/voice/lines/scan';
import { log } from '@/utils/log';
import { BOX_STAGGER, Corners, Stage } from './Stage';
import { GuidePanel, ResultPanel, SampleRow, ScanningPanel } from './Panels';
import { SAMPLE_CREDITS, type Sample } from './samples';

type Phase = 'capture' | 'scan' | 'done' | 'guide';
type Frame = { source: ImageSourcePropType; iw: number; ih: number; sampleId?: string; credit?: string; live: boolean };
type Result = { id: string; attrs: VisionAttrs; rating: Rating };

const POINTS = 25;
const isWeb = Platform.OS === 'web';

/** Photo → JPEG ≤1024 px @0.6 (base64) for the model. */
async function shrink(uri: string): Promise<{ base64: string; uri: string; width: number; height: number }> {
  const IM = await import('expo-image-manipulator');
  try {
    const ref = await IM.ImageManipulator.manipulate(uri).resize({ width: 1024 }).renderAsync();
    const out = await ref.saveAsync({ compress: 0.6, format: IM.SaveFormat.JPEG, base64: true });
    return { base64: out.base64 ?? '', uri: out.uri, width: out.width, height: out.height };
  } catch (e) {
    log('[scan] manipulate fallback', String(e));
    const out = await IM.manipulateAsync(uri, [{ resize: { width: 1024 } }], { compress: 0.6, format: IM.SaveFormat.JPEG, base64: true });
    return { base64: out.base64 ?? '', uri: out.uri, width: out.width, height: out.height };
  }
}

function revealBase(nBoxes: number) {
  return prefs().liteFx ? 120 + nBoxes * 80 + 80 : 120 + nBoxes * BOX_STAGGER + 260;
}

export function ScanScreen() {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const stageFinal = Math.round(Math.max(290, Math.min(440, H * 0.45)));

  const [phase, setPhase] = useState<Phase>('capture');
  const [frame, setFrame] = useState<Frame | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [guide, setGuide] = useState('');
  const [expectMs, setExpectMs] = useState(2400);
  const [camReady, setCamReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const contributed = useScanStore((s) => (result ? s.history.find((h) => h.id === result.id)?.contributed ?? false : false));

  const [perm, requestPerm] = useCameraPermissions();
  const camGranted = !isWeb && !!perm?.granted;
  const camRef = useRef<CameraView>(null);
  const run = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(
    () => () => {
      clearTimers();
      stop();
    },
    [],
  );

  const finish = useCallback((my: number, attrs: VisionAttrs, frameInfo: Frame) => {
    if (my !== run.current) return;
    const rating = rate(attrs);
    const id = frameInfo.sampleId ? `sample-${frameInfo.sampleId}` : `live-${Date.now()}`;
    const prev = useScanStore.getState().history.find((h) => h.id === id);
    useScanStore.getState().record({
      id,
      at: Date.now(),
      source: frameInfo.live ? 'live' : 'sample',
      sampleId: frameInfo.sampleId,
      attrs,
      score: rating.score,
      stars: rating.stars,
      contributed: prev?.contributed ?? false,
    });
    setResult({ id, attrs, rating });
    setPhase('done');
    const base = revealBase(attrs.boxes.length);
    later(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}), base + 200);
    later(() => {
      if (my === run.current) say(attrs.summary_az);
    }, base + 650);
  }, []);

  const showGuide = useCallback((my: number, text: string) => {
    if (my !== run.current) return;
    setGuide(text);
    setPhase('guide');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    later(() => {
      if (my === run.current) say(text);
    }, 350);
  }, []);

  const startSample = useCallback(
    (s: Sample) => {
      stop();
      clearTimers();
      const my = ++run.current;
      const f: Frame = { source: s.image, iw: s.width, ih: s.height, sampleId: s.id, credit: s.credit, live: false };
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setFrame(f);
      setResult(null);
      const ms = prefs().liteFx ? 1000 : 2600;
      setExpectMs(ms);
      setPhase('scan');
      // bundled answer is real model output; the scan still plays in full
      later(() => finish(my, s.attrs, f), ms);
    },
    [finish],
  );

  const capture = useCallback(async () => {
    const cam = camRef.current;
    if (!cam || busy) return;
    stop();
    clearTimers();
    const my = ++run.current;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    let f: Frame | null = null;
    try {
      const pic = await cam.takePictureAsync({ quality: 0.7 });
      if (my !== run.current) return;
      f = { source: { uri: pic.uri }, iw: pic.width, ih: pic.height, live: true };
      setFrame(f);
      setResult(null);
      setExpectMs(3600);
      setPhase('scan');
      const t0 = Date.now();
      log('[scan] captured', pic.width, pic.height, String(pic.uri).slice(0, 60));
      const small = await shrink(pic.uri);
      if (my !== run.current) return;
      // show the normalized JPEG (orientation-corrected, small) as the frozen frame
      if (small.uri && small.width && small.height) {
        const fs: Frame = { source: { uri: small.uri }, iw: small.width, ih: small.height, live: true };
        f = fs;
        setFrame(fs);
      }
      const attrs = await analyzePhoto(small.base64);
      const wait = Math.max(0, 1600 - (Date.now() - t0));
      later(() => {
        if (!attrs.is_street_scene) showGuide(my, SCAN.notStreet);
        else finish(my, attrs, f!);
      }, wait);
    } catch (e) {
      log('[scan] live analysis', String(e).slice(0, 160));
      if (!f) {
        setFrame(null);
      }
      const weak = e instanceof GeminiError && (e.code === 'OFFLINE' || e.code === 'TIMEOUT' || e.code === 'NO_KEY' || e.code === 'HTTP_5XX');
      showGuide(my, weak ? SCAN.weak : SCAN.unclear);
    } finally {
      setBusy(false);
    }
  }, [busy, finish, showGuide]);

  const again = useCallback(() => {
    stop();
    clearTimers();
    run.current++;
    setResult(null);
    setFrame(null);
    setCamReady(false);
    setPhase('capture');
  }, []);

  const contribute = useCallback(() => {
    if (!result) return;
    useScanStore.getState().contribute(result.id);
    useAppStore.getState().addPoints(POINTS, 'AI Göz');
    if (!voiceState().speaking) say(SCAN.added);
  }, [result]);

  const back = () => {
    stop();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const bottomPad = Math.max(insets.bottom, 12) + 4;
  // landscape photos are shown uncropped (all boxes visible); tall ones are cropped to fit
  const headerH = insets.top + 76;
  const imgH = frame ? Math.min(stageFinal - 26, Math.max(200, Math.round((W * frame.ih) / frame.iw))) : stageFinal - 26;
  const stageH = headerH + imgH + 26; // photo sits under the header; the sheet overlaps only the navy strip

  return (
    <View style={{ flex: 1, backgroundColor: C.navy }}>
      <StatusBar style="light" />
      {phase === 'capture' ? (
        <View style={{ width: W, height: H, overflow: 'hidden' }}>
          <CapturePane
            w={W}
            h={H}
            top={insets.top}
            bottom={bottomPad}
            camGranted={camGranted}
            canAsk={perm?.canAskAgain !== false}
            onAsk={() => requestPerm().catch(() => {})}
            camRef={camRef}
            ready={camReady}
            onReady={() => setCamReady(true)}
            onShoot={capture}
            onSample={startSample}
          />
        </View>
      ) : (
        <View style={{ width: W, height: stageH, backgroundColor: C.navy }}>
          <View style={{ position: 'absolute', left: 0, top: headerH, width: W, height: imgH + 26, overflow: 'hidden' }}>
            {frame ? <Stage key={frame.sampleId ?? 'live'} source={frame.source} iw={frame.iw} ih={frame.ih} w={W} h={imgH} phase={phase} boxes={result?.attrs.boxes ?? []} /> : null}
          </View>
        </View>
      )}

      {phase !== 'capture' ? (
        <Animated.View
          entering={prefs().liteFx ? FadeIn.duration(160) : SlideInDown.springify().damping(22).stiffness(190)}
          style={{ flex: 1, marginTop: -26, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }}
        >
          {phase === 'scan' ? <ScanningPanel expectMs={expectMs} /> : null}
          {phase === 'done' && result ? (
            <ResultPanel
              attrs={result.attrs}
              rating={result.rating}
              base={revealBase(result.attrs.boxes.length)}
              credit={frame?.credit}
              bottomPad={bottomPad}
              contributed={contributed}
              onContribute={contribute}
              onAgain={again}
            />
          ) : null}
          {phase === 'guide' ? <GuidePanel text={guide} canRetry={camGranted} onRetry={again} onSample={startSample} bottomPad={bottomPad} /> : null}
        </Animated.View>
      ) : null}

      {/* header (scrim keeps white text readable over bright skies) */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(15,27,45,0.72)', 'rgba(15,27,45,0)']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top + 96 }}
      />
      <View pointerEvents="box-none" style={[{ position: 'absolute', left: 0, right: 0, top: 0, paddingTop: insets.top + 8, paddingHorizontal: 16 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <CircleButton icon="chevron-left" bg="rgba(15,27,45,0.55)" color="#FFFFFF" size={46} onPress={back} />
          <View style={{ flex: 1 }}>
            <Txt v="h3" color="#FFFFFF">
              AI Göz
            </Txt>
            <Txt v="caption" color="rgba(255,255,255,0.75)">
              Keçidin riskini fotodan öyrən
            </Txt>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: 'rgba(15,27,45,0.55)' }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#8E8EFF' }} />
            <Txt w="semi" size={12} color="#FFFFFF">
              iRAP · Vision
            </Txt>
          </View>
        </View>
      </View>
    </View>
  );
}

/** Live camera (or a permission primer) with the viewfinder, shutter and sample gallery. */
function CapturePane({
  w,
  h,
  top,
  bottom,
  camGranted,
  canAsk,
  onAsk,
  camRef,
  ready,
  onReady,
  onShoot,
  onSample,
}: {
  w: number;
  h: number;
  top: number;
  bottom: number;
  camGranted: boolean;
  canAsk: boolean;
  onAsk: () => void;
  camRef: React.RefObject<CameraView | null>;
  ready: boolean;
  onReady: () => void;
  onShoot: () => void;
  onSample: (s: Sample) => void;
}) {
  const vfTop = top + 84;
  const vfH = Math.max(220, h - vfTop - 300 - bottom);
  const vfW = w - 48;
  return (
    <View style={{ width: w, height: h }}>
      {camGranted ? (
        <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing="back" onCameraReady={onReady} animateShutter={false} />
      ) : (
        <LinearGradient colors={['#16243A', C.navy, '#0B1424']} style={StyleSheet.absoluteFill} />
      )}

      {camGranted ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: vfTop, left: 24, width: vfW, height: vfH }}>
          <Corners w={vfW} h={vfH} inset={2} len={30} />
          <Animated.View entering={enter(0, 'down', 200)} style={{ alignSelf: 'center', marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: 'rgba(15,27,45,0.62)' }}>
            <Icon name="crosshairs" size={16} color="#FFFFFF" />
            <Txt w="semi" size={13} color="#FFFFFF">
              Keçidi kadrın ortasına al
            </Txt>
          </Animated.View>
        </View>
      ) : (
        <View style={{ position: 'absolute', top: vfTop - 10, left: 24, right: 24, height: vfH + 20, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Glow size={200} color={C.ai} intensity={0.5} />
            <Animated.View entering={enter(0, 'pop')}>
              <AhmedAvatar size={104} full />
            </Animated.View>
          </View>
          <Animated.View entering={enter(1, 'up')} style={{ alignItems: 'center', gap: 8 }}>
            <Txt v="h1" color="#FFFFFF" center>
              Keçidi göstər,{'\n'}riskini deyim
            </Txt>
            <Txt v="body" color="rgba(255,255,255,0.78)" center style={{ maxWidth: 320 }}>
              {isWeb
                ? 'Aşağıdakı Bakı keçidlərindən birini seç. Zolaqları, işıqforu, adacığı və işığı iRAP meyarları ilə yoxlayıram.'
                : 'Kameranı keçidə tut. Zolaqları, işıqforu, adacığı və işığı iRAP meyarları ilə yoxlayıram.'}
            </Txt>
          </Animated.View>
          {!isWeb ? (
            <Animated.View entering={enter(2, 'up')}>
              <PillButton
                label={canAsk ? 'Kameranı aç' : 'Kameranı ayarlarda aç'}
                icon="camera-outline"
                onPress={canAsk ? onAsk : () => Linking.openSettings().catch(() => {})}
                style={{ paddingHorizontal: 28 }}
              />
            </Animated.View>
          ) : null}
        </View>
      )}

      {/* bottom controls */}
      <LinearGradient
        pointerEvents="box-none"
        colors={['rgba(15,27,45,0)', 'rgba(15,27,45,0.86)', 'rgba(15,27,45,0.97)']}
        locations={[0, 0.3, 1]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 48, paddingBottom: bottom, paddingHorizontal: 18, gap: 12 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt v="overline" color="rgba(255,255,255,0.75)">
            Nümunələr · Bakı keçidləri
          </Txt>
          <Icon name="image-multiple-outline" size={16} color="rgba(255,255,255,0.6)" />
        </View>
        <SampleRow onPick={onSample} />
        <Txt size={10.5} color="rgba(255,255,255,0.5)" numberOfLines={1}>
          {SAMPLE_CREDITS}
        </Txt>
        {camGranted ? (
          <View style={{ alignItems: 'center', paddingTop: 4 }}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Şəkil çək"
              haptic={false}
              scaleTo={0.9}
              disabled={!ready}
              onPress={onShoot}
              style={{ width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', opacity: ready ? 1 : 0.5 }}
            >
              <View style={{ width: 62, height: 62, borderRadius: R.pill, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="line-scan" size={26} color={C.navy} />
              </View>
            </PressableScale>
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );
}
