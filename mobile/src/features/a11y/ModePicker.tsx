import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { A11yMode } from '@/store/prefs';
import { useTheme } from '@/hooks/useTheme';
import { PressableScale } from '@/motion';
import { Icon, Txt } from '@/components/ui';
import { C, C_HC, R } from '@/theme';
import { morphTo, useA11yMorph } from './morph';
import { pointOf } from './Speak';

export const MODE_OPTIONS: { mode: A11yMode; title: string; sub: string; icon: string; preview: number; tone: string; bg: string }[] = [
  { mode: 'standard', title: 'Standart', sub: 'Bütün imkanlar', icon: 'view-dashboard-outline', preview: 18, tone: C.route, bg: C.purpleSoft },
  { mode: 'senior', title: 'Sadə', sub: 'Böyük yazı, səsli kömək', icon: 'human-cane', preview: 24, tone: C.brandDark, bg: C.brandSoft },
  { mode: 'lowVision', title: 'Yüksək kontrast', sub: 'Zəif görmə üçün', icon: 'contrast-box', preview: 28, tone: '#FFFFFF', bg: '#0F1B2D' },
];

/** Three-way appearance switch. Each tap plays the circular morph from the finger. */
export function ModePicker() {
  const t = useTheme();
  const { mode } = useA11yMorph();
  const rows = t.simple;
  return (
    <View style={rows ? { gap: 10 } : styles.cards}>
      {MODE_OPTIONS.map((o) => {
        const on = o.mode === mode;
        const darkCard = o.mode === 'lowVision';
        const fg = darkCard ? '#FFFFFF' : C.ink;
        return (
          <PressableScale
            key={o.mode}
            haptic="medium"
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${o.title} görünüş`}
            onPress={(e) => morphTo(o.mode, pointOf(e))}
            style={[
              rows ? [styles.row, { minHeight: t.hit + 16 }] : styles.card,
              { backgroundColor: o.bg },
              on && { borderColor: darkCard ? C.brand : o.tone, borderWidth: 3 },
              t.hc && !on && { borderWidth: 2, borderColor: C_HC.line },
            ]}
          >
            <View style={[styles.preview, rows && { width: 56, height: 56 }, { backgroundColor: darkCard ? '#1E2B40' : '#FFFFFF' }]}>
              <Txt w="black" size={o.preview} color={darkCard ? '#FFFFFF' : o.tone} style={{ includeFontPadding: false }}>
                Aa
              </Txt>
            </View>
            <View style={rows ? { flex: 1 } : { marginTop: 12 }}>
              <Txt w="bold" size={15} color={fg} numberOfLines={rows ? 1 : 2}>
                {o.title}
              </Txt>
              <Txt w="med" size={12} color={darkCard ? 'rgba(255,255,255,0.78)' : C.muted} numberOfLines={2} style={{ marginTop: 2 }}>
                {o.sub}
              </Txt>
            </View>
            <View style={[styles.check, rows ? null : styles.checkCorner, { backgroundColor: on ? (darkCard ? C.brand : o.tone) : 'transparent', borderColor: on ? 'transparent' : darkCard ? 'rgba(255,255,255,0.5)' : C.faint }]}>
              {on ? <Icon name="check-bold" size={14} color="#FFFFFF" /> : null}
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  cards: { flexDirection: 'row', gap: 8 },
  card: { flex: 1, borderRadius: R.lg, padding: 12, minHeight: 150, borderWidth: 3, borderColor: 'transparent' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: R.lg, padding: 12, borderWidth: 3, borderColor: 'transparent' },
  preview: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkCorner: { position: 'absolute', top: 10, right: 10 },
});
