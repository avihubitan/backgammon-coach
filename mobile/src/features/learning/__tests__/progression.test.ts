import { allLessons, curriculum, type Lesson } from '@/curriculum';

import {
  blockingLesson,
  dayKey,
  emptyLessonRecord,
  daysBetween,
  emptyStreak,
  FREEZE_EVERY,
  MAX_FREEZES,
  exerciseXp,
  isFeatureUnlocked,
  lessonStatus,
  lessonXpBreakdown,
  levelInfo,
  maxLessonXp,
  newlyUnlockedLessons,
  nextLesson,
  premiumLessonsLeft,
  PLAY_EARLY_SECTION,
  playAccess,
  pruneDays,
  registerActivity,
  sectionProgress,
  shiftDay,
  streakStatus,
  visibleStreak,
  type ActivityResult,
  type StreakState,
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

  describe('with premium lessons the learner cannot open', () => {
    // A tiny path: a free lesson, then a premium course whose first lesson is a free preview,
    // then another premium course.
    const path = allLessons.slice(0, 7);
    const [free, previewA, premiumA1, premiumA2, previewB, premiumB1, premiumB2] = path;
    const canAccess = (id: string) => ![premiumA1.id, premiumA2.id, premiumB1.id, premiumB2.id].includes(id);

    it('shows reached premium lessons with a crown and keeps unreached ones locked', () => {
      const records = done(free.id, previewA.id);
      expect(lessonStatus(previewA.id, records, path, canAccess)).toBe('completed');
      expect(lessonStatus(premiumA1.id, records, path, canAccess)).toBe('premium');
      expect(lessonStatus(premiumA2.id, records, path, canAccess)).toBe('premium');
      expect(lessonStatus(premiumB1.id, done(free.id), path, canAccess)).toBe('locked');
    });

    it('lets premium lessons be skipped so the next free preview opens', () => {
      expect(lessonStatus(previewB.id, done(free.id), path, canAccess)).toBe('locked');
      expect(blockingLesson(previewB.id, done(free.id), path, canAccess)?.id).toBe(previewA.id);
      const records = done(free.id, previewA.id);
      expect(lessonStatus(previewB.id, records, path, canAccess)).toBe('available');
      expect(nextLesson(records, path, canAccess)?.id).toBe(previewB.id);
      expect(newlyUnlockedLessons(previewA.id, path, canAccess).map((lesson) => lesson.id)).toEqual([previewB.id]);
    });

    it('knows what is left behind Premium once the free lessons are done', () => {
      const records = done(free.id, previewA.id, previewB.id);
      expect(nextLesson(records, path, canAccess)).toBeNull();
      expect(premiumLessonsLeft(records, path, canAccess).map((lesson) => lesson.id)).toEqual([
        premiumA1.id,
        premiumA2.id,
        premiumB1.id,
        premiumB2.id,
      ]);
    });

    it('behaves exactly like the plain path when everything is open', () => {
      const records = done(free.id, previewA.id);
      expect(lessonStatus(premiumA1.id, records, path)).toBe('available');
      expect(lessonStatus(premiumA2.id, records, path)).toBe('locked');
      expect(lessonStatus(previewB.id, records, path)).toBe('locked');
      expect(newlyUnlockedLessons(previewA.id, path).map((lesson) => lesson.id)).toEqual([premiumA1.id]);
      expect(premiumLessonsLeft(records, path)).toEqual([]);
    });
  });

  it('opens full games early, after the board, and fully after the rules', () => {
    const through = (sectionId: string) =>
      done(...curriculum.slice(0, curriculum.findIndex((section) => section.id === sectionId) + 1).flatMap((section) => section.lessons.map((lesson) => lesson.id)));
    expect(playAccess({})).toBe('locked');
    expect(playAccess(done(...curriculum[0].lessons.slice(0, -1).map((lesson) => lesson.id)))).toBe('locked');
    expect(playAccess(through(PLAY_EARLY_SECTION))).toBe('early');
    expect(playAccess(through('position'))).toBe('early');
    expect(playAccess(through('bearing-off'))).toBe('open');
    // Counting the race (the last bearing-off lesson) isn't a rule: games open without it.
    const rules = through('bearing-off');
    delete rules['bearoff-4'];
    expect(playAccess(rules)).toBe('open');
    delete rules['bearoff-3'];
    expect(playAccess(rules)).toBe('early');
  });

  it('unlocks practice once the first section is complete', () => {
    expect(isFeatureUnlocked('practice', {})).toBe(false);
    expect(isFeatureUnlocked('practice', done(...curriculum[0].lessons.map((lesson) => lesson.id)))).toBe(true);
  });
});

describe('streaks', () => {
  it('starts a streak on the first active day', () => {
    const { streak, extended } = registerActivity(emptyStreak(), '2026-03-10');
    expect(streak).toEqual({ current: 1, longest: 1, lastActiveDay: '2026-03-10', freezes: 0 });
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

/** Active on each of the given days, in order. */
function activeOn(days: string[], start: StreakState = emptyStreak()) {
  let streak = start;
  const results: ActivityResult[] = [];
  for (const day of days) {
    const result = registerActivity(streak, day);
    results.push(result);
    streak = result.streak;
  }
  return { streak, results };
}

const week = (from: string, n = FREEZE_EVERY) => Array.from({ length: n }, (_, index) => shiftDay(from, index));

describe('streak freezes', () => {
  it('earns a freeze for every week in a row, up to the limit', () => {
    const { streak, results } = activeOn(week('2026-03-01', FREEZE_EVERY * 3));
    expect(results.filter((result) => result.freezeEarned)).toHaveLength(MAX_FREEZES);
    expect(results[FREEZE_EVERY - 1].freezeEarned).toBe(true);
    expect(results[FREEZE_EVERY - 2].freezeEarned).toBe(false);
    expect(streak.freezes).toBe(MAX_FREEZES);
    expect(streak.current).toBe(FREEZE_EVERY * 3);
  });

  it('covers a missed day and keeps the streak growing', () => {
    const { streak } = activeOn(week('2026-03-01'));
    expect(streak.freezes).toBe(1);
    // 2026-03-08 is missed.
    const next = registerActivity(streak, '2026-03-09');
    expect(next.freezesUsed).toBe(1);
    expect(next.streak.current).toBe(FREEZE_EVERY + 1);
    expect(next.streak.freezes).toBe(0);
  });

  it('starts again when the gap is longer than the freezes, keeping them', () => {
    const { streak } = activeOn(week('2026-03-01'));
    const next = registerActivity(streak, '2026-03-10');
    expect(next.freezesUsed).toBe(0);
    expect(next.streak.current).toBe(1);
    expect(next.streak.freezes).toBe(1);
    expect(next.streak.longest).toBe(FREEZE_EVERY);
  });

  it('can bridge two missed days with two freezes', () => {
    const start: StreakState = { current: 20, longest: 20, lastActiveDay: '2026-03-10', freezes: 2 };
    const next = registerActivity(start, '2026-03-13');
    expect(next.freezesUsed).toBe(2);
    expect(next.streak).toEqual({ current: 21, longest: 21, lastActiveDay: '2026-03-13', freezes: 1 });
    // Day 21 is a full week again, so a new freeze arrives at once.
    expect(next.freezeEarned).toBe(true);
  });

  it('treats saves from before freezes as having none', () => {
    const old = { current: 5, longest: 5, lastActiveDay: '2026-03-10' };
    expect(registerActivity(old, '2026-03-12').streak.current).toBe(1);
    expect(registerActivity(old, '2026-03-11').streak.freezes).toBe(0);
  });

  it('keeps showing a streak that freezes are covering', () => {
    const streak: StreakState = { current: 9, longest: 9, lastActiveDay: '2026-03-10', freezes: 1 };
    expect(streakStatus(streak, '2026-03-11')).toEqual({ days: 9, activeToday: false, covering: 0, freezes: 1, nextFreezeIn: 5 });
    expect(streakStatus(streak, '2026-03-12')).toEqual({ days: 9, activeToday: false, covering: 1, freezes: 0, nextFreezeIn: 5 });
    expect(streakStatus(streak, '2026-03-13').days).toBe(0);
    expect(visibleStreak(streak, '2026-03-12')).toBe(9);
  });

  it('counts down to the next freeze', () => {
    expect(streakStatus({ current: 6, longest: 6, lastActiveDay: '2026-03-10', freezes: 0 }, '2026-03-10').nextFreezeIn).toBe(1);
    expect(streakStatus({ current: 7, longest: 7, lastActiveDay: '2026-03-10', freezes: 1 }, '2026-03-10').nextFreezeIn).toBe(7);
    // Not active yet today: today counts.
    expect(streakStatus({ current: 6, longest: 6, lastActiveDay: '2026-03-09', freezes: 0 }, '2026-03-10').nextFreezeIn).toBe(1);
    expect(streakStatus(emptyStreak(), '2026-03-10').nextFreezeIn).toBe(FREEZE_EVERY);
    // A full reserve earns nothing more.
    expect(streakStatus({ current: 30, longest: 30, lastActiveDay: '2026-03-10', freezes: 2 }, '2026-03-10').nextFreezeIn).toBeNull();
  });

  it('neither grows nor breaks the streak when the clock moves back a day', () => {
    const streak: StreakState = { current: 5, longest: 5, lastActiveDay: '2026-03-11', freezes: 0 };
    const result = registerActivity(streak, '2026-03-10');
    expect(result.extended).toBe(false);
    expect(result.streak).toBe(streak);
    expect(streakStatus(streak, '2026-03-10')).toMatchObject({ days: 5, activeToday: true });
  });

  it('counts calendar days across months and years', () => {
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1);
    expect(daysBetween('2025-12-31', '2026-01-02')).toBe(2);
    expect(daysBetween('2026-03-10', '2026-03-10')).toBe(0);
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
