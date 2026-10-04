import type { ChoiceStep, ExplainStep } from '@/curriculum';
import { POSITION_BANK } from '@/curriculum/positionBank';
import { emptyLessonRecord, shiftDay, type LessonRecords } from '@/features/learning/progression';
import { emptySkillStats } from '@/features/learning/progressModel';
import { boardFromSetup, expandDice } from '@/features/lessons/engine/evaluate';
import type { UserMistake } from '@/features/practice/mistakes';
import { skillOfMistake } from '@/features/skills/extract';
import {
  createBoard,
  findPlayByNotation,
  findPlayForDice,
  installNetwork,
  loadDefaultNetwork,
  REVIEW_HEADLINES,
  type DiceRoll,
} from '@/game';

import {
  anotherLike,
  dailyPosition,
  parseRef,
  pickDailyPosition,
  positionSteps,
  refExists,
  refKey,
  skillOfRef,
  taughtSkills,
  weakestFirst,
} from '../positionOfTheDay';

const net = loadDefaultNetwork();
beforeAll(() => installNetwork(net));
afterAll(() => installNetwork(null));

const done = (...ids: string[]): LessonRecords =>
  Object.fromEntries(ids.map((id) => [id, { ...emptyLessonRecord(), completed: true }]));
const recent = (answers: string) => ({ ...emptySkillStats(), attempted: answers.length, recent: answers });
const today = '2026-10-04';

/** A mistake saved from a game: the bank's decision, played with one of its weaker moves. */
function mistakeFrom(bankId: string, extra: Partial<UserMistake> = {}): UserMistake {
  const entry = POSITION_BANK.find((candidate) => candidate.id === bankId)!;
  const board = createBoard(entry.position);
  const dice = entry.dice as DiceRoll;
  return {
    id: `game-1:${bankId}`,
    gameId: 'game-1',
    createdAt: `${today}T09:00:00`,
    position: board,
    dice,
    selectedMove: findPlayByNotation(board, 'player1', dice, entry.others[0])!.moves,
    recommendedMove: findPlayByNotation(board, 'player1', dice, entry.best)!.moves,
    category: 'risk',
    severity: 0.2,
    headline: REVIEW_HEADLINES.safer,
    explanation: '',
    attempts: 0,
    solved: 0,
    lastPracticedAt: null,
    streak: 0,
    wrong: 0,
    dueDay: today,
    lastCorrectDay: null,
    ...extra,
  };
}

describe('position refs', () => {
  it('round-trip through text and reject anything else', () => {
    expect(parseRef(refKey({ source: 'bank', id: 'p012' }))).toEqual({ source: 'bank', id: 'p012' });
    expect(parseRef('mistake:g-1:14')).toEqual({ source: 'mistake', id: 'g-1:14' });
    for (const bad of [undefined, '', 'bank', 'bank:', 'other:p1']) expect(parseRef(bad)).toBeNull();
  });

  it('exist while their position does', () => {
    const mistake = mistakeFrom('p001');
    expect(refExists({ source: 'bank', id: 'p001' }, [])).toBe(true);
    expect(refExists({ source: 'bank', id: 'nope' }, [])).toBe(false);
    expect(refExists({ source: 'mistake', id: mistake.id }, [mistake])).toBe(true);
    expect(refExists({ source: 'mistake', id: mistake.id }, [])).toBe(false);
  });
});

describe('Position of the Day', () => {
  const base = { day: today, mistakes: [] as UserMistake[], lessons: {} as LessonRecords, bySkill: {} };

  it('waits until a lesson has taught something the bank covers', () => {
    expect(pickDailyPosition(base)).toBeNull();
    expect(pickDailyPosition({ ...base, lessons: done('board-1', 'board-2', 'moving-1') })).toBeNull();
    expect(pickDailyPosition({ ...base, lessons: done('hitting-1') })).toMatchObject({ source: 'bank' });
  });

  it('picks from the shakiest skill the learner has been taught', () => {
    const lessons = done('hitting-1', 'points-1', 'points-2');
    expect([...taughtSkills(lessons)].sort()).toEqual(['hitting', 'points', 'safety']);
    const bySkill = { hitting: recent('111111'), points: recent('110111'), safety: recent('010010') };
    expect(weakestFirst(['hitting', 'points', 'safety'], bySkill)).toEqual(['safety', 'points', 'hitting']);
    const ref = pickDailyPosition({ ...base, lessons, bySkill })!;
    expect(skillOfRef(ref, [])).toBe('safety');
  });

  it('is the same all day and changes from day to day', () => {
    const input = { ...base, lessons: done('hitting-1') };
    expect(pickDailyPosition(input)).toEqual(pickDailyPosition(input));
    const days = Array.from({ length: 10 }, (_, index) => refKey(pickDailyPosition({ ...input, day: shiftDay(today, index) })!));
    expect(new Set(days).size).toBeGreaterThan(3);
  });

  it('brings back a position from your games when one is due (free), or leaves it to the review (Premium)', () => {
    const mistake = mistakeFrom('p001');
    const input = { ...base, mistakes: [mistake], lessons: done('hitting-1') };
    expect(pickDailyPosition(input)).toEqual({ source: 'mistake', id: mistake.id });
    expect(pickDailyPosition({ ...input, reviewQueue: true })).toMatchObject({ source: 'bank' });
    // Not due yet, or already mastered: the bank instead.
    expect(pickDailyPosition({ ...input, mistakes: [{ ...mistake, dueDay: shiftDay(today, 3) }] })).toMatchObject({ source: 'bank' });
    expect(pickDailyPosition({ ...input, mistakes: [{ ...mistake, streak: 3 }] })).toMatchObject({ source: 'bank' });
    // With nothing taught yet, the review queue still gets today's position from your games.
    expect(pickDailyPosition({ ...input, lessons: {}, reviewQueue: true })).toEqual({ source: 'mistake', id: mistake.id });
  });

  it('keeps the position already shown today, unless it is gone', () => {
    const mistake = mistakeFrom('p001');
    const input = { ...base, lessons: done('hitting-1') };
    const stored = { day: today, ref: `mistake:${mistake.id}` };
    // A game later today adds a due mistake: today's position doesn't change.
    expect(dailyPosition({ ...input, mistakes: [mistake], stored: { day: today, ref: 'bank:p050' } })).toEqual({ source: 'bank', id: 'p050' });
    expect(dailyPosition({ ...input, mistakes: [mistake], stored })).toEqual({ source: 'mistake', id: mistake.id });
    // Deleted since: pick again. Yesterday's: pick again.
    expect(dailyPosition({ ...input, mistakes: [], stored })).toEqual(pickDailyPosition(input));
    expect(dailyPosition({ ...input, stored: { day: shiftDay(today, -1), ref: 'bank:p050' } })).toEqual(pickDailyPosition(input));
  });

  it('offers another position with the same idea until they run out', () => {
    const pool = POSITION_BANK.filter((entry) => entry.skill === 'safety').map((entry) => entry.id);
    const next = anotherLike('safety', [pool[0]], 7)!;
    expect(next.source).toBe('bank');
    expect(pool.slice(1)).toContain(next.id);
    expect(anotherLike('safety', pool, 7)).toBeNull();
    expect(anotherLike('cube', [], 7)).toBeNull();
  });
});

describe('position steps', () => {
  it.each(POSITION_BANK.map((entry) => [entry.id] as const))('bank %s asks what you would play, and explains', (id) => {
    const entry = POSITION_BANK.find((candidate) => candidate.id === id)!;
    const steps = positionSteps({ source: 'bank', id }, [], 'Position of the Day')!;
    expect(steps).toHaveLength(2);
    const [choice, idea] = steps as [ChoiceStep, ExplainStep];
    expect(choice.kind).toBe('choice');
    expect(choice.skill).toBe(entry.skill);
    expect(choice.prompt).toContain('What would you play?');
    expect(choice.options).toHaveLength(1 + entry.others.length);
    const right = choice.options.filter((option) => option.correct);
    expect(right).toHaveLength(1);
    expect(new Set(choice.options.map((option) => option.text)).size).toBe(choice.options.length);
    const board = boardFromSetup(choice.board!);
    const dice = expandDice(choice.board!.dice!);
    // Every choice is a legal play, shown as arrows before it's confirmed.
    for (const option of choice.options) {
      expect(findPlayForDice(board, 'player1', dice, option.play!, { largerDieRule: true })).not.toBeNull();
      expect(option.explanation.length).toBeGreaterThan(20);
    }
    const best = findPlayByNotation(board, 'player1', entry.dice as DiceRoll, entry.best)!;
    expect(findPlayByNotation(board, 'player1', entry.dice as DiceRoll, right[0].play!)!.key).toBe(best.key);
    expect(idea.kind).toBe('explain');
    expect(idea.title).toMatch(/^Key idea: /);
    expect(idea.board?.arrows?.length).toBeGreaterThan(0);
  });

  it('shows a position from your game with the move you played', () => {
    const mistake = mistakeFrom('p001');
    const [choice] = positionSteps({ source: 'mistake', id: mistake.id }, [mistake], 'One more position') as [ChoiceStep];
    expect(choice.prompt).toMatch(/^From your game: you rolled/);
    expect(choice.skill).toBe(skillOfMistake(mistake));
    const yours = choice.options.find((option) => option.explanation.startsWith('That’s what you played in your game.'));
    expect(yours?.correct).toBeFalsy();
    expect(choice.options.filter((option) => option.correct)).toHaveLength(1);
    expect(choice.options.length).toBeGreaterThanOrEqual(2);
    expect(skillOfRef({ source: 'mistake', id: mistake.id }, [mistake])).toBe(skillOfMistake(mistake));
  });

  it('has nothing to show for a position that is gone', () => {
    expect(positionSteps({ source: 'mistake', id: 'gone' }, [], 'x')).toBeNull();
    expect(positionSteps({ source: 'bank', id: 'gone' }, [], 'x')).toBeNull();
    expect(skillOfRef({ source: 'mistake', id: 'gone' }, [])).toBeNull();
  });
});
