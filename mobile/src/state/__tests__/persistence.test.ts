import AsyncStorage from '@react-native-async-storage/async-storage';

import { allLessons } from '@/curriculum';
import { emptyStreak } from '@/features/learning/progression';

import { setProgressClock, useProgressStore } from '../progressStore';

const outcome = {
  accuracy: 1,
  stars: 3 as const,
  passed: true,
  scoredSteps: 3,
  firstTryCorrect: 3,
  mistakes: 0,
  durationMs: 1000,
};

describe('progress persistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useProgressStore.getState().resetProgress();
    setProgressClock(() => new Date(2026, 2, 10, 12));
  });

  it('writes progress to storage', async () => {
    useProgressStore.getState().completeOnboarding();
    useProgressStore.getState().recordLessonResult(allLessons[0].id, outcome);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const raw = await AsyncStorage.getItem('bg-coach/progress');
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw!);
    expect(saved.state.onboardingCompleted).toBe(true);
    expect(saved.state.lessons[allLessons[0].id].completed).toBe(true);
    expect(saved.state.xp).toBeGreaterThan(0);
    // Actions are not persisted.
    expect(saved.state.recordLessonResult).toBeUndefined();
  });

  it('restores progress from storage', async () => {
    useProgressStore.getState().recordLessonResult(allLessons[0].id, outcome);
    const xp = useProgressStore.getState().xp;
    await new Promise((resolve) => setTimeout(resolve, 0));
    const saved = await AsyncStorage.getItem('bg-coach/progress');

    // Simulate a relaunch: in-memory state is fresh, storage still holds the saved session.
    useProgressStore.getState().resetProgress();
    expect(useProgressStore.getState().xp).toBe(0);
    await AsyncStorage.setItem('bg-coach/progress', saved!);
    await useProgressStore.persist.rehydrate();

    expect(useProgressStore.getState().xp).toBe(xp);
    expect(useProgressStore.getState().lessons[allLessons[0].id].completed).toBe(true);
  });

  it('keeps the streak across days', () => {
    useProgressStore.getState().recordLessonResult(allLessons[0].id, outcome);
    setProgressClock(() => new Date(2026, 2, 11, 9));
    const reward = useProgressStore.getState().recordLessonResult(allLessons[1].id, outcome);
    expect(reward.streak).toBe(2);
    expect(useProgressStore.getState().streak.current).toBe(2);
  });
  it('repairs a damaged save instead of failing to start', async () => {
    const damaged = {
      onboardingCompleted: true,
      xp: 300,
      streak: null,
      lessons: { 'board-1': { completed: true }, broken: 'not a record' },
      xpByDay: { '2026-03-10': 30, bad: 'x' },
      stats: { exercisesAttempted: 12 },
    };
    await AsyncStorage.setItem('bg-coach/progress', JSON.stringify({ state: damaged, version: 1 }));
    await useProgressStore.persist.rehydrate();

    const state = useProgressStore.getState();
    expect(state.onboardingCompleted).toBe(true);
    expect(state.xp).toBe(300);
    expect(state.streak).toEqual(emptyStreak());
    expect(state.lessons['board-1']).toMatchObject({ completed: true, bestStars: 0, attempts: 0 });
    expect(state.lessons.broken).toBeUndefined();
    expect(state.xpByDay).toEqual({ '2026-03-10': 30 });
    expect(state.stats.exercisesAttempted).toBe(12);
    expect(state.stats.byCategory).toEqual({});
    // Still a working store.
    state.awardXp(10);
    expect(useProgressStore.getState().xp).toBe(310);
  });
});
