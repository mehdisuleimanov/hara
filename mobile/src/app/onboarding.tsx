import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePrefs } from '@/store/prefs';
import { PillButton, Txt } from '@/components/ui';
import { C } from '@/theme';

/** Lane E replaces this with the 3-screen onboarding. */
export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const setOnboarded = usePrefs((p) => p.setOnboarded);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 80, paddingHorizontal: 24, paddingBottom: insets.bottom + 24, justifyContent: 'space-between' }}>
      <Txt v="hero">Hara?</Txt>
      <PillButton
        label="Başla"
        onPress={() => {
          setOnboarded(true);
          router.replace('/');
        }}
      />
    </View>
  );
}
