import type { UserMistake } from '@/features/practice/mistakes';

import { coachSummary, focusSkill, lastSevenDays, skillRows } from '../profileStats';

const mistake = (category: UserMistake['category'], solved = 0): UserMistake =>
  ({ id: `${category}-${Math.random()}`, category, solved, attempts: solved } as unknown as UserMistake);

describe('weekly XP', () => {
  it('lists the last seven days ending today, with weekday letters', () => {
    // 2026-10-02 is a Friday.
    const days = lastSevenDays({ '2026-10-02': 40, '2026-09-28': 15, '2026-09-20': 99 }, '2026-10-02');
    expect(days.map((day) => day.day)).toEqual([
      '2026-09-26',
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
    expect(days.map((day) => day.label).join('')).toBe('SSMTWTF');
    expect(days.map((day) => day.xp)).toEqual([0, 0, 15, 0, 0, 0, 40]);
    expect(days.filter((day) => day.today).map((day) => day.day)).toEqual(['2026-10-02']);
  });
});

describe('skills', () => {
  const rows = skillRows({
    board: { attempted: 10, firstTry: 9 },
    hitting: { attempted: 8, firstTry: 4 },
    racing: { attempted: 2, firstTry: 0 },
    cube: { attempted: 6, firstTry: 5 },
  });

  it('only shows skills with enough answers, in path order', () => {
    expect(rows.map((row) => row.id)).toEqual(['board', 'hitting', 'cube']);
    expect(rows[1].accuracy).toBeCloseTo(0.5);
  });

  it('suggests the weakest skill that is clearly below par', () => {
    expect(focusSkill(rows)?.id).toBe('hitting');
    expect(focusSkill(rows)?.drill).toBe('hitting');
    expect(focusSkill(skillRows({ board: { attempted: 10, firstTry: 10 } }))).toBeNull();
  });
});

describe('coach summary', () => {
  it('counts mistakes found and fixed, and the most common kind', () => {
    const summary = coachSummary([mistake('hitting', 2), mistake('hitting'), mistake('racing')]);
    expect(summary).toEqual({ found: 3, fixed: 1, common: 'hitting' });
  });

  it('names no weak spot when every kind came up once', () => {
    expect(coachSummary([mistake('hitting'), mistake('racing')]).common).toBeNull();
  });
});
