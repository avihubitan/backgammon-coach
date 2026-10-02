import { allLessons, curriculum, type Lesson } from '@/curriculum';

import {
  dayKey,
  emptyLessonRecord,
  emptyStreak,
  isFeatureUnlocked,
  lessonStatus,
  lessonXp,
  levelInfo,
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
  const lesson = { xp: 20 } as Lesson;
  it('pays full XP plus a perfect bonus on first completion', () => {
    expect(lessonXp(lesson, 3, true, true)).toBe(25);
    expect(lessonXp(lesson, 2, true, true)).toBe(20);
  });
  it('pays reduced XP for replays', () => {
    expect(lessonXp(lesson, 2, true, false)).toBe(8);
    expect(lessonXp(lesson, 3, true, false)).toBe(10);
  });
  it('pays nothing for a failed attempt', () => {
    expect(lessonXp(lesson, 0, false, true)).toBe(0);
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
