import AsyncStorage from '@react-native-async-storage/async-storage';

import { useDailyPositionStore } from '../dailyPositionStore';

const bank = (id: string) => ({ source: 'bank' as const, id });
const day = '2026-10-04';
const tomorrow = '2026-10-05';

describe('daily position store', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useDailyPositionStore.getState().reset();
  });

  it('keeps today’s position, and starts fresh on a new day', () => {
    const store = useDailyPositionStore.getState();
    store.keep(day, bank('p001'));
    expect(useDailyPositionStore.getState()).toMatchObject({ day, ref: 'bank:p001', done: false, seen: [] });
    store.finish(day, bank('p001'), true, true);
    expect(useDailyPositionStore.getState()).toMatchObject({ ref: 'bank:p001', done: true, correct: true, seen: ['bank:p001'] });
    // Showing it again the same day changes nothing.
    store.keep(day, bank('p001'));
    expect(useDailyPositionStore.getState().done).toBe(true);
    store.keep(tomorrow, bank('p002'));
    expect(useDailyPositionStore.getState()).toMatchObject({ day: tomorrow, ref: 'bank:p002', done: false, correct: null, seen: [] });
  });

  it('counts extra positions as seen without touching today’s', () => {
    const store = useDailyPositionStore.getState();
    store.keep(day, bank('p001'));
    store.finish(day, bank('p007'), false, false);
    expect(useDailyPositionStore.getState()).toMatchObject({ ref: 'bank:p001', done: false, correct: null, seen: ['bank:p007'] });
    store.finish(day, bank('p001'), false, true);
    expect(useDailyPositionStore.getState()).toMatchObject({ done: true, correct: false, seen: ['bank:p007', 'bank:p001'] });
  });

  it('marks the daily position done even if it was never kept (opened straight from a link)', () => {
    useDailyPositionStore.getState().finish(day, bank('p003'), true, true);
    expect(useDailyPositionStore.getState()).toMatchObject({ day, ref: 'bank:p003', done: true, correct: true });
  });

  it('repairs a damaged save', async () => {
    const damaged = { day: 7, ref: 'nonsense', done: 'yes', correct: 'no', seen: ['bank:p001', 3, null] };
    await AsyncStorage.setItem('bg-coach/daily-position', JSON.stringify({ state: damaged, version: 1 }));
    await useDailyPositionStore.persist.rehydrate();
    expect(useDailyPositionStore.getState()).toMatchObject({ day: null, ref: null, done: false, correct: null, seen: ['bank:p001'] });
    // Still a working store.
    useDailyPositionStore.getState().keep(day, bank('p004'));
    expect(useDailyPositionStore.getState().ref).toBe('bank:p004');
  });
});
