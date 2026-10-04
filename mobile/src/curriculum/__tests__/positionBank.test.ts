import { skillOfMistake } from '@/features/skills/extract';
import {
  createBoard,
  explainDifference,
  findPlayByNotation,
  installNetwork,
  loadDefaultNetwork,
  rankByEquity,
  validateBoard,
  type DiceRoll,
} from '@/game';

import { isSkillId } from '../skills';
import { POSITION_BANK, type BankPosition } from '../positionBank';

/**
 * The position bank is generated from the network; this keeps it honest: every
 * "best" move is the network's choice, every alternative clearly loses, and
 * each position is about the skill it's filed under.
 */
const net = loadDefaultNetwork();
beforeAll(() => installNetwork(net));
afterAll(() => installNetwork(null));

describe('position bank', () => {
  it('has unique ids and a few positions for each skill it covers', () => {
    expect(new Set(POSITION_BANK.map((entry) => entry.id)).size).toBe(POSITION_BANK.length);
    const counts = new Map<string, number>();
    for (const entry of POSITION_BANK) counts.set(entry.skill, (counts.get(entry.skill) ?? 0) + 1);
    for (const count of counts.values()) expect(count).toBeGreaterThanOrEqual(8);
  });

  it.each(POSITION_BANK.map((entry) => [entry.id, entry] as [string, BankPosition]))('%s holds up', (_id, entry) => {
    expect(isSkillId(entry.skill)).toBe(true);
    const board = createBoard(entry.position);
    expect(validateBoard(board)).toEqual([]);
    const dice = entry.dice as DiceRoll;
    const best = findPlayByNotation(board, 'player1', dice, entry.best);
    expect(best).not.toBeNull();
    const ranked = rankByEquity(board, 'player1', dice);
    const equityOf = (key: string) => ranked.find((candidate) => candidate.play.key === key)!.equity;
    expect(ranked[0].equity - equityOf(best!.key)).toBeLessThan(0.005);
    expect(new Set([entry.best, ...entry.others]).size).toBe(entry.others.length + 1);
    for (const other of entry.others) {
      const play = findPlayByNotation(board, 'player1', dice, other);
      expect(play).not.toBeNull();
      expect(equityOf(best!.key) - equityOf(play!.key)).toBeGreaterThanOrEqual(0.045);
    }
    const first = findPlayByNotation(board, 'player1', dice, entry.others[0])!;
    expect(skillOfMistake(explainDifference(board, 'player1', first.moves, best!.moves, false))).toBe(entry.skill);
  });
});
