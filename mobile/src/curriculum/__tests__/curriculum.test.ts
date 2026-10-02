import glyphs from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';

import {
  allCheckersHome,
  applyMove,
  checkersAt,
  createBoard,
  findPlayForDice,
  getLegalPlays,
  hasBorneOffAll,
  isPointOpen,
  validateBoard,
  type BoardState,
  type DieValue,
} from '@/game';
import {
  boardFromSetup,
  expandDice,
  goalMet,
  sameTarget,
  solutionMoves,
  usesRealRoll,
} from '@/features/lessons/engine/evaluate';

import { allLessons, curriculum, type ChallengeStep, type Lesson, type LessonStep } from '../index';

const iconExists = (name: string) => Object.prototype.hasOwnProperty.call(glyphs, name);

function boardsIn(step: LessonStep) {
  const boards = [];
  if ('board' in step && step.board) boards.push(step.board.position);
  if (step.kind === 'tap' && step.reveal) boards.push(step.reveal);
  return boards;
}

/** Can the challenge goal be reached with some sequence of legal plays? */
function challengeSolvable(step: ChallengeStep): boolean {
  const reached = (board: BoardState) =>
    step.goal.type === 'bear-off-all' ? hasBorneOffAll(board, 'player1') : allCheckersHome(board, 'player1');
  const search = (board: BoardState, rollIndex: number): boolean => {
    if (reached(board)) return true;
    if (rollIndex >= step.rolls.length) return false;
    return getLegalPlays(board, 'player1', step.rolls[rollIndex]).some((play) => search(play.board, rollIndex + 1));
  };
  return search(boardFromSetup(step.board), 0);
}

describe('curriculum structure', () => {
  it('has unique lesson ids', () => {
    const ids = allLessons.map((lesson) => lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('assigns every lesson to its section', () => {
    for (const section of curriculum) {
      expect(section.lessons.length).toBeGreaterThan(0);
      expect(iconExists(section.icon)).toBe(true);
      for (const lesson of section.lessons) expect(lesson.sectionId).toBe(section.id);
    }
  });
});

describe.each(allLessons.map((lesson) => [lesson.id, lesson] as [string, Lesson]))('lesson %s', (_id, lesson) => {
  it('has valid metadata', () => {
    expect(iconExists(lesson.icon)).toBe(true);
    expect(lesson.xp).toBeGreaterThan(0);
    expect(lesson.passingScore).toBeGreaterThanOrEqual(0);
    expect(lesson.passingScore).toBeLessThanOrEqual(1);
    expect(lesson.objectives.length).toBeGreaterThan(0);
    expect(lesson.steps.length).toBeGreaterThan(2);
    const stepIds = lesson.steps.map((step) => step.id);
    expect(new Set(stepIds).size).toBe(stepIds.length);
  });

  it('keeps explanations short', () => {
    for (const step of lesson.steps) {
      const text = 'text' in step ? step.text : step.prompt;
      // "1-2 short sentences": guard against walls of text.
      expect(text.length).toBeLessThanOrEqual(150);
    }
  });

  it('only uses valid board positions', () => {
    for (const step of lesson.steps) {
      for (const spec of boardsIn(step)) {
        expect(validateBoard(createBoard(spec))).toEqual([]);
      }
    }
  });

  it.each(lesson.steps.map((step) => [step.id, step] as [string, LessonStep]))('step %s is completable', (_stepId, step) => {
    switch (step.kind) {
      case 'tap': {
        expect(step.answers.length).toBeGreaterThan(0);
        for (const wrongCase of step.wrongCases ?? []) {
          for (const target of wrongCase.targets) {
            expect(step.answers.some((answer) => sameTarget(answer, target))).toBe(false);
          }
        }
        break;
      }
      case 'move': {
        const start = boardFromSetup(step.board);
        const moves = solutionMoves(step, start);
        let end = start;
        for (const move of moves) end = applyMove(end, 'player1', move);
        expect(goalMet(step.goal, start, end, moves)).toBe(true);
        const dice = expandDice(step.board.dice);
        if (step.goal.type === 'plays') {
          for (const play of step.goal.plays) {
            expect(findPlayForDice(start, 'player1', dice, play, { largerDieRule: usesRealRoll(step) })).not.toBeNull();
          }
        }
        for (const wrong of step.wrongPlays ?? []) {
          for (const play of wrong.plays) {
            const legal = findPlayForDice(start, 'player1', dice, play, { largerDieRule: usesRealRoll(step) });
            expect(legal).not.toBeNull();
            expect(goalMet(step.goal, start, legal!.board, legal!.moves)).toBe(false);
          }
        }
        break;
      }
      case 'choice': {
        expect(step.options.length).toBeGreaterThanOrEqual(2);
        expect(step.options.filter((option) => option.correct).length).toBeGreaterThanOrEqual(1);
        expect(new Set(step.options.map((option) => option.id)).size).toBe(step.options.length);
        for (const option of step.options) expect(option.explanation.length).toBeGreaterThan(0);
        break;
      }
      case 'cube': {
        const allowed = step.decision === 'offer' ? ['double', 'no-double'] : ['take', 'drop'];
        expect(allowed).toContain(step.answer);
        for (const answer of allowed) expect(step.explanations[answer as keyof typeof step.explanations]).toBeTruthy();
        break;
      }
      case 'demo': {
        let board = boardFromSetup(step.board);
        for (const move of step.moves) {
          const player = move.player ?? 'player1';
          if (move.from === 'bar') expect(board.bar[player]).toBeGreaterThan(0);
          else expect(checkersAt(board, move.from, player)).toBeGreaterThan(0);
          if (move.to !== 'off') expect(isPointOpen(board, player, move.to)).toBe(true);
          board = applyMove(board, player, { ...move, die: 1 as DieValue, hit: false });
        }
        break;
      }
      case 'challenge': {
        expect(challengeSolvable(step)).toBe(true);
        break;
      }
      case 'explain':
        break;
    }
  });
});
