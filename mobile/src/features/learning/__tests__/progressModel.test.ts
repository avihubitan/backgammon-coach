import { allLessons } from '@/curriculum';
import type { LessonOutcome } from '@/features/lessons/engine/session';

import { applyLessonResult, grantXp, initialProgress } from '../progressModel';
import { lessonStatus } from '../progression';

const outcome = (overrides: Partial<LessonOutcome> = {}): LessonOutcome => ({
  accuracy: 1,
  stars: 3,
  passed: true,
  scoredSteps: 4,
  firstTryCorrect: 4,
  mistakes: 0,
  durationMs: 90_000,
  ...overrides,
});

describe('applying lesson results', () => {
  const [first, second] = allLessons;

  it('completes the lesson, awards XP and unlocks the next lesson', () => {
    const { data, reward } = applyLessonResult(initialProgress(), first.id, outcome(), '2026-03-10');
    expect(data.lessons[first.id]).toMatchObject({ completed: true, bestStars: 3, attempts: 1, completions: 1 });
    expect(reward.firstCompletion).toBe(true);
    expect(reward.xpGained).toBe(first.xp + 5);
    expect(data.xp).toBe(first.xp + 5);
    expect(reward.unlockedLessons.map((lesson) => lesson.id)).toEqual([second.id]);
    expect(lessonStatus(second.id, data.lessons)).toBe('available');
    expect(data.xpByDay['2026-03-10']).toBe(first.xp + 5);
    expect(data.stats.exercisesAttempted).toBe(4);
    expect(data.stats.exercisesFirstTry).toBe(4);
  });

  it('starts a streak and unlocks the first achievement', () => {
    const { data, reward } = applyLessonResult(initialProgress(), first.id, outcome(), '2026-03-10');
    expect(reward.streak).toBe(1);
    expect(reward.streakExtended).toBe(true);
    expect(reward.newAchievements).toContain('first-steps');
    expect(reward.newAchievements).toContain('perfectionist');
    expect(data.achievements['first-steps']).toBe('2026-03-10');
  });

  it('gives reduced XP and no unlocks when replaying', () => {
    const once = applyLessonResult(initialProgress(), first.id, outcome({ stars: 2, accuracy: 0.7 }), '2026-03-10');
    const twice = applyLessonResult(once.data, first.id, outcome(), '2026-03-10');
    expect(twice.reward.firstCompletion).toBe(false);
    expect(twice.reward.unlockedLessons).toEqual([]);
    expect(twice.reward.xpGained).toBeLessThan(first.xp);
    expect(twice.data.lessons[first.id]).toMatchObject({ bestStars: 3, attempts: 2, completions: 2 });
    expect(twice.reward.newAchievements).not.toContain('first-steps');
  });

  it('does not complete a failed attempt', () => {
    const { data, reward } = applyLessonResult(
      initialProgress(),
      first.id,
      outcome({ passed: false, stars: 0, accuracy: 0.2 }),
      '2026-03-10',
    );
    expect(data.lessons[first.id].completed).toBe(false);
    expect(reward.xpGained).toBe(0);
    expect(lessonStatus(second.id, data.lessons)).toBe('locked');
  });

  it('notices when the daily goal is reached', () => {
    let data = initialProgress();
    data = grantXp(data, 20, '2026-03-10').data;
    const { reward } = grantXp(data, 15, '2026-03-10');
    expect(reward.dailyGoalReached).toBe(true);
    expect(grantXp(grantXp(data, 15, '2026-03-10').data, 5, '2026-03-10').reward.dailyGoalReached).toBe(false);
  });

  it('reports level ups', () => {
    const { reward } = grantXp(initialProgress(), 40, '2026-03-10');
    expect(reward.levelBefore).toBe(1);
    expect(reward.levelAfter).toBe(2);
  });

  it('rejects unknown lessons', () => {
    expect(() => applyLessonResult(initialProgress(), 'nope', outcome(), '2026-03-10')).toThrow();
  });
});
