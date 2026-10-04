import type { GameResult, GameReview } from '@/game';

import { resultCopy, resultTypeLabel, reviewTeaser } from '../resultCopy';

const result = (winner: 'player1' | 'player2', reason: GameResult['reason'] = 'bore-off'): GameResult =>
  ({ winner, type: 'single', cubeValue: 1, points: 1, reason }) as GameResult;

const copy = (r: GameResult, extra: Partial<Parameters<typeof resultCopy>[0]> = {}) =>
  resultCopy({ result: r, opponentName: 'Leyla', isMatch: false, matchOver: true, matchWon: false, canReview: true, ...extra });

describe('the result sheet’s words', () => {
  it('celebrates a win and keeps Play again first', () => {
    expect(copy(result('player1'))).toEqual({ title: 'You won!', line: 'You bore off all your checkers first.', reviewFirst: false });
  });

  it('turns a loss into "Good game" and points to the review', () => {
    const loss = copy(result('player2'));
    expect(loss.title).toBe('Good game');
    expect(loss.line).toBe('Leyla bore off first. Let’s see what you can improve.');
    expect(loss.reviewFirst).toBe(true);
    expect(`${loss.title} ${loss.line}`).not.toMatch(/you lost/i);
  });

  it('says how it ended, and only points to a review that exists', () => {
    expect(copy(result('player1', 'dropped-double')).line).toBe('Leyla dropped your double.');
    expect(copy(result('player2', 'resigned'), { canReview: false })).toEqual({
      title: 'Good game',
      line: 'You resigned this game.',
      reviewFirst: false,
    });
  });

  it('speaks of the match when a match ends', () => {
    expect(copy(result('player2'), { isMatch: true, matchOver: true, matchWon: false }).title).toBe('Good match');
    expect(copy(result('player1'), { isMatch: true, matchOver: true, matchWon: true }).title).toBe('Match won!');
  });
});

describe('the details under the title', () => {
  const gammon = (winner: 'player1' | 'player2') => ({ winner, type: 'gammon', cubeValue: 1, points: 2, reason: 'bore-off' }) as GameResult;

  it('cheers a gammon the player won, and only that one', () => {
    expect(resultTypeLabel(gammon('player1'))).toBe('Gammon!');
    expect(resultTypeLabel(gammon('player2'))).toBe('Gammon');
    expect(resultTypeLabel(result('player2'))).toBe('Single game');
  });

  const review = (counts: { mistakes?: number; blunders?: number; inaccuracies?: number }, wrongCube = 0): GameReview =>
    ({
      moves: [],
      cube: Array.from({ length: wrongCube }, () => ({ correct: false })),
      summary: { mistakes: 0, blunders: 0, inaccuracies: 0, ...counts },
    }) as unknown as GameReview;

  it('gives a reason to open the review, or says the dice decided', () => {
    expect(reviewTeaser(undefined)).toBeNull();
    expect(reviewTeaser(review({ mistakes: 1, blunders: 1 }))).toBe('Your coach found 2 moves to look at.');
    expect(reviewTeaser(review({}, 1))).toBe('Your coach found 1 move to look at.');
    // Many mistakes: one lesson to start with, not a discouraging count.
    expect(reviewTeaser(review({ mistakes: 9, blunders: 5 }))).toBe('Your coach has this game’s biggest lesson ready.');
    expect(reviewTeaser(review({ inaccuracies: 3 }))).toBe('No big mistakes, just a few small ones to look at.');
    expect(reviewTeaser(review({}))).toBe('No real mistakes: the dice won this one.');
  });
});
