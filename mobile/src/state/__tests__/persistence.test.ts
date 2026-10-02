import AsyncStorage from '@react-native-async-storage/async-storage';

import { allLessons } from '@/curriculum';

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
});
