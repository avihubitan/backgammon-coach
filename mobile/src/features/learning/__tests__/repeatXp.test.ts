import { getLesson, isScored } from '@/curriculum';
import type { LessonOutcome } from '@/features/lessons/engine/session';
import { usePracticeStore, roundsOn } from '@/state/practiceStore';

import { applyLessonResult, grantXp, initialProgress, withSkillXp, type ProgressData } from '../progressModel';
import {
  emptyLessonRecord,
  exerciseXp,
  lessonRepeatFactor,
  MISTAKE_MASTERED_XP,
  repeatFactor,
  REPEAT_XP,
} from '../progression';

const outcome: LessonOutcome = {
  accuracy: 1,
  stars: 3,
  passed: true,
  scoredSteps: 4,
  firstTryCorrect: 4,
  mistakes: 0,
  durationMs: 60_000,
};
const solved = { mistakes: 0, solved: true, revealed: false };
const today = '2026-10-04';
const yesterday = '2026-10-03';

describe('XP for repeating the same thing', () => {
  it('pays in full three times a day, then half, then a quarter', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 20].map(repeatFactor)).toEqual([1, 1, 1, 0.5, 0.5, 0.5, 0.25, 0.25]);
    expect(REPEAT_XP[0]).toBe(1);
    expect(exerciseXp(solved, true)).toBe(5);
    expect(exerciseXp(solved, true, 0.5)).toBe(3);
    expect(exerciseXp(solved, false, 0.25)).toBe(3);
    expect(exerciseXp({ ...solved, revealed: true }, true, 1)).toBe(0);
    expect(MISTAKE_MASTERED_XP).toBeGreaterThan(exerciseXp(solved));
  });

  it('never cuts a first run of a lesson, and counts replays per day', () => {
    expect(lessonRepeatFactor(undefined, today)).toBe(1);
    expect(lessonRepeatFactor({ ...emptyLessonRecord(), lastPlayedAt: today, dayPlays: 5 }, today)).toBe(1);
    const finished = { ...emptyLessonRecord(), completed: true, lastPlayedAt: today, dayPlays: 3 };
    expect(lessonRepeatFactor(finished, today)).toBe(0.5);
    expect(lessonRepeatFactor({ ...finished, lastPlayedAt: yesterday }, today)).toBe(1);
    // Saves from before the count existed: a play today counts as one.
    expect(lessonRepeatFactor({ ...finished, dayPlays: undefined }, today)).toBe(1);
  });

  it('records plays per day and pays replays less after three in a day', () => {
    const lesson = getLesson('hitting-1')!;
    const results = Object.fromEntries(lesson.steps.filter(isScored).map((step) => [step.id, solved]));
    let data: ProgressData = initialProgress();
    const exercises: number[] = [];
    for (let play = 0; play < 5; play++) {
      const applied = applyLessonResult(data, lesson.id, outcome, today, [], results);
      data = applied.data;
      exercises.push(applied.reward.xp.exercises);
    }
    expect(data.lessons[lesson.id].dayPlays).toBe(5);
    const full = exercises[1];
    // First run, two full replays, then half.
    expect(exercises[0]).toBeGreaterThan(full);
    expect(exercises.slice(1, 3)).toEqual([full, full]);
    expect(exercises[3]).toBeLessThan(full);
    expect(exercises[3]).toBeGreaterThanOrEqual(Math.floor(full / 2));
    // A new day starts the count again.
    const nextDay = applyLessonResult(data, lesson.id, outcome, '2026-10-05', [], results);
    expect(nextDay.data.lessons[lesson.id].dayPlays).toBe(1);
    expect(nextDay.reward.xp.exercises).toBe(full);
  });

  it('counts practice rounds per day', () => {
    usePracticeStore.getState().reset();
    const store = usePracticeStore.getState();
    store.recordSession('hitting', 4, '2026-10-04T09:00:00');
    store.recordSession('hitting', 5, '2026-10-04T18:00:00');
    expect(roundsOn(usePracticeStore.getState().records.hitting, today)).toBe(2);
    expect(roundsOn(usePracticeStore.getState().records.hitting, '2026-10-05')).toBe(0);
    store.recordSession('hitting', 5, '2026-10-05T08:00:00');
    expect(usePracticeStore.getState().records.hitting?.dayRounds).toEqual({ day: '2026-10-05', rounds: 1 });
    expect(usePracticeStore.getState().records.hitting?.sessions).toBe(3);
  });
});

describe('skill level XP after a lesson', () => {
  it('joins the lesson’s reward as one celebration', () => {
    const lesson = applyLessonResult(initialProgress(), 'board-1', outcome, today);
    const extra = grantXp(lesson.data, 40, today).reward;
    const combined = withSkillXp(lesson.reward, extra);
    expect(combined.xpGained).toBe(lesson.reward.xpGained + 40);
    expect(combined.xp).toMatchObject({ skills: 40, total: lesson.reward.xp.total + 40 });
    expect(combined.levelAfter).toBe(extra.levelAfter);
    expect(withSkillXp(lesson.reward, { ...extra, xpGained: 0 })).toBe(lesson.reward);
  });
});
