import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CircleButton, Txt } from '@/components/ui';
import { C } from '@/theme';

/** Lane D replaces this screen. */
export default function City() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 12, paddingHorizontal: 18 }}>
      <CircleButton icon="chevron-left" onPress={() => router.back()} />
      <Txt v="h1" style={{ marginTop: 20 }}>
        Şəhər paneli
      </Txt>
    </View>
  );
}
