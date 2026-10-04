import { initialBoard } from '@/game';

import {
  dueIn,
  dueMistakes,
  isMastered,
  MASTERED_AFTER,
  mistakesFromReview,
  nextDueDay,
  pickForPractice,
  recordAttempt,
  sanitizeMistake,
  streakOf,
  withFocus,
  type UserMistake,
} from '../mistakes';

const TODAY = '2026-03-12';

const mistake = (id: string, overrides: Partial<UserMistake> = {}): UserMistake => ({
  id,
  gameId: id.split(':')[0],
  createdAt: '2026-03-10T10:00:00.000Z',
  position: initialBoard(),
  dice: [3, 1],
  selectedMove: [],
  recommendedMove: [],
  category: 'positioning',
  severity: 0.2,
  headline: 'You could make a point',
  explanation: '…',
  attempts: 0,
  solved: 0,
  lastPracticedAt: null,
  ...overrides,
});

describe('choosing positions to practise', () => {
  const all = [
    mistake('g1:4', { severity: 0.3 }),
    mistake('g1:9', { lastPracticedAt: '2026-03-11T10:00:00.000Z' }),
    mistake('g2:2', { solved: MASTERED_AFTER }),
    mistake('g2:7', { severity: 0.5 }),
  ];

  it('skips mastered positions and starts with the least recently practised, most costly ones', () => {
    expect(pickForPractice(all, 5, TODAY).map((pick) => pick.id)).toEqual(['g2:7', 'g1:4', 'g1:9']);
  });

  it('puts the position chosen in a review first, without repeating it', () => {
    const picks = pickForPractice(all, 3, TODAY);
    expect(withFocus(picks, all, 'g1:9', 3).map((pick) => pick.id)).toEqual(['g1:9', 'g2:7', 'g1:4']);
    // Even a mastered one, when asked for.
    expect(withFocus(picks, all, 'g2:2', 2).map((pick) => pick.id)).toEqual(['g2:2', 'g2:7']);
  });

  it('ignores a position that is no longer saved', () => {
    const picks = pickForPractice(all, 3, TODAY);
    expect(withFocus(picks, all, 'gone:1', 3)).toBe(picks);
    expect(withFocus(picks, all, undefined, 3)).toBe(picks);
  });
});

describe('spaced repetition', () => {
  /** Local noon on a day, so the day never shifts with the time zone. */
  const at = (day: string) => `${day}T12:00:00`;
  const fresh = (): UserMistake => mistake('g9:3', { createdAt: at('2026-03-12'), streak: 0, wrong: 0, dueDay: '2026-03-12', lastCorrectDay: null });

  it('brings a new mistake from a game back the same day', () => {
    const review = {
      moves: [{ index: 3, severity: 'mistake', boardBefore: initialBoard(), roll: [3, 1], played: [], best: [], category: 'hitting', loss: 0.2, headline: 'You missed a hit', explanation: '…' }],
    } as unknown as Parameters<typeof mistakesFromReview>[1];
    const [made] = mistakesFromReview('g9', review, at('2026-03-12'));
    expect(made).toMatchObject({ streak: 0, wrong: 0, dueDay: '2026-03-12' });
    expect(dueMistakes([made], '2026-03-12')).toHaveLength(1);
  });

  it('spaces it further out after each right answer on a new day', () => {
    let current = recordAttempt(fresh(), true, at('2026-03-12'));
    expect(current).toMatchObject({ streak: 1, dueDay: '2026-03-13', lastCorrectDay: '2026-03-12', solved: 1 });
    current = recordAttempt(current, true, at('2026-03-13'));
    expect(current).toMatchObject({ streak: 2, dueDay: '2026-03-16' });
    expect(isMastered(current)).toBe(false);
    current = recordAttempt(current, true, at('2026-03-16'));
    expect(current).toMatchObject({ streak: 3, dueDay: '2026-03-23' });
    expect(isMastered(current)).toBe(true);
  });

  it('counts one right answer per day, however often it is practised', () => {
    const once = recordAttempt(fresh(), true, at('2026-03-12'));
    const twice = recordAttempt(once, true, `2026-03-12T18:00:00`);
    expect(twice).toMatchObject({ streak: 1, dueDay: '2026-03-13', attempts: 2 });
  });

  it('brings it back tomorrow after a wrong answer, and starts the run again', () => {
    const learned = recordAttempt(recordAttempt(fresh(), true, at('2026-03-12')), true, at('2026-03-13'));
    const missed = recordAttempt(learned, false, at('2026-03-16'));
    expect(missed).toMatchObject({ streak: 0, wrong: 1, dueDay: '2026-03-17' });
    expect(dueMistakes([missed], '2026-03-16')).toHaveLength(0);
    expect(dueMistakes([missed], '2026-03-17')).toHaveLength(1);
  });

  it('keeps mistakes mastered under the old rule mastered', () => {
    const old = mistake('g1:1', { solved: MASTERED_AFTER });
    expect(streakOf(old)).toBeGreaterThanOrEqual(3);
    expect(isMastered(old)).toBe(true);
    expect(isMastered(mistake('g1:2', { solved: 1 }))).toBe(false);
  });

  it('picks the due ones first (most overdue, then most costly), then the soonest coming up', () => {
    const all = [
      mistake('a:1', { dueDay: '2026-03-14', severity: 0.9 }),
      mistake('b:1', { dueDay: '2026-03-10', severity: 0.1 }),
      mistake('c:1', { dueDay: '2026-03-12', severity: 0.5 }),
      mistake('d:1', { dueDay: '2026-03-12', severity: 0.7 }),
      mistake('e:1', { dueDay: '2026-03-13', severity: 0.2 }),
      mistake('f:1', { streak: 3, dueDay: '2026-03-01' }),
    ];
    expect(pickForPractice(all, 4, TODAY).map((pick) => pick.id)).toEqual(['b:1', 'd:1', 'c:1', 'e:1']);
    expect(dueMistakes(all, TODAY).map((pick) => pick.id)).toEqual(['b:1', 'd:1', 'c:1']);
    expect(nextDueDay(all, TODAY)).toBe('2026-03-13');
    expect(dueIn('2026-03-13', TODAY)).toBe('tomorrow');
    expect(dueIn('2026-03-16', TODAY)).toBe('in 4 days');
  });

  it('repairs malformed schedule fields from a damaged save', () => {
    const damaged = { ...fresh(), streak: 'x', dueDay: 'soon', wrong: null, lastCorrectDay: 5 } as unknown as UserMistake;
    const clean = sanitizeMistake(damaged);
    expect(clean.streak).toBeUndefined();
    expect(clean.dueDay).toBeUndefined();
    expect(clean.wrong).toBeUndefined();
    expect(clean.lastCorrectDay).toBeUndefined();
    expect(dueMistakes([clean], '2026-03-12')).toHaveLength(1);
  });
});
