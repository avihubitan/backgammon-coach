import type { BoardSetup, ChallengeGoal, MoveGoal, MoveStep, TapStep, TapTarget } from '@/curriculum';
import {
  allCheckersHome,
  applyNotation,
  blotPoints,
  checkersAt,
  countAt,
  createBoard,
  explainDifference,
  findPlayForDice,
  getLegalPlays,
  hasBorneOffAll,
  hasContact,
  isMadePoint,
  positionKey,
  type BoardState,
  type CheckerMove,
  type DiceRoll,
  type Player,
} from '@/game';

const LEARNER: Player = 'player1';

export function boardFromSetup(setup: BoardSetup | undefined): BoardState {
  return createBoard(setup?.position ?? {});
}

export function sameTarget(a: TapTarget, b: TapTarget): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind === 'point' && b.kind === 'point' ? a.point === b.point : true;
}

export function isCorrectTap(step: TapStep, target: TapTarget): boolean {
  return step.answers.some((answer) => sameTarget(answer, target));
}

function fill(template: string, target: TapTarget, board: BoardState): string {
  const point = target.kind === 'point' ? target.point : null;
  return template
    .replaceAll('{point}', point === null ? (target.kind === 'bar' ? 'bar' : 'tray') : String(point))
    .replaceAll('{count}', point === null ? '0' : String(countAt(board, point)));
}

/** Explanation for a wrong tap, preferring a specific message when one exists. */
export function tapFeedback(step: TapStep, target: TapTarget, board: BoardState): string {
  const specific = step.wrongCases?.find((entry) => entry.targets.some((t) => sameTarget(t, target)));
  return fill(specific?.text ?? step.wrong, target, board);
}

export function goalMet(
  goal: MoveGoal,
  start: BoardState,
  end: BoardState,
  moves: readonly CheckerMove[],
  player: Player = LEARNER,
): boolean {
  switch (goal.type) {
    case 'any':
      return true;
    case 'plays': {
      const key = positionKey(end);
      return goal.plays.some((play) => positionKey(applyNotation(start, player, play)) === key);
    }
    case 'land-on':
      return (
        checkersAt(end, goal.point, player) >= (goal.count ?? 1) &&
        checkersAt(end, goal.point, player) > checkersAt(start, goal.point, player)
      );
    case 'hit':
      return moves.some((move) => move.hit && (goal.point === undefined || move.to === goal.point));
    case 'make-point':
      return checkersAt(start, goal.point, player) < 2 && checkersAt(end, goal.point, player) >= 2;
    case 'enter':
      return start.bar[player] > 0 && end.bar[player] === 0;
    case 'bear-off':
      return end.off[player] - start.off[player] >= goal.count;
    case 'safe':
      return blotPoints(end, player).length === 0;
  }
}

export interface MoveVerdict {
  correct: boolean;
  message: string;
  /** The kind of mistake the coach recognised (hitting, safety…), when it explained one. */
  mistakeCategory?: string;
}

export function evaluateMoveStep(
  step: MoveStep,
  start: BoardState,
  end: BoardState,
  moves: readonly CheckerMove[],
): MoveVerdict {
  if (goalMet(step.goal, start, end, moves)) return { correct: true, message: step.correct };
  const key = positionKey(end);
  const specific = step.wrongPlays?.find((entry) =>
    entry.plays.some((play) => positionKey(applyNotation(start, LEARNER, play)) === key),
  );
  if (specific) return { correct: false, message: specific.text };
  if (step.coachFeedback) {
    const explained = explainDifference(start, LEARNER, moves, solutionMoves(step, start), false);
    return {
      correct: false,
      message: `${explained.explanation} ${step.wrong}`.trim(),
      mistakeCategory: explained.category,
    };
  }
  return { correct: false, message: step.wrong };
}

/** Whether the lesson's dice should follow the real-roll "larger die" rule. */
export function usesRealRoll(step: MoveStep): boolean {
  const dice = step.board.dice;
  return step.realRoll ?? (dice.length === 2 && dice[0] !== dice[1]);
}

/** The concrete checker moves for a step's written solution. */
export function solutionMoves(step: MoveStep, start: BoardState = boardFromSetup(step.board)): CheckerMove[] {
  const play = findPlayForDice(start, LEARNER, expandDice(step.board.dice), step.solution, {
    largerDieRule: usesRealRoll(step),
  });
  if (!play) throw new Error(`Solution "${step.solution}" is not legal in step ${step.id}`);
  return play.moves;
}

/** Two equal dice mean doubles: four moves. */
export function expandDice(dice: readonly number[]): CheckerMove['die'][] {
  const values = dice as CheckerMove['die'][];
  if (values.length === 2 && values[0] === values[1]) return [values[0], values[0], values[0], values[0]];
  return values.slice();
}

/** The longest run of the learner's made points in a row. */
export function longestWall(board: BoardState): number {
  let best = 0;
  let run = 0;
  for (let point = 1; point <= 24; point++) {
    run = isMadePoint(board, point, LEARNER) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** Whether a mini-game's goal is reached on `board`. */
export function challengeGoalReached(goal: ChallengeGoal, board: BoardState): boolean {
  switch (goal.type) {
    case 'bear-off-all':
      return hasBorneOffAll(board, LEARNER);
    case 'all-home':
      return allCheckersHome(board, LEARNER);
    case 'escape':
      return !hasContact(board);
    case 'prime':
      return longestWall(board) >= goal.length;
    case 'hit':
      return board.bar.player2 >= goal.count;
  }
}

/**
 * Whether some sequence of legal plays over `rolls` reaches the goal, and
 * whether some sequence misses it: a mini-game worth playing has both.
 */
export function challengeOutcomes(
  start: BoardState,
  rolls: readonly DiceRoll[],
  goal: ChallengeGoal,
  /** Positions to look at before giving up (reported as unsolvable): keeps generated games fast. */
  budget = Infinity,
): { solvable: boolean; failable: boolean } {
  const memo = new Map<string, { solvable: boolean; failable: boolean }>();
  let explored = 0;
  const search = (board: BoardState, roll: number): { solvable: boolean; failable: boolean } => {
    if (challengeGoalReached(goal, board)) return { solvable: true, failable: false };
    if (roll >= rolls.length || ++explored > budget) return { solvable: false, failable: true };
    const key = `${roll}|${positionKey(board)}`;
    const known = memo.get(key);
    if (known) return known;
    const plays = getLegalPlays(board, LEARNER, rolls[roll]);
    let result = { solvable: false, failable: false };
    // No legal move: the roll passes.
    if (plays.length === 0) result = search(board, roll + 1);
    for (const play of plays) {
      const next = search(play.board, roll + 1);
      result = { solvable: result.solvable || next.solvable, failable: result.failable || next.failable };
      if (result.solvable && result.failable) break;
    }
    memo.set(key, result);
    return result;
  };
  const result = search(start, 0);
  return explored > budget ? { solvable: false, failable: true } : result;
}
