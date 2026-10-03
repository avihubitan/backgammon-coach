import type { PlannedReminder } from '@/features/reminders/reminderPlan';

import type { NotificationsAdapter, ReminderPermission } from './types';

/** Keeps "scheduled" reminders in memory: for tests and development web builds. */
export function createMemoryNotifications(answer: ReminderPermission = 'granted') {
  let permission: ReminderPermission = 'undetermined';
  const scheduled = new Map<string, PlannedReminder>();
  const listeners = new Set<(kind: string) => void>();
  const tests: number[] = [];
  const adapter: NotificationsAdapter & {
    scheduled: () => PlannedReminder[];
    setAnswer: (next: ReminderPermission) => void;
    /** Simulates the player tapping one of our notifications. */
    tap: (kind: string) => void;
    /** Seconds of each test reminder requested. */
    tests: number[];
  } = {
    name: 'memory',
    setup: async () => {},
    getPermission: async () => permission,
    requestPermission: async () => {
      if (permission === 'undetermined') permission = answer;
      return permission;
    },
    scheduledIds: async () => [...scheduled.keys()],
    schedule: async (reminder) => {
      scheduled.set(reminder.id, reminder);
    },
    cancel: async (id) => {
      scheduled.delete(id);
    },
    onOpened: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    scheduleTest: async (seconds) => {
      tests.push(seconds);
    },
    tap: (kind) => listeners.forEach((listener) => listener(kind)),
    tests,
    scheduled: () => [...scheduled.values()].sort((a, b) => a.date.getTime() - b.date.getTime()),
    setAnswer: (next) => {
      answer = next;
    },
  };
  return adapter;
}
