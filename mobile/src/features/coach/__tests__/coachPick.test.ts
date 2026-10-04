import { emptyLessonRecord } from '@/features/learning/progression';
import { emptySkillStats } from '@/features/learning/progressModel';
import type { UserMistake } from '@/features/practice/mistakes';

import { coachPick, coachPicks, coachPlan, RECENT_DAYS, type CoachInput } from '../coachPick';

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

  it('never points at a lesson the player cannot open or has not reached', () => {
    const mistakes = [mistake('cube'), mistake('cube'), mistake('cube')];
    expect(coachPick(input({ mistakes }))).toBeNull();
    expect(coachPick(input({ mistakes, lessons: done('cube-1'), canAccessLesson: () => false }))).toBeNull();
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
