import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * Local notifications only (work in Expo Go on Android).
 * - "nav" channel: sticky, live-updated navigation card shown in the shade and on the lock screen.
 * - "family" channel: arrival alerts.
 */

const NAV_ID = 'hara-nav';
let ready: Promise<boolean> | null = null;

export function setupNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureReady(): Promise<boolean> {
  if (!ready) {
    ready = (async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('nav', {
            name: 'Canlı naviqasiya',
            importance: Notifications.AndroidImportance.HIGH,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            vibrationPattern: [0],
            enableVibrate: false,
            sound: null,
          });
          await Notifications.setNotificationChannelAsync('family', {
            name: 'Ailə',
            importance: Notifications.AndroidImportance.MAX,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            vibrationPattern: [0, 200, 120, 200],
          });
        }
        const cur = await Notifications.getPermissionsAsync();
        if (cur.granted) return true;
        const req = await Notifications.requestPermissionsAsync();
        return req.granted;
      } catch {
        return false;
      }
    })();
  }
  return ready;
}

export async function showNavNotification(title: string, body: string) {
  if (!(await ensureReady())) return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: NAV_ID,
      content: {
        title,
        body,
        sticky: true,
        autoDismiss: false,
        color: '#FF6203',
        sound: false,
        data: { kind: 'nav' },
      },
      trigger: Platform.OS === 'android' ? { channelId: 'nav' } : null,
    });
  } catch {}
}

export async function clearNavNotification() {
  try {
    await Notifications.dismissNotificationAsync(NAV_ID);
  } catch {}
}

export async function triggerFamilyArrival(name = 'Nənə') {
  if (!(await ensureReady())) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${name} evə çatdı ✓`,
        body: 'Hara Ailə · Səfər 22:04-də bitdi · Marşrut balı 92 · İşıqforsuz keçid olmadı',
        color: '#FF6203',
        data: { kind: 'family' },
      },
      trigger: Platform.OS === 'android' ? { channelId: 'family' } : null,
    });
  } catch {}
}
