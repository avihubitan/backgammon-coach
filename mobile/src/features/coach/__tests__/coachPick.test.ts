import { emptyLessonRecord } from '@/features/learning/progression';
import type { UserMistake } from '@/features/practice/mistakes';

import { coachPick, type CoachInput } from '../coachPick';

const mistake = (category: UserMistake['category'], solved = 0) =>
  ({ id: `${category}-${Math.random()}`, category, solved, attempts: solved, severity: 0.1 }) as unknown as UserMistake;
const done = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, { ...emptyLessonRecord(), completed: true }]));

const input = (patch: Partial<CoachInput> = {}): CoachInput => ({
  mistakes: [],
  byCategory: {},
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
      coachPick(input({ mistakes: [mistake('hitting'), mistake('hitting')], byCategory: { board: { attempted: 10, firstTry: 10 } } })),
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
        byCategory: { board: { attempted: 20, firstTry: 19 }, hitting: { attempted: 10, firstTry: 5 } },
        unlockedDrills: ['hitting'],
      }),
    );
    expect(pick).toMatchObject({ topic: 'Hitting', action: { kind: 'drill', drill: 'hitting' } });
    expect(pick?.reason).toContain('50%');
  });
});
