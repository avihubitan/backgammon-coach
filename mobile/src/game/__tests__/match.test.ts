import { applyGameResult, matchWinner, newMatch, type GameResult } from '../index';

const win = (winner: 'player1' | 'player2', points: number): GameResult => ({
  winner,
  type: 'single',
  cubeValue: points,
  points,
  reason: 'bore-off',
});

describe('match scoring', () => {
  it('adds points to the winner', () => {
    const score = applyGameResult(newMatch(5), win('player1', 2));
    expect(score.player1).toBe(2);
    expect(score.player2).toBe(0);
    expect(score.gamesPlayed).toBe(1);
  });

  it('declares a winner once the match length is reached', () => {
    let score = newMatch(3);
    score = applyGameResult(score, win('player2', 2));
    expect(matchWinner(score)).toBeNull();
    score = applyGameResult(score, win('player2', 2));
    expect(matchWinner(score)).toBe('player2');
  });

  it('never ends an open-ended session', () => {
    expect(matchWinner(applyGameResult(newMatch(null), win('player1', 64)))).toBeNull();
  });

  it('makes the next game the Crawford game when someone reaches match point', () => {
    let score = applyGameResult(newMatch(5), win('player1', 4));
    expect(score.crawfordGame).toBe(true);
    // The game after the Crawford game is post-Crawford: doubling is allowed again.
    score = applyGameResult(score, win('player2', 1));
    expect(score.crawfordGame).toBe(false);
    score = applyGameResult(score, win('player2', 1));
    expect(score.crawfordGame).toBe(false);
  });

  it('has no Crawford game in a money session', () => {
    expect(applyGameResult(newMatch(null), win('player1', 4)).crawfordGame).toBe(false);
  });
});
