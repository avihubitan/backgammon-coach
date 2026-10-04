import glyphs from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';

import { generatorFor } from '@/features/practice/generators';
import { buildDrillSession, drillToStep, raceQuestion } from '@/features/practice/practiceModel';
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

  it('has hand-picked positions for every level that isn’t generated', () => {
    for (const category of DRILL_CATEGORIES) {
      for (const level of category.levels) {
        if (generatorFor(category.id, level.id)) continue;
        expect(drillsFor(category.id).filter((drill) => (drill.level ?? 'classics') === level.id).length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('files every hand-picked drill under one of its category’s levels', () => {
    for (const drill of ALL_MOVE_DRILLS) {
      const category = DRILL_CATEGORIES.find((info) => info.id === drill.category)!;
      expect(category.levels.map((level) => level.id)).toContain(drill.level ?? 'classics');
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
});
