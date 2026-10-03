import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { REMINDER_ID_PREFIX } from '@/features/reminders/reminderPlan';

import type { NotificationsAdapter, ReminderPermission } from './types';

const CHANNEL_ID = 'reminders';

function toPermission(status: Notifications.NotificationPermissionsStatus): ReminderPermission {
  if (status.granted || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted';
  return status.canAskAgain ? 'undetermined' : 'denied';
}

/** Local notifications through expo-notifications (iOS and Android). */
export const platformNotifications: NotificationsAdapter | null = {
  name: 'expo-notifications',
  async setup() {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Daily reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
  },
  getPermission: async () => toPermission(await Notifications.getPermissionsAsync()),
  requestPermission: async () =>
    toPermission(await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } })),
  async scheduledIds() {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.map((request) => request.identifier).filter((id) => id.startsWith(REMINDER_ID_PREFIX));
  },
  async schedule(reminder) {
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: { title: reminder.title, body: reminder.body, data: { kind: 'daily-reminder' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.date, channelId: CHANNEL_ID },
    });
  },
  cancel: (id) => Notifications.cancelScheduledNotificationAsync(id),
};
