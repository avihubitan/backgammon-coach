import { AppState } from 'react-native';

import { dayKey, streakStatus } from '@/features/learning/progression';
import { planReminders, type PlannedReminder, type ReminderTime } from '@/features/reminders/reminderPlan';
import { analytics } from '@/services/analytics';
import { useProgressStore } from '@/state/progressStore';
import { useSettingsStore } from '@/state/settingsStore';

import type { NotificationsAdapter, ReminderPermission } from './types';

export interface ReminderDeps {
  /** Null where reminders can't work: the feature stays hidden. */
  adapter: NotificationsAdapter | null;
  now?: () => Date;
  /** Wait after a change before re-planning, so a burst of changes is one re-plan. */
  debounceMs?: number;
}

export type EnableResult = 'enabled' | 'denied' | 'unavailable';

/**
 * Daily reminders. The plan is rebuilt from the streak whenever it could have
 * changed (the app comes to the front, the player learns, the time is changed),
 * so a reminder never nags about a day that is already done.
 */
export function createReminderService({ adapter, now = () => new Date(), debounceMs = 600 }: ReminderDeps) {
  let running: Promise<void> | null = null;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let plan: PlannedReminder[] = [];
  let setupDone: Promise<void> | null = null;
  // Android needs its channel before the permission prompt, so everything waits for setup.
  const ready = () => (setupDone ??= adapter ? adapter.setup().catch(() => {}) : Promise.resolve());

  async function apply(): Promise<void> {
    if (!adapter) return;
    const { reminders } = useSettingsStore.getState();
    const allowed = reminders.enabled && (await adapter.getPermission()) === 'granted';
    const today = now();
    const next = allowed
      ? planReminders({ now: today, time: reminders, status: streakStatus(useProgressStore.getState().streak, dayKey(today)) })
      : [];
    // Replace everything: the messages depend on the streak, and there are only a few.
    for (const id of await adapter.scheduledIds()) await adapter.cancel(id);
    for (const reminder of next) await adapter.schedule(reminder);
    plan = next;
  }

  /** Re-plans now (or once more after the run in progress). Failures are not the player's problem: skip. */
  function syncNow(): Promise<void> {
    if (!adapter) return Promise.resolve();
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      try {
        do {
          again = false;
          await apply();
        } while (again);
      } catch {
        // The next change or app start tries again.
      } finally {
        running = null;
      }
    })();
    return running;
  }

  function requestSync() {
    if (!adapter) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void syncNow();
    }, debounceMs);
  }

  const update = (patch: Partial<ReminderTime & { enabled: boolean }>) => {
    const settings = useSettingsStore.getState();
    settings.update({ reminders: { ...settings.reminders, ...patch } });
  };

  return {
    available: adapter !== null,

    permission: (): Promise<ReminderPermission> => adapter?.getPermission() ?? Promise.resolve('denied'),

    /** Asks for permission if needed, then turns reminders on at `time` (or the saved time). */
    async enable(source: 'home' | 'settings', time?: ReminderTime): Promise<EnableResult> {
      if (!adapter) return 'unavailable';
      await ready();
      let permission = await adapter.getPermission();
      if (permission === 'undetermined') permission = await adapter.requestPermission();
      if (permission !== 'granted') {
        analytics.track('reminders_permission_denied', { source });
        return 'denied';
      }
      update({ enabled: true, ...time });
      useSettingsStore.getState().update({ reminderPrompt: 'done' });
      const { hour, minute } = useSettingsStore.getState().reminders;
      analytics.track('reminders_enabled', { hour, minute, source });
      await syncNow();
      return 'enabled';
    },

    disable() {
      update({ enabled: false });
      analytics.track('reminders_disabled', {});
      void syncNow();
    },

    setTime(time: ReminderTime) {
      update(time);
      void syncNow();
    },

    /** Home's offer, declined: it doesn't come back (settings still has the switch). */
    dismissPrompt() {
      useSettingsStore.getState().update({ reminderPrompt: 'dismissed' });
      analytics.track('reminder_prompt_dismissed', {});
    },

    /** The reminders currently planned (for display and tests). */
    planned: () => plan,

    syncNow,
    requestSync,

    /** Keeps the plan current: at start, when the app comes back, after learning, after a settings change. */
    start(): () => void {
      if (!adapter) return () => {};
      void ready().then(() => syncNow());
      const offProgress = useProgressStore.subscribe((state, previous) => {
        if (state.streak !== previous.streak) requestSync();
      });
      const offSettings = useSettingsStore.subscribe((state, previous) => {
        if (state.reminders !== previous.reminders) requestSync();
      });
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') requestSync();
      });
      return () => {
        offProgress();
        offSettings();
        subscription.remove();
        if (timer) clearTimeout(timer);
      };
    },
  };
}

export type ReminderService = ReturnType<typeof createReminderService>;
