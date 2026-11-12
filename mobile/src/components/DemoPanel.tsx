import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { useAppStore, GUST_LIMIT, TimeMode } from '@/store/useAppStore';
import { triggerFamilyArrival } from '@/utils/notify';
import { C, R } from '@/theme';
import { Icon, PillButton, Txt } from './ui';

/** Hidden stage controls. Open with a long-press on the menu button (home). */
export function DemoPanel() {
  const open = useAppStore((s) => s.demoPanelOpen);
  const setOpen = useAppStore((s) => s.setDemoPanelOpen);
  const s = useAppStore();

  const go = (path: string) => {
    setOpen(false);
    setTimeout(() => router.push(path as never), 150);
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 30 }}>
          <View style={styles.row}>
            <Txt w="xbold" size={22}>
              Demo paneli
            </Txt>
            <Pressable onPress={() => setOpen(false)}>
              <Icon name="close" size={26} />
            </Pressable>
          </View>

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
