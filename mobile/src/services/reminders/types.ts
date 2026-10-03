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
  /**
   * Calls `listener` with the notification's kind when the player opens the app
   * from one of ours, including the tap that started the app. Returns a stop function.
   */
  onOpened(listener: (kind: string) => void): () => void;
  /** Shows a test reminder after `seconds` (checking reminders on a phone). */
  scheduleTest(seconds: number): Promise<void>;
}
