import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Local notifications only.
 * - "nav" channel: sticky, live-updated navigation card shown in the shade and on the lock screen.
 * - "family" channel: arrival alerts.
 *
 * expo-notifications is loaded LAZILY: in Expo Go (SDK 58) importing it at module load
 * crashes ("Cannot find native module 'ExpoApplication'"). In Expo Go / web every call is a no-op;
 * in the release APK everything works.
 */
type N = typeof import('expo-notifications');

const NAV_ID = 'hara-nav';
let mod: Promise<N | null> | null = null;
let ready: Promise<boolean> | null = null;

export const notificationsAvailable = Platform.OS !== 'web' && Constants.executionEnvironment !== 'storeClient';

function load(): Promise<N | null> {
  if (!mod) {
    mod = notificationsAvailable
      ? import('expo-notifications').then((m) => m as N).catch(() => null)
      : Promise.resolve(null);
  }
  return mod;
}

export function setupNotifications() {
  load().then((Notifications) => {
    try {
      Notifications?.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
    } catch {}
  });
}

async function createChannels(Notifications: N) {
  if (Platform.OS !== 'android') return;
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

/** Current permission state without prompting. */
export async function notificationPermission(): Promise<'granted' | 'denied' | 'undetermined' | 'unavailable'> {
  const Notifications = await load();
  if (!Notifications) return 'unavailable';
  try {
    const r = await Notifications.getPermissionsAsync();
    return r.granted ? 'granted' : r.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unavailable';
  }
}

/** Ask for permission (creates channels first so Android shows the prompt). */
export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = await load();
  if (!Notifications) return false;
  try {
    await createChannels(Notifications);
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

async function ensureReady(): Promise<N | null> {
  const Notifications = await load();
  if (!Notifications) return null;
  if (!ready) ready = requestNotificationPermission();
  return (await ready) ? Notifications : null;
}

export async function showNavNotification(title: string, body: string) {
  const Notifications = await ensureReady();
  if (!Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: NAV_ID,
      content: {
        title,
        body,
        sticky: true,
        autoDismiss: false,
        color: '#71FBC8',
        sound: false,
        data: { kind: 'nav' },
      },
      trigger: Platform.OS === 'android' ? { channelId: 'nav' } : null,
    });
  } catch {}
}

export async function clearNavNotification() {
  const Notifications = await load();
  try {
    await Notifications?.dismissNotificationAsync(NAV_ID);
  } catch {}
}

export async function triggerFamilyArrival(name = 'Nənə') {
  const Notifications = await ensureReady();
  if (!Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${name} evə çatdı`,
        body: 'Hara Ailə · Səfər 22:04-də bitdi · Marşrut balı 92 · İşıqforsuz keçid olmadı',
        color: '#71FBC8',
        data: { kind: 'family' },
      },
      trigger: Platform.OS === 'android' ? { channelId: 'family' } : null,
    });
  } catch {}
}
