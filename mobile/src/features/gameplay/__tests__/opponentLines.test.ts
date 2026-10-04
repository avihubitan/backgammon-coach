import type { AiLevel } from '@/game';

import { OPPONENTS } from '../opponents';
import { linesFor, pickLine, seedFrom, shouldSpeak, type Moment } from '../opponentLines';

const LEVELS: AiLevel[] = ['beginner', 'intermediate', 'advanced'];
const MOMENTS: Moment[] = ['greeting', 'youHit', 'theyHit', 'youDoubles', 'theyDoubles', 'youWin', 'theyWin', 'youGammon', 'theyGammon'];

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
      for (const line of [...linesFor(level, 'theyWin'), ...linesFor(level, 'theyGammon')]) {
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

  it('speaks at the start and the end always, otherwise only after a quiet spell', () => {
    expect(shouldSpeak('greeting', 0, null)).toBe(true);
    expect(shouldSpeak('theyWin', 30, 29)).toBe(true);
    expect(shouldSpeak('youHit', 5, null)).toBe(true);
    expect(shouldSpeak('youHit', 8, 4)).toBe(false);
    expect(shouldSpeak('youHit', 9, 4)).toBe(true);
    expect(shouldSpeak('theyDoubles', 10, 4)).toBe(false);
    expect(shouldSpeak('theyDoubles', 12, 4)).toBe(true);
  });
});
