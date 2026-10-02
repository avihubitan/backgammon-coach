import glyphs from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';

import { buildDrillSession, dailyChallengeFor, drillToStep, raceQuestion } from '@/features/practice/practiceModel';
import { boardFromSetup, goalMet, solutionMoves } from '@/features/lessons/engine/evaluate';
import { applyMove, createBoard, createRng, getLegalPlays, validateBoard } from '@/game';

import { ALL_MOVE_DRILLS, DRILL_CATEGORIES, drillsFor, type TacticalDrill } from '../drills';

describe('drill catalogue', () => {
  it('has unique ids and known icons', () => {
    const ids = ALL_MOVE_DRILLS.map((drill) => drill.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const category of DRILL_CATEGORIES) {
      expect(Object.prototype.hasOwnProperty.call(glyphs, category.icon)).toBe(true);
    }
  });

  it('offers enough drills for a session in every move category', () => {
    for (const category of DRILL_CATEGORIES) {
      if (category.id === 'race') continue;
      expect(drillsFor(category.id).length).toBeGreaterThanOrEqual(5);
    }
  });
});

describe.each(ALL_MOVE_DRILLS.map((drill) => [drill.id, drill] as [string, TacticalDrill]))('drill %s', (_id, drill) => {
  const step = drillToStep(drill);
  const start = boardFromSetup(step.board);

  it('uses a valid position', () => {
    expect(validateBoard(createBoard(drill.position))).toEqual([]);
  });

  it('has a legal solution that meets the goal', () => {
    const moves = solutionMoves(step, start);
    let end = start;
    for (const move of moves) end = applyMove(end, 'player1', move);
    expect(goalMet(drill.goal, start, end, moves)).toBe(true);
  });

  it('is a real decision: some legal play misses the goal', () => {
    const plays = getLegalPlays(start, 'player1', drill.dice);
    expect(plays.some((play) => !goalMet(drill.goal, start, play.board, play.moves))).toBe(true);
  });
});

describe('practice sessions', () => {
  it('builds a deterministic session per seed', () => {
    const a = buildDrillSession('hitting', 7);
    const b = buildDrillSession('hitting', 7);
    expect(a.steps.map((step) => step.id)).toEqual(b.steps.map((step) => step.id));
    expect(a.steps).toHaveLength(5);
  });

  it('generates race questions with exactly one correct answer and a pure race', () => {
    const rng = createRng(3);
    for (let i = 0; i < 20; i++) {
      const question = raceQuestion(rng, i);
      expect(question.options.filter((option) => option.correct)).toHaveLength(1);
      const board = boardFromSetup(question.board);
      expect(validateBoard(board)).toEqual([]);
    }
  });

  it('picks the same daily challenge all day, only from unlocked drills', () => {
    const unlocked = DRILL_CATEGORIES.slice(0, 2);
    const first = dailyChallengeFor('2026-10-02', unlocked);
    expect(first).toEqual(dailyChallengeFor('2026-10-02', unlocked));
    expect(unlocked.map((category) => category.id)).toContain(first?.category);
    expect(dailyChallengeFor('2026-10-02', [])).toBeNull();
  });
});
