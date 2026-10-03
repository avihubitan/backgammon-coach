import { initialBoard } from '@/game';

import { MASTERED_AFTER, pickForPractice, withFocus, type UserMistake } from '../mistakes';

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
    expect(pickForPractice(all, 5).map((pick) => pick.id)).toEqual(['g2:7', 'g1:4', 'g1:9']);
  });

  it('puts the position chosen in a review first, without repeating it', () => {
    const picks = pickForPractice(all, 3);
    expect(withFocus(picks, all, 'g1:9', 3).map((pick) => pick.id)).toEqual(['g1:9', 'g2:7', 'g1:4']);
    // Even a mastered one, when asked for.
    expect(withFocus(picks, all, 'g2:2', 2).map((pick) => pick.id)).toEqual(['g2:2', 'g2:7']);
  });

  it('ignores a position that is no longer saved', () => {
    const picks = pickForPractice(all, 3);
    expect(withFocus(picks, all, 'gone:1', 3)).toBe(picks);
    expect(withFocus(picks, all, undefined, 3)).toBe(picks);
  });
});
