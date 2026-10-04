import { createBoard, createGameFromPosition, gameReducer, type AiLevel, type BoardState, type GameState } from '@/game';

import { OPPONENTS } from '../opponents';
import {
  farewellMoment,
  linesFor,
  openingMoment,
  pickLine,
  REMATCH_WITHIN_MS,
  seedFrom,
  shouldSpeak,
  type Moment,
} from '../opponentLines';

const LEVELS: AiLevel[] = ['beginner', 'intermediate', 'advanced'];
const MOMENTS: Moment[] = [
  'greeting',
  'rematch',
  'youHit',
  'theyHit',
  'youWin',
  'youWinClose',
  'theyWin',
  'theyWinClose',
  'youGammon',
  'theyGammon',
];

/** The player bears off its last checker with a 1, against `opponent`'s position. */
function playerWins(opponent: Record<number, number>, opponentOff: number): GameState {
  const board: BoardState = { ...createBoard({ player1: { 1: 1 }, player2: opponent }), off: { player1: 14, player2: opponentOff } };
  const ready = createGameFromPosition(board, 'player1', { cubeEnabled: false });
  const rolled = gameReducer(ready, { type: 'roll', dice: [1, 2] });
  return gameReducer(rolled, { type: 'move', move: { from: 1, to: 'off', die: 1 } });
}

describe('opponents', () => {
  it('each level has a name, a face and something to say at every moment', () => {
    for (const level of LEVELS) {
      expect(OPPONENTS[level].name).toMatch(/^[A-Z][a-z]+$/);
      for (const moment of MOMENTS) {
        const lines = linesFor(level, moment);
        expect(lines.length).toBeGreaterThan(0);
        // Short enough to read at a glance next to a seat.
        for (const line of lines) expect(line.length).toBeLessThanOrEqual(44);
      }
    }
  });

  it('never rubs it in when the player loses', () => {
    for (const level of LEVELS) {
      for (const line of [...linesFor(level, 'theyWin'), ...linesFor(level, 'theyWinClose'), ...linesFor(level, 'theyGammon')]) {
        expect(line).toMatch(/good game/i);
        expect(line).not.toMatch(/\b(lose|lost|loser|bad|easy|too easy|weak)\b/i);
      }
    }
  });

  it('varies the line from game to game, deterministically', () => {
    const a = pickLine('beginner', 'greeting', seedFrom('game-a'));
    expect(pickLine('beginner', 'greeting', seedFrom('game-a'))).toBe(a);
    const all = new Set(['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].map((id) => pickLine('beginner', 'greeting', seedFrom(id))));
    expect(all.size).toBeGreaterThan(1);
  });

  it('never says the same line twice in a row', () => {
    for (const level of LEVELS) {
      for (const moment of MOMENTS) {
        for (let seed = 0; seed < 6; seed++) {
          const first = pickLine(level, moment, seed);
          expect(pickLine(level, moment, seed, first)).not.toBe(first);
        }
      }
    }
  });

  it('speaks at the start and the end always, otherwise only after a quiet spell', () => {
    expect(shouldSpeak('greeting', 0, null)).toBe(true);
    expect(shouldSpeak('rematch', 0, null)).toBe(true);
    expect(shouldSpeak('theyWin', 30, 29)).toBe(true);
    expect(shouldSpeak('youHit', 5, null)).toBe(true);
    expect(shouldSpeak('youHit', 8, 4)).toBe(false);
    expect(shouldSpeak('youHit', 9, 4)).toBe(true);
  });
});

describe('the right words for the moment', () => {
  it('calls a finish close only when the loser had three checkers or fewer left', () => {
    expect(farewellMoment(playerWins({ 24: 3 }, 12))).toBe('youWinClose');
    expect(farewellMoment(playerWins({ 24: 4 }, 11))).toBe('youWin');
    expect(farewellMoment(playerWins({ 24: 15 }, 0))).toBe('youGammon');
  });

  it('says nothing about an unfinished game', () => {
    expect(farewellMoment(createGameFromPosition(createBoard({ player1: { 1: 15 }, player2: { 24: 15 } }), 'player1'))).toBeNull();
  });

  it('says "again?" instead of hello straight after a game against the same opponent', () => {
    const now = Date.parse('2026-10-04T12:00:00Z');
    const justNow = new Date(now - 60_000).toISOString();
    expect(openingMoment('beginner', { level: 'beginner', finishedAt: justNow }, now)).toBe('rematch');
    expect(openingMoment('advanced', { level: 'beginner', finishedAt: justNow }, now)).toBe('greeting');
    expect(openingMoment('beginner', { level: 'beginner', finishedAt: new Date(now - REMATCH_WITHIN_MS - 1).toISOString() }, now)).toBe('greeting');
    expect(openingMoment('beginner', undefined, now)).toBe('greeting');
  });
});
