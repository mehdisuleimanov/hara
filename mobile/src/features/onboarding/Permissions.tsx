import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { AudioModule } from 'expo-audio';
import { notificationPermission, requestNotificationPermission } from '@/utils/notify';
import { AhmedAvatar } from '@/components/Brand';
import { Icon, Txt } from '@/components/ui';
import { PressableScale, enter } from '@/motion';
import { C, R } from '@/theme';

type State = 'idle' | 'asking' | 'granted' | 'denied';

async function micStatus(): Promise<State> {
  try {
    const r = await AudioModule.getRecordingPermissionsAsync();
    return r.granted ? 'granted' : 'idle';
  } catch {
    return 'idle';
  }
}

async function notifStatus(): Promise<State> {
  const p = await notificationPermission();
  return p === 'granted' ? 'granted' : 'idle';
}

export async function askMic(): Promise<State> {
  try {
    const r = await AudioModule.requestRecordingPermissionsAsync();
    return r.granted ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export async function askNotifications(): Promise<State> {
  return (await requestNotificationPermission()) ? 'granted' : 'denied';
}

function PermCard({
  i,
  icon,
  title,
  body,
  state,
  onAsk,
}: {
  i: number;
  icon: string;
  title: string;
  body: string;
  state: State;
  onAsk: () => void;
}) {
  const granted = state === 'granted';
  return (
    <Animated.View entering={enter(i, 'up', 180)} style={[styles.card, granted && { borderColor: C.brand, backgroundColor: C.brandSofter }]}>
      <View style={[styles.icon, granted && { backgroundColor: C.brand }]}>
        <Icon name={granted ? 'check' : icon} size={24} color={granted ? '#FFFFFF' : C.route} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt v="title">{title}</Txt>
        <Txt v="bodyS" color={C.muted}>
          {body}
        </Txt>
      </View>
      {granted ? (
        <Txt w="bold" size={13} color={C.brandDark}>
          Aktivdir
        </Txt>
      ) : (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${title}: icazə ver`}
          onPress={onAsk}
          disabled={state === 'asking'}
          style={styles.ask}
        >
          <Txt w="bold" size={13.5} color="#FFFFFF">
            {state === 'denied' ? 'Yenə soruş' : 'İcazə ver'}
          </Txt>
        </PressableScale>
      )}
    </Animated.View>
  );
}

/** Permission primers in product language. Every request is optional. */
export function Permissions() {
  const [mic, setMic] = useState<State>('idle');
  const [notif, setNotif] = useState<State>('idle');
  useEffect(() => {
    micStatus().then(setMic);
    notifStatus().then(setNotif);
  }, []);

  const done = (s: State) => {
    if (s === 'granted') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  return (
    <View style={styles.wrap}>
      <Animated.View entering={enter(0, 'pop')} style={{ alignItems: 'center' }}>
        <AhmedAvatar size={96} mood="wave" />
      </Animated.View>
      <Animated.View entering={enter(1, 'up', 60)} style={{ gap: 8, alignItems: 'center' }}>
        <Txt v="overline" color={C.brandDark}>
          Son addım
        </Txt>
        <Txt v="h1" center accessibilityRole="header">
          Əhməd səni eşitsin
        </Txt>
        <Txt v="body" color={C.ink2} center>
          İki icazə ilə Əhməd sənə daha yaxşı kömək edir. İstədiyin vaxt ayarlardan dəyişə bilərsən.
        </Txt>
      </Animated.View>
      <View style={{ gap: 12, marginTop: 6 }}>
        <PermCard
          i={0}
          icon="microphone-outline"
          title="Səslə danış"
          body="Əllərin məşğul olanda sadəcə de: “Hara gedirik?”"
          state={mic}
          onAsk={async () => {
            setMic('asking');
            const s = await askMic();
            setMic(s);
            done(s);
          }}
        />
        <PermCard
          i={1}
          icon="bell-ring-outline"
          title="Vaxtında xəbər"
          body="Riskli keçidə yaxınlaşanda və ailən evə çatanda bildiriş."
          state={notif}
          onAsk={async () => {
            setNotif('asking');
            const s = await askNotifications();
            setNotif(s);
            done(s);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', gap: 14 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: R.lg, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.bg, padding: 14 },
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' },
  ask: { height: 38, paddingHorizontal: 14, borderRadius: R.pill, backgroundColor: C.route, alignItems: 'center', justifyContent: 'center' },
});
