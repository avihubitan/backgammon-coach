import type { GameResult } from '@/game';

import { resultCopy } from '../resultCopy';

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
