import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

/**
 * Push registration.
 *
 * Notification payloads from this platform are deliberately generic — "you have
 * an upcoming private pastoral session", never what it concerns — so a
 * notification on a lock screen discloses nothing.
 */
export async function registerForPush(): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  if (!Device.isDevice) {
    return { ok: false, reason: 'Push notifications need a physical device.' };
  }

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;

  if (!granted && existing.canAskAgain) {
    const requested = await Notifications.requestPermissionsAsync();
    granted = requested.granted;
  }

  if (!granted) {
    return { ok: false, reason: 'Notifications are turned off for this app in your device settings.' };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Ministry notifications',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#c9922a',
    });
    await Notifications.setNotificationChannelAsync('counselling', {
      name: 'Counselling',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#c9922a',
    });
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync();
    await api('/api/notifications/push-token', {
      method: 'POST',
      body: {
        token: token.data,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        deviceName: Device.deviceName ?? undefined,
      },
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'We could not register this device for notifications.' };
  }
}

export async function unregisterPush() {
  try {
    const token = await Notifications.getExpoPushTokenAsync();
    await api('/api/notifications/push-token', {
      method: 'DELETE',
      body: { token: token.data },
    });
  } catch {
    // A device that cannot be unregistered here is unregistered server-side on
    // the next failed delivery; nothing is gained by surfacing this.
  }
}
