import React, { useEffect } from 'react';
import { LogBox, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  // PERF: only the 5 weights actually used are loaded (300/400 removed)
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import { ToastHost } from '@/components/Toast';
import { DemoPanel } from '@/components/DemoPanel';
import { setupNotifications } from '@/utils/notify';
import { initTts } from '@/utils/tts';
import { C } from '@/theme';

if (Platform.OS !== 'web') setupNotifications();

/** Render errors show a recoverable screen instead of closing the app. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 24, paddingTop: 80, gap: 16 }}>
      <Text style={{ fontSize: 26, fontWeight: '900', color: C.ink }}>Bir xəta baş verdi</Text>
      <Text style={{ fontSize: 15, color: C.ink2 }}>Tətbiq bağlanmadı. Xətanın mətni (komandaya göndər):</Text>
      <Text selectable style={{ fontSize: 13, color: C.danger, fontFamily: Platform.OS === 'android' ? 'monospace' : undefined }}>
        {String(error?.message ?? error)}
        {'\n\n'}
        {String(error?.stack ?? '').slice(0, 1500)}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={retry}
        style={{ height: 56, borderRadius: 28, backgroundColor: C.route, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Yenidən cəhd et</Text>
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

export default function RootLayout() {
  const [loaded] = useFonts({
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  useEffect(() => {
    initTts();
  }, []);

  if (!loaded) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <PhoneFrame>
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="ahmed" options={{ animation: 'fade_from_bottom', presentation: 'fullScreenModal' }} />
        <Stack.Screen name="widget" options={{ animation: 'fade' }} />
      </Stack>
      <ToastHost />
      <DemoPanel />
    </View>
    </PhoneFrame>
  );
}
