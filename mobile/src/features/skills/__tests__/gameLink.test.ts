import { emptyLessonRecord, type LessonRecords } from '@/features/learning/progression';
import type { UserMistake } from '@/features/practice/mistakes';
import { REVIEW_HEADLINES, type GameReview, type MoveReview } from '@/game';

import { gameLesson, gameLessonText, practisedIn, practisedLine, reviewFocus } from '../gameLink';

const done = (...ids: string[]): LessonRecords =>
  Object.fromEntries(ids.map((id) => [id, { ...emptyLessonRecord(), completed: true }]));

const move = (index: number, severity: MoveReview['severity'], headline: string, category: MoveReview['category'] = 'risk') =>
  ({ index, severity, headline, category }) as MoveReview;

const review = (moves: MoveReview[], cube: { index: number; correct: boolean }[] = []) =>
  ({ moves, cube, summary: {} }) as unknown as GameReview;

const saved = (id: string, headline: string, createdAt: string, category: UserMistake['category'] = 'risk') =>
  ({ id, gameId: id.split(':')[0], headline, category, createdAt }) as UserMistake;

const unsafe = REVIEW_HEADLINES.safer;
const missedHit = REVIEW_HEADLINES.missedHit;

describe('the lesson behind a skill', () => {
  it('is the latest finished lesson that teaches it, else one that also trains it', () => {
    expect(practisedIn('safety', {})).toBeNull();
    expect(practisedIn('safety', done('points-2'))?.id).toBe('points-2');
    // Main skill beats "also trains", even when the other lesson came later.
    expect(practisedIn('safety', done('points-2', 'middle-3'))?.id).toBe('points-2');
    expect(practisedIn('escaping', done('position-2'))?.id).toBe('position-2');
    expect(practisedIn('hitting', done('hitting-1', 'hitting-2'))?.id).toBe('hitting-2');
  });

  it('gives Coach Watch its line', () => {
    expect(practisedLine('safety', done('points-2'))).toBe('You practised this in “Safe or Risky?”.');
    expect(practisedLine('cube', done('points-2'))).toBeNull();
  });
});

describe('after a game', () => {
  const today = '2026-10-04';
  const now = '2026-10-04T15:00:00';

  it('names the studied idea behind most mistakes, and the first position to practise', () => {
    const game = review([
      move(1, 'best', ''),
      move(3, 'mistake', missedHit, 'hitting'),
      move(5, 'blunder', unsafe),
      move(7, 'inaccuracy', unsafe),
      move(9, 'mistake', unsafe),
    ]);
    const note = gameLesson('g1', game, done('hitting-2', 'points-2'), [], today);
    expect(note).toMatchObject({ skill: 'safety', inGame: 2, today: 2, mistakeId: 'g1:5' });
    expect(note?.lesson.id).toBe('points-2');
    expect(gameLessonText(note!)).toBe('You practised playing safe in “Safe or Risky?”. It tripped you up twice this game.');
  });

  it('skips ideas the learner has not studied yet', () => {
    const game = review([move(2, 'mistake', unsafe), move(4, 'blunder', unsafe), move(6, 'mistake', missedHit, 'hitting')]);
    expect(gameLesson('g1', game, done('hitting-2'), [], today)).toMatchObject({ skill: 'hitting', mistakeId: 'g1:6' });
    expect(gameLesson('g1', game, {}, [], today)).toBeNull();
    expect(gameLesson('g1', review([move(1, 'inaccuracy', unsafe)]), done('points-2'), [], today)).toBeNull();
  });

  it('counts the same idea across today’s games', () => {
    const game = review([move(4, 'mistake', unsafe)]);
    const mistakes = [
      saved('g0:2', unsafe, now),
      saved('g0:8', unsafe, now),
      saved('g1:4', unsafe, now),
      saved('old:2', unsafe, '2026-09-30T10:00:00'),
      saved('g0:9', missedHit, now, 'hitting'),
    ];
    const note = gameLesson('g1', game, done('points-2'), mistakes, today)!;
    expect(note).toMatchObject({ inGame: 1, today: 3 });
    expect(gameLessonText(note)).toBe('You practised playing safe in “Safe or Risky?”. It tripped you up 3 times today.');
    expect(gameLessonText({ ...note, today: 1 })).toContain('It tripped you up once this game.');
  });

  it('counts games played today, not games reviewed today', () => {
    const game = review([move(4, 'mistake', unsafe)]);
    // An old game reviewed this morning: its mistakes were saved today, but it was played last week.
    const mistakes = [saved('old:2', unsafe, now), saved('old:5', unsafe, now), saved('g1:4', unsafe, now)];
    expect(gameLesson('g1', game, done('points-2'), mistakes, today)?.today).toBe(3);
    expect(gameLesson('g1', game, done('points-2'), mistakes, today, new Set(['g1']))?.today).toBe(1);
  });

  it('finds the area to improve, counting wrong cube decisions', () => {
    expect(reviewFocus(review([move(1, 'best', '')]))).toBeNull();
    expect(reviewFocus(review([move(1, 'mistake', missedHit, 'hitting')]))).toBe('hitting');
    expect(reviewFocus(review([move(1, 'mistake', missedHit, 'hitting')], [{ index: 2, correct: false }, { index: 4, correct: false }]))).toBe(
      'cube',
    );
  });
});
