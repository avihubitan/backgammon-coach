import { allLessons, curriculum, type Lesson } from '@/curriculum';

import {
  dayKey,
  emptyLessonRecord,
  emptyStreak,
  exerciseXp,
  isFeatureUnlocked,
  lessonStatus,
  lessonXpBreakdown,
  levelInfo,
  maxLessonXp,
  nextLesson,
  pruneDays,
  registerActivity,
  sectionProgress,
  shiftDay,
  visibleStreak,
  xpForLevel,
  type LessonRecords,
} from '../progression';

const done = (...ids: string[]): LessonRecords =>
  Object.fromEntries(ids.map((id) => [id, { ...emptyLessonRecord(), completed: true, bestStars: 3 }]));

describe('levels', () => {
  it('starts at level 1 and grows by 15 XP per level', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(30);
    expect(xpForLevel(3)).toBe(75);
    expect(xpForLevel(4)).toBe(135);
  });

  it('computes progress within a level', () => {
    expect(levelInfo(0)).toMatchObject({ level: 1, intoLevel: 0, toNext: 30 });
    expect(levelInfo(30)).toMatchObject({ level: 2, intoLevel: 0, levelSpan: 45 });
    expect(levelInfo(52).progress).toBeCloseTo(22 / 45);
  });
});

describe('lesson XP', () => {
  const firstTry = { mistakes: 0, solved: true, revealed: false };
  const retried = { mistakes: 2, solved: true, revealed: false };
  const shown = { mistakes: 1, solved: true, revealed: true };
  const lesson = {
    xp: 20,
    steps: [
      { id: 'a', kind: 'explain' },
      { id: 'b', kind: 'choice' },
      { id: 'c', kind: 'move' },
      { id: 'd', kind: 'tap' },
    ],
  } as unknown as Lesson;

  it('pays per exercise: full on the first try, half after a mistake, none when shown', () => {
    expect(exerciseXp(firstTry)).toBe(10);
    expect(exerciseXp(retried)).toBe(5);
    expect(exerciseXp(shown)).toBe(0);
    expect(exerciseXp(undefined)).toBe(0);
    expect(exerciseXp({ mistakes: 1, solved: false, revealed: false })).toBe(0);
  });

  it('adds the lesson bonus and a perfect bonus on the first completion', () => {
    const results = { b: firstTry, c: firstTry, d: firstTry };
    expect(lessonXpBreakdown(lesson, results, { passed: true, stars: 3 }, true, false)).toEqual({
      exercises: 30,
      completion: 20,
      perfect: 5,
      total: 55,
    });
    expect(maxLessonXp(lesson)).toBe(55);
    const mixed = { b: firstTry, c: retried, d: shown };
    expect(lessonXpBreakdown(lesson, mixed, { passed: true, stars: 2 }, true, false).total).toBe(35);
  });

  it('pays half for replays and no bonuses', () => {
    const results = { b: firstTry, c: retried, d: firstTry };
    expect(lessonXpBreakdown(lesson, results, { passed: true, stars: 3 }, false, true)).toEqual({
      exercises: 13,
      completion: 0,
      perfect: 0,
      total: 13,
    });
  });

  it('keeps exercise XP but no bonuses for a failed attempt', () => {
    const results = { b: firstTry };
    expect(lessonXpBreakdown(lesson, results, { passed: false, stars: 0 }, false, false)).toEqual({
      exercises: 10,
      completion: 0,
      perfect: 0,
      total: 10,
    });
  });
});

describe('unlocking', () => {
  const [first, second, third] = allLessons;

  it('only the first lesson is available at the start', () => {
    expect(lessonStatus(first.id, {})).toBe('available');
    expect(lessonStatus(second.id, {})).toBe('locked');
  });

  it('completing a lesson unlocks the next one', () => {
    const records = done(first.id);
    expect(lessonStatus(first.id, records)).toBe('completed');
    expect(lessonStatus(second.id, records)).toBe('available');
    expect(lessonStatus(third.id, records)).toBe('locked');
    expect(nextLesson(records)?.id).toBe(second.id);
  });

  it('reports section progress', () => {
    const section = curriculum[0];
    const progress = sectionProgress(section, done(section.lessons[0].id));
    expect(progress.completed).toBe(1);
    expect(progress.total).toBe(section.lessons.length);
    expect(progress.unlocked).toBe(true);
    expect(progress.done).toBe(false);
    expect(progress.stars).toBe(3);
  });

  it('returns null when every lesson is complete', () => {
    expect(nextLesson(done(...allLessons.map((lesson) => lesson.id)))).toBeNull();
  });

  it('unlocks practice once the first section is complete', () => {
    expect(isFeatureUnlocked('practice', {})).toBe(false);
    expect(isFeatureUnlocked('practice', done(...curriculum[0].lessons.map((lesson) => lesson.id)))).toBe(true);
  });
});

describe('streaks', () => {
  it('starts a streak on the first active day', () => {
    const { streak, extended } = registerActivity(emptyStreak(), '2026-03-10');
    expect(streak).toEqual({ current: 1, longest: 1, lastActiveDay: '2026-03-10' });
    expect(extended).toBe(true);
  });

  it('does not double count the same day', () => {
    const first = registerActivity(emptyStreak(), '2026-03-10').streak;
    const again = registerActivity(first, '2026-03-10');
    expect(again.extended).toBe(false);
    expect(again.streak.current).toBe(1);
  });

  it('grows on consecutive days, including across months', () => {
    let streak = registerActivity(emptyStreak(), '2026-02-28').streak;
    streak = registerActivity(streak, '2026-03-01').streak;
    expect(streak.current).toBe(2);
  });

  it('resets after a missed day but remembers the longest', () => {
    let streak = registerActivity(emptyStreak(), '2026-03-10').streak;
    streak = registerActivity(streak, '2026-03-11').streak;
    streak = registerActivity(streak, '2026-03-13').streak;
    expect(streak.current).toBe(1);
    expect(streak.longest).toBe(2);
  });

  it('shows the streak until the day after the last activity', () => {
    const streak = { current: 4, longest: 4, lastActiveDay: '2026-03-10' };
    expect(visibleStreak(streak, '2026-03-10')).toBe(4);
    expect(visibleStreak(streak, '2026-03-11')).toBe(4);
    expect(visibleStreak(streak, '2026-03-12')).toBe(0);
  });
});

describe('days', () => {
  it('formats local dates', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('shifts across year boundaries', () => {
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDay('2025-12-31', 1)).toBe('2026-01-01');
  });

  it('prunes old days', () => {
    expect(pruneDays({ '2026-01-01': 5, '2026-03-01': 10 }, '2026-03-10', 30)).toEqual({ '2026-03-01': 10 });
  });
});
