import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAppStore, GUST_LIMIT, TimeMode } from '@/store/useAppStore';
import { usePrefs, type A11yMode } from '@/store/prefs';
import { triggerFamilyArrival } from '@/utils/notify';
import { prefetch } from '@/voice';
import { allLines } from '@/voice/lines';
import { C, R } from '@/theme';
import { Icon, PillButton, Segmented, Txt } from './ui';

function Toggle({ title, sub, value, onChange }: { title: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Txt w="semi" size={15}>
          {title}
        </Txt>
        {sub ? (
          <Txt size={13} color={C.muted}>
            {sub}
          </Txt>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.brand }} />
    </View>
  );
}

/** Hidden developer panel (DevTrigger: two long-presses). Never shown to the audience. */
export function DemoPanel() {
  const open = useAppStore((s) => s.demoPanelOpen);
  const setOpen = useAppStore((s) => s.setDemoPanelOpen);
  const s = useAppStore();
  const p = usePrefs();
  const [voiceMsg, setVoiceMsg] = useState('');

  const go = (path: string) => {
    setOpen(false);
    setTimeout(() => router.push(path as never), 150);
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 30 }}>
          <View style={styles.row}>
            <Txt w="xbold" size={22}>
              Tərtibatçı paneli
            </Txt>
            <Pressable onPress={() => setOpen(false)}>
              <Icon name="close" size={26} />
            </Pressable>
          </View>

          <View>
            <Txt w="semi" size={13} color={C.muted}>
              GÖRÜNÜŞ REJİMİ
            </Txt>
            <Segmented<A11yMode>
              style={{ marginTop: 8 }}
              value={p.a11yMode}
              onChange={p.setA11yMode}
              options={[
                { key: 'standard', label: 'Standart' },
                { key: 'senior', label: 'Sadə' },
                { key: 'lowVision', label: 'Kontrast' },
              ]}
            />
          </View>

          <Toggle title="Lite effektlər" sub="Zəif telefonda animasiyaları yüngülləşdirir" value={p.liteFx} onChange={p.setLiteFx} />
          <Toggle title="Səhnə ehtiyatı" sub="AI cavab verməsə hazır ssenari işləyir (zəif Wi-Fi)" value={p.stageFallback} onChange={p.setStageFallback} />
          <Toggle title="Səs söndürülüb" value={p.voiceMuted} onChange={p.setVoiceMuted} />
          <Toggle title="Peyk xəritəsi" value={p.mapSatellite} onChange={p.setMapSatellite} />

          <View>
            <Txt w="semi" size={13} color={C.muted}>
              GÜNDÜZ / GECƏ
            </Txt>
            <View style={styles.segment}>
              {(['auto', 'day', 'night'] as TimeMode[]).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => s.setTimeMode(m)}
                  style={[styles.segItem, s.timeMode === m && { backgroundColor: C.black }]}
                >
                  <Txt w="semi" size={14} color={s.timeMode === m ? '#fff' : C.ink}>
                    {m === 'auto' ? 'Avto (saat)' : m === 'day' ? 'Gündüz' : 'Gecə'}
                  </Txt>
                </Pressable>
              ))}
            </View>
          </View>

          <View>
            <View style={styles.row}>
              <Txt w="semi" size={13} color={C.muted}>
                KÜLƏK
              </Txt>
              <Txt w="bold" size={14} color={s.windGust > GUST_LIMIT ? C.danger : C.ink}>
                {s.windSpeed} m/s · qasırğa {s.windGust} m/s
              </Txt>
            </View>
            <Slider
              minimumValue={0}
              maximumValue={20}
              step={1}
              value={s.windSpeed}
              onValueChange={(v) => s.setWind(Math.round(v))}
              minimumTrackTintColor={C.brand}
              maximumTrackTintColor={C.line}
              thumbTintColor={C.brand}
            />
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Txt w="semi" size={15}>
                Real AI (Gemini)
              </Txt>
              <Txt size={13} color={C.muted}>
                Söndürüləndə Əhməd hazır ssenari ilə cavab verir
              </Txt>
            </View>
            <Switch value={s.aiEnabled} onValueChange={s.setAiEnabled} trackColor={{ true: C.brand }} />
          </View>

          <View>
            <Txt w="semi" size={13} color={C.muted}>
              NAVİQASİYA SÜRƏTİ
            </Txt>
            <View style={styles.segment}>
              {[1, 3, 6, 12].map((v) => (
                <Pressable
                  key={v}
                  onPress={() => s.setNavSpeed(v)}
                  style={[styles.segItem, s.navSpeed === v && { backgroundColor: C.black }]}
                >
                  <Txt w="semi" size={14} color={s.navSpeed === v ? '#fff' : C.ink}>
                    {v}×
                  </Txt>
                </Pressable>
              ))}
            </View>
          </View>

          <PillButton label="Hazır cümləni göndər" icon="microphone" onPress={() => go('/ahmed?demo=1')} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <PillButton style={{ flex: 1 }} label="AI Göz" icon="eye-outline" variant="white" onPress={() => go('/scan')} />
            <PillButton style={{ flex: 1 }} label="Şəhər" icon="city-variant-outline" variant="white" onPress={() => go('/city')} />
          </View>
          <PillButton
            label="Onboarding-i yenidən göstər"
            icon="play-circle-outline"
            variant="white"
            onPress={() => {
              p.setOnboarded(false);
              go('/onboarding');
            }}
          />
          <PillButton
            label={voiceMsg || 'Səsləri hazırla (keş)'}
            icon="account-voice"
            variant="white"
            onPress={async () => {
              setVoiceMsg('Hazırlanır…');
              const r = await prefetch(allLines());
              setVoiceMsg(`Hazır: ${r.ok} · alınmadı: ${r.failed}`);
            }}
          />
          <PillButton label="Kilid ekranı widget" icon="cellphone-lock" variant="black" onPress={() => go('/widget')} />
          <PillButton
            label="Nənə evə çatdı (bildiriş)"
            icon="bell-ring-outline"
            variant="white"
            onPress={() => {
              setOpen(false);
              triggerFamilyArrival();
            }}
          />
          <PillButton
            label="Hər şeyi sıfırla"
            icon="restart"
            variant="outline"
            onPress={() => {
              s.reset();
              router.replace('/');
            }}
          />
        </ScrollView>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 22,
    paddingTop: 10,
    maxHeight: '86%',
  },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: C.faint, alignSelf: 'center', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  segment: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: R.pill,
    padding: 5,
    marginTop: 8,
    gap: 4,
  },
  segItem: { flex: 1, height: 42, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center' },
});
