import type { PlannedReminder } from '@/features/reminders/reminderPlan';

export type ReminderPermission = 'granted' | 'denied' | 'undetermined';

/**
 * The device's notification system, as reminders need it. The real one wraps
 * expo-notifications; development web builds get a simulated one so the flow
 * can be tried in a browser.
 */
export interface NotificationsAdapter {
  readonly name: string;
  /** One-time setup: how notifications show while the app is open, the Android channel. */
  setup(): Promise<void>;
  getPermission(): Promise<ReminderPermission>;
  /** Shows the system prompt when the player hasn't answered it yet. */
  requestPermission(): Promise<ReminderPermission>;
  /** Ids of this app's scheduled reminders. */
  scheduledIds(): Promise<string[]>;
  schedule(reminder: PlannedReminder): Promise<void>;
  cancel(id: string): Promise<void>;
}
