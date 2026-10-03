import AsyncStorage from '@react-native-async-storage/async-storage';

import { REMINDER_DAYS } from '@/features/reminders/reminderPlan';
import { recentEvents } from '@/services/analytics';
import { setProgressClock, useProgressStore } from '@/state/progressStore';
import { DEFAULT_SETTINGS, useSettingsStore } from '@/state/settingsStore';

import { createMemoryNotifications } from '../memoryNotifications';
import { createReminderService } from '../reminderService';

const morning = new Date(2026, 2, 10, 9, 0);

function setup(answer: 'granted' | 'denied' = 'granted') {
  const adapter = createMemoryNotifications(answer);
  const service = createReminderService({ adapter, now: () => morning, debounceMs: 0 });
  return { adapter, service };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  setProgressClock(() => morning);
  useProgressStore.getState().resetProgress();
  useSettingsStore.setState({ reminders: DEFAULT_SETTINGS.reminders, reminderPrompt: 'unasked' });
});

describe('reminder service', () => {
  it('asks for permission, turns reminders on and schedules the next days', async () => {
    const { adapter, service } = setup();
    expect(await service.enable('home', { hour: 20, minute: 30 })).toBe('enabled');
    expect(useSettingsStore.getState().reminders).toEqual({ enabled: true, hour: 20, minute: 30 });
    expect(useSettingsStore.getState().reminderPrompt).toBe('done');
    const scheduled = adapter.scheduled();
    expect(scheduled).toHaveLength(REMINDER_DAYS);
    expect(scheduled[0].date).toEqual(new Date(2026, 2, 10, 20, 30));
    expect(service.planned()).toEqual(scheduled);
  });

  it('leaves everything off when the player says no', async () => {
    const { adapter, service } = setup('denied');
    expect(await service.enable('settings')).toBe('denied');
    expect(useSettingsStore.getState().reminders.enabled).toBe(false);
    expect(adapter.scheduled()).toEqual([]);
    expect(await service.permission()).toBe('denied');
  });

  it('drops today’s reminder once the player has learned', async () => {
    const { adapter, service } = setup();
    await service.enable('home', { hour: 19, minute: 0 });
    expect(adapter.scheduled()[0].date.getDate()).toBe(10);

    useProgressStore.getState().awardXp(10);
    await service.syncNow();
    const [first] = adapter.scheduled();
    expect(first.date).toEqual(new Date(2026, 2, 11, 19, 0));
    expect(first.title).toBe('Keep your 1-day streak going');
  });

  it('moves every reminder when the time changes, without duplicates', async () => {
    const { adapter, service } = setup();
    await service.enable('settings', { hour: 19, minute: 0 });
    service.setTime({ hour: 8, minute: 0 });
    await service.syncNow();
    // The plan covers the next four days including today, and 8:00 today has passed at 9:00.
    expect(adapter.scheduled().map((reminder) => [reminder.date.getDate(), reminder.date.getHours()])).toEqual([
      [11, 8],
      [12, 8],
      [13, 8],
    ]);
  });

  it('cancels everything when turned off', async () => {
    const { adapter, service } = setup();
    await service.enable('settings');
    service.disable();
    await service.syncNow();
    expect(adapter.scheduled()).toEqual([]);
    expect(useSettingsStore.getState().reminders.enabled).toBe(false);
  });

  it('remembers that Home’s offer was declined', () => {
    const { service } = setup();
    service.dismissPrompt();
    expect(useSettingsStore.getState().reminderPrompt).toBe('dismissed');
  });

  it('re-plans after learning once started', async () => {
    jest.useFakeTimers();
    try {
      const { adapter, service } = setup();
      const stop = service.start();
      await service.enable('home', { hour: 19, minute: 0 });
      useProgressStore.getState().awardXp(10);
      await jest.runOnlyPendingTimersAsync();
      await service.syncNow();
      expect(adapter.scheduled()[0].date.getDate()).toBe(11);
      stop();
    } finally {
      jest.useRealTimers();
    }
  });

  it('finishes setup (the Android channel) before asking for permission', async () => {
    const { adapter, service } = setup();
    const order: string[] = [];
    adapter.setup = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push('setup');
    };
    const request = adapter.requestPermission;
    adapter.requestPermission = async () => {
      order.push('permission');
      return request();
    };
    await service.enable('settings');
    expect(order).toEqual(['setup', 'permission']);
  });

  it('does nothing where reminders are unavailable', async () => {
    const service = createReminderService({ adapter: null });
    expect(service.available).toBe(false);
    expect(await service.enable('settings')).toBe('unavailable');
    expect(useSettingsStore.getState().reminders.enabled).toBe(false);
  });

  it('reports a tapped reminder and tells the app, once started', () => {
    const { adapter, service } = setup();
    const opened: string[] = [];
    const offApp = service.onOpened((kind) => opened.push(kind));
    adapter.tap('daily-reminder');
    expect(opened).toEqual([]);

    const stop = service.start();
    adapter.tap('daily-reminder');
    expect(opened).toEqual(['daily-reminder']);
    expect(recentEvents.events.at(-1)).toMatchObject({ name: 'notification_opened', properties: { kind: 'daily-reminder' } });

    stop();
    offApp();
    adapter.tap('daily-reminder');
    expect(opened).toEqual(['daily-reminder']);
  });

  it('sends a test reminder after asking for permission', async () => {
    const { adapter, service } = setup();
    expect(await service.sendTest()).toBe('enabled');
    expect(adapter.tests).toEqual([5]);
    expect(await adapter.getPermission()).toBe('granted');

    const denied = setup('denied');
    expect(await denied.service.sendTest()).toBe('denied');
    expect(denied.adapter.tests).toEqual([]);
  });
});
