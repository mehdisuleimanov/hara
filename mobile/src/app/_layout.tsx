import React, { useEffect, useState } from 'react';
import { LogBox, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Stack, router, useRootNavigationState, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  // PERF: only the 5 weights actually used are loaded (300/400 removed)
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import { Unbounded_700Bold, Unbounded_800ExtraBold } from '@expo-google-fonts/unbounded';
import { ToastHost } from '@/components/Toast';
import { DemoPanel } from '@/components/DemoPanel';
import { A11yMorphHost } from '@/features/a11y/MorphHost';
import { setupNotifications } from '@/utils/notify';
import { initVoice } from '@/voice';
import { usePrefs } from '@/store/prefs';
import { C } from '@/theme';

if (Platform.OS !== 'web') {
  setupNotifications();
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

/** Render errors show a calm, recoverable screen (technical details only in dev builds). */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 28, paddingTop: 120, gap: 14 }}>
      <Text style={{ fontSize: 26, fontWeight: '800', color: C.ink }}>Bir an…</Text>
      <Text style={{ fontSize: 16, color: C.ink2, lineHeight: 23 }}>Bu ekranı yenidən açaq. Məlumatların yerindədir.</Text>
      {__DEV__ ? (
        <Text selectable style={{ fontSize: 12, color: C.muted, fontFamily: Platform.OS === 'android' ? 'monospace' : undefined }}>
          {String(error?.message ?? error)}
          {'\n\n'}
          {String(error?.stack ?? '').slice(0, 1200)}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={retry}
        style={{ marginTop: 12, height: 56, borderRadius: 28, backgroundColor: C.route, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Yenidən aç</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: C.ink2, fontSize: 15, fontWeight: '600' }}>Ana səhifəyə qayıt</Text>
      </Pressable>
    </ScrollView>
  );
}

// Browser preview only: hide dev warning toasts so the preview looks like the app.
if (Platform.OS === 'web') {
  LogBox.ignoreAllLogs();
  // known react-native-web dev-only warning (boolean RN props reaching the DOM); not present on device
  const origError = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('for a non-boolean attribute')) return;
    origError(...args);
  };
}

/** Browser preview: phone-sized frame on wide screens, full screen on phones. */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web' || width < 520) return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: '#E8EDF5', alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: 412,
          height: '100%',
          maxHeight: 892,
          borderRadius: 34,
          overflow: 'hidden',
          backgroundColor: C.bg,
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        }}
      >
        {children}
      </View>
    </View>
  );
}

/** Sends first-time users to onboarding once prefs are loaded and navigation is mounted. */
function OnboardingGate() {
  const hydrated = usePrefs((p) => p.hydrated);
  const onboarded = usePrefs((p) => p.onboarded);
  const nav = useRootNavigationState();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (done || !hydrated || !nav?.key) return;
    setDone(true);
    if (!onboarded) setTimeout(() => router.replace('/onboarding'), 0);
  }, [done, hydrated, onboarded, nav?.key]);
  return null;
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
    Unbounded_700Bold,
    Unbounded_800ExtraBold,
  });
  const hydrated = usePrefs((p) => p.hydrated);

  useEffect(() => {
    usePrefs.getState().hydrate();
    initVoice();
  }, []);

  const ready = loaded && hydrated;
  useEffect(() => {
    if (ready && Platform.OS !== 'web') SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PhoneFrame>
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="ahmed" options={{ animation: 'fade_from_bottom', presentation: 'fullScreenModal' }} />
            <Stack.Screen name="scan" options={{ animation: 'fade_from_bottom', presentation: 'fullScreenModal' }} />
            <Stack.Screen name="city" />
            <Stack.Screen name="navigate" options={{ animation: 'fade' }} />
            <Stack.Screen name="widget" options={{ animation: 'fade' }} />
          </Stack>
          <OnboardingGate />
          <A11yMorphHost />
          <ToastHost />
          <DemoPanel />
        </View>
      </PhoneFrame>
    </GestureHandlerRootView>
  );
}
