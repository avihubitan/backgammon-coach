import { allLessons } from '@/curriculum';
import type { DrillCategory } from '@/curriculum/drills';
import { emptyLessonRecord } from '@/features/learning/progression';
import { emptySkillStats } from '@/features/learning/progressModel';
import { lessonMinutes } from '@/features/learning/timeEstimates';
import type { UserMistake } from '@/features/practice/mistakes';
import { REVIEW_HEADLINES } from '@/game';

import { coachPick, coachPicks, coachPlan, focusDrill, MORE_PICKS, RECENT_DAYS, type CoachInput } from '../coachPick';

const mistake = (category: UserMistake['category'], solved = 0) =>
  ({ id: `${category}-${Math.random()}`, category, solved, attempts: solved, severity: 0.1 }) as unknown as UserMistake;
const stats = (attempted: number, firstTry: number) => ({ ...emptySkillStats(), attempted, firstTry });
const done = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, { ...emptyLessonRecord(), completed: true }]));

const input = (patch: Partial<CoachInput> = {}): CoachInput => ({
  mistakes: [],
  bySkill: {},
  lessons: {},
  unlockedDrills: [],
  canPracticeMistakes: false,
  canAccessLesson: () => true,
  ...patch,
});

describe("coach's pick", () => {
  it('stays quiet until there is real evidence', () => {
    expect(coachPick(input())).toBeNull();
    // Two hitting mistakes are not yet a pattern; a strong lesson record needs no help.
    expect(
      coachPick(input({ mistakes: [mistake('hitting'), mistake('hitting')], bySkill: { board: stats(10, 10) } })),
    ).toBeNull();
  });

  it('spots a pattern in your games and sends you to the matching drill', () => {
    const pick = coachPick(
      input({
        mistakes: [mistake('hitting'), mistake('hitting'), mistake('hitting'), mistake('racing')],
        unlockedDrills: ['hitting', 'race'],
      }),
    );
    expect(pick).toMatchObject({ topic: 'Hitting', action: { kind: 'drill', drill: 'hitting' }, premium: false });
    expect(pick?.reason).toContain('3 of the moves');
  });

  it('ignores mistakes you already fixed', () => {
    const pick = coachPick(
      input({ mistakes: [mistake('hitting', 2), mistake('hitting', 2), mistake('hitting')], unlockedDrills: ['hitting'] }),
    );
    expect(pick).toBeNull();
  });

  it('lets Premium players practise the actual positions', () => {
    const pick = coachPick(
      input({ mistakes: [mistake('running'), mistake('running'), mistake('running')], canPracticeMistakes: true }),
    );
    expect(pick).toMatchObject({ action: { kind: 'mistakes' }, premium: true });
  });

  it('falls back to a lesson replay when the drill is still locked', () => {
    const pick = coachPick(
      input({
        mistakes: [mistake('positioning'), mistake('positioning'), mistake('positioning')],
        lessons: done('points-1'),
      }),
    );
    expect(pick?.action).toEqual({ kind: 'lesson', lessonId: 'points-1' });
  });

  it('never points at a lesson the player cannot open or has not reached: one of their own positions instead', () => {
    const mistakes = [mistake('cube'), mistake('cube'), mistake('cube')];
    const own = { kind: 'position', position: `mistake:${mistakes[0].id}`, skill: 'cube' };
    expect(coachPick(input({ mistakes }))).toMatchObject({ action: own, actionLabel: 'Practise one of them', premium: false, minutes: 1 });
    expect(coachPick(input({ mistakes, lessons: done('cube-1'), canAccessLesson: () => false }))?.action).toEqual(own);
    expect(coachPick(input({ mistakes, lessons: done('cube-1') }))?.action).toEqual({ kind: 'lesson', lessonId: 'cube-1' });
  });

  it('otherwise picks your weakest lesson skill', () => {
    const pick = coachPick(
      input({
        bySkill: { board: stats(20, 19), hitting: stats(10, 5) },
        unlockedDrills: ['hitting'],
      }),
    );
    expect(pick).toMatchObject({ topic: 'Hitting', action: { kind: 'drill', drill: 'hitting' } });
    expect(pick?.reason).toContain('50%');
  });
});

describe("coach's pick over time", () => {
  const dated = (category: UserMistake['category'], createdAt: string) =>
    ({ ...mistake(category), createdAt }) as UserMistake;
  const today = '2026-03-30';

  it('puts patterns from recent games ahead of old ones', () => {
    const old = Array.from({ length: 5 }, () => dated('racing', '2026-01-02T10:00:00.000Z'));
    const recent = Array.from({ length: 3 }, () => dated('hitting', '2026-03-25T10:00:00.000Z'));
    const pick = coachPick(input({ mistakes: [...old, ...recent], unlockedDrills: ['hitting', 'race'], today }));
    expect(pick).toMatchObject({ topic: 'Hitting' });
    expect(pick?.reason).toContain('your recent games');
    expect(RECENT_DAYS).toBeGreaterThan(7);
  });

  it('still uses older games when nothing recent stands out', () => {
    const old = Array.from({ length: 3 }, () => dated('racing', '2026-01-02T10:00:00.000Z'));
    const pick = coachPick(input({ mistakes: old, unlockedDrills: ['race'], today }));
    expect(pick).toMatchObject({ topic: 'Racing' });
    expect(pick?.reason).toContain('your games');
  });

  it('ranks several things to work on, one per topic', () => {
    const picks = coachPicks(
      input({
        mistakes: [mistake('hitting'), mistake('hitting'), mistake('hitting')],
        bySkill: { hitting: stats(10, 4), openings: stats(10, 6) },
        unlockedDrills: ['hitting', 'opening'],
      }),
    );
    expect(picks.map((pick) => pick.topic)).toEqual(['Hitting', 'Openings']);
  });

  it('marks today’s pick done once practised, and offers the next one', () => {
    const base = input({
      mistakes: [mistake('hitting'), mistake('hitting'), mistake('hitting')],
      bySkill: { openings: stats(10, 5) },
      unlockedDrills: ['hitting', 'opening'],
      today,
    });
    expect(coachPlan(base)).toMatchObject({ done: false, next: null, pick: { topic: 'Hitting' } });
    const practised = coachPlan({ ...base, practiced: { hitting: { lastPlayedAt: '2026-03-30T08:00:00' } } });
    expect(practised).toMatchObject({ done: true, pick: { topic: 'Hitting' }, next: { topic: 'Openings' } });
    // Yesterday's practice doesn't count for today.
    expect(coachPlan({ ...base, practiced: { hitting: { lastPlayedAt: '2026-03-29T08:00:00' } } })?.done).toBe(false);
  });
});

describe("coach's pick: more ways to help", () => {
  const today = '2026-10-04';
  const due = (id: string, dueDay = today) =>
    ({
      id,
      category: 'risk',
      headline: REVIEW_HEADLINES.safer,
      createdAt: `${today}T09:00:00`,
      solved: 0,
      attempts: 0,
      severity: 0.1,
      streak: 0,
      dueDay,
    }) as unknown as UserMistake;
  const three = () => ['a', 'b', 'c'].map((id) => due(id));

  it('puts due positions from your games first for Premium, with a time estimate', () => {
    const pick = coachPick(input({ mistakes: [due('a'), due('b')], canPracticeMistakes: true, today }));
    expect(pick).toMatchObject({ trigger: 'review', title: 'Time for your review.', action: { kind: 'mistakes' }, premium: true });
    expect(pick?.reason).toContain('2 positions you got wrong');
    expect(pick?.minutes).toBeGreaterThanOrEqual(1);
    // Free players get their due positions one a day, in Position of the Day.
    expect(coachPick(input({ mistakes: [due('a')], today }))).toBeNull();
    // Nothing due yet: nothing to review.
    expect(coachPick(input({ mistakes: [due('a', '2026-10-09')], canPracticeMistakes: true, today }))).toBeNull();
  });

  it('keeps the pattern as a drill when the review already covers the positions', () => {
    const picks = coachPicks(input({ mistakes: three(), canPracticeMistakes: true, unlockedDrills: ['safety'], today }));
    expect(picks.map((pick) => pick.trigger)).toEqual(['review', 'pattern']);
    expect(picks[1]).toMatchObject({ topic: 'Playing safe', action: { kind: 'drill', drill: 'safety' }, premium: false });
  });

  it('suggests a drill that just opened, while the lesson is fresh', () => {
    const lessons = { 'points-3': { ...emptyLessonRecord(), completed: true, firstCompletedAt: '2026-10-03' } };
    const pick = coachPick(input({ lessons, unlockedDrills: ['primes'], today }));
    expect(pick).toMatchObject({ trigger: 'new-drill', title: 'New drill: “Walls & primes”.', action: { kind: 'drill', drill: 'primes' } });
    expect(pick?.reason).toBe('It opened when you finished “Walls & Primes” yesterday. A few quick positions now help it stick.');
    // Tried already, or opened too long ago: not new any more.
    const tried = { primes: { lastPlayedAt: '2026-10-03T10:00:00' } };
    expect(coachPick(input({ lessons, unlockedDrills: ['primes'], today, practiced: tried }))).toBeNull();
    expect(coachPick(input({ lessons, unlockedDrills: ['primes'], today: '2026-10-09' }))).toBeNull();
  });

  it('spots a skill slipping in the latest answers, even with a good record overall', () => {
    const bySkill = { shots: { ...emptySkillStats(), attempted: 30, firstTry: 26, recent: '11000100' } };
    const pick = coachPick(input({ bySkill, unlockedDrills: ['shots'] }));
    expect(pick).toMatchObject({ trigger: 'slipping', topic: 'Counting shots', action: { kind: 'drill', drill: 'shots' } });
    expect(pick?.reason).toBe('Only 3 of your last 8 answers about counting shots were right on the first try.');
    // Too few answers to tell.
    expect(coachPick(input({ bySkill: { shots: { ...bySkill.shots, recent: '00' } }, unlockedDrills: ['shots'] }))).toBeNull();
  });

  it('brings back a skill you have not practised in a while', () => {
    const primes = { ...emptySkillStats(), attempted: 12, firstTry: 11, recent: '111111111110', days: 3, lastDay: '2026-09-20' };
    const pick = coachPick(input({ bySkill: { primes }, unlockedDrills: ['primes'], today }));
    expect(pick).toMatchObject({ trigger: 'fading', title: 'A refresher: building walls.' });
    expect(pick?.reason).toBe('It’s been 14 days since you practised building walls. A quick round keeps it sharp.');
    // The fundamentals come up in every game, and one day of practice isn't a habit to keep up.
    expect(coachPick(input({ bySkill: { board: primes }, unlockedDrills: ['board'], today }))).toBeNull();
    expect(coachPick(input({ bySkill: { primes: { ...primes, days: 1 } }, unlockedDrills: ['primes'], today }))).toBeNull();
    expect(coachPick(input({ bySkill: { primes: { ...primes, lastDay: '2026-09-30' } }, unlockedDrills: ['primes'], today }))).toBeNull();
  });

  it('lists a couple more things worth doing, each with a time', () => {
    const plan = coachPlan(
      input({
        mistakes: three(),
        bySkill: { hitting: stats(10, 4), openings: stats(10, 6), points: stats(10, 7) },
        unlockedDrills: ['safety', 'hitting', 'opening', 'points'],
        today,
      }),
    )!;
    expect(plan.pick.topic).toBe('Playing safe');
    expect(plan.more.map((pick) => pick.topic)).toEqual(['Hitting', 'Openings']);
    expect(plan.more).toHaveLength(MORE_PICKS);
    for (const pick of [plan.pick, ...plan.more]) expect(pick.minutes).toBeGreaterThan(0);
  });

  it('gives a beginner one of their own positions for a weakness no lesson has covered yet', () => {
    const mistakes = [due('a', '2026-10-06'), due('b'), due('c', '2026-10-05')];
    const pick = coachPick(input({ mistakes, lessons: done('board-1', 'board-2'), unlockedDrills: ['board'], today }));
    // The one due today comes first.
    expect(pick).toMatchObject({ topic: 'Playing safe', trigger: 'pattern', action: { kind: 'position', position: 'mistake:b', skill: 'safety' } });
    // Not the one Position of the Day already shows.
    const base = { lessons: done('board-1', 'board-2'), unlockedDrills: ['board'] as DrillCategory[], today };
    expect(coachPick(input({ ...base, mistakes, dailyPosition: 'mistake:b' }))?.action).toMatchObject({ position: 'mistake:c' });
    // Done once a position about the same idea has been practised today, wherever it was opened.
    expect(coachPlan(input({ ...base, mistakes }))?.done).toBe(false);
    const practised = mistakes.map((mistake) => (mistake.id === 'b' ? { ...mistake, lastPracticedAt: '2026-10-04T12:00:00', dueDay: '2026-10-05' } : mistake));
    expect(coachPlan(input({ ...base, mistakes: practised }))).toMatchObject({ done: true, pick: { topic: 'Playing safe' } });
    // Yesterday's practice doesn't count.
    const yesterday = mistakes.map((mistake) => (mistake.id === 'b' ? { ...mistake, lastPracticedAt: '2026-10-03T12:00:00' } : mistake));
    expect(coachPlan(input({ ...base, mistakes: yesterday }))?.done).toBe(false);
  });

  it('names the drill the daily challenge should lean on', () => {
    expect(focusDrill(input())).toBeNull();
    expect(focusDrill(input({ bySkill: { hitting: stats(10, 4) }, unlockedDrills: ['hitting'] }))).toBe('hitting');
    // The review comes first for Premium, but the challenge goes with the first drill.
    expect(focusDrill(input({ mistakes: three(), canPracticeMistakes: true, unlockedDrills: ['safety'], today }))).toBe('safety');
  });

  it('estimates every lesson at a few minutes', () => {
    for (const lesson of allLessons) {
      expect(lessonMinutes(lesson)).toBeGreaterThanOrEqual(1);
      expect(lessonMinutes(lesson)).toBeLessThanOrEqual(6);
    }
  });
});
