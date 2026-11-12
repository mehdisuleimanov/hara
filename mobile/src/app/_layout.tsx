import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Inter_400Regular,
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

setupNotifications();

export default function RootLayout() {
  const [loaded] = useFonts({
    Inter_400Regular,
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
  );
}
