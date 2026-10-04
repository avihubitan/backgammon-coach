import { allCheckersHome, hasContact, madePoints, opponentOf, pipDistance, positionKey } from '../board/board';
import type { DiceRoll } from '../dice/dice';
import type { TurnRecord } from '../engine/game';
import { formatPlay } from '../moves/notation';
import { applyPlay, hasBorneOffAll } from '../rules/movement';
import type { BoardState, CheckerMove, Player } from '../types';

import { equityAfterMove, hasNetwork, rankByEquity, winChanceOnRoll, winProbabilityAfterMove } from './engine';
import { extractFeatures } from './evaluate';

/**
 * Turns engine numbers into coaching: for each of the learner's moves it
 * finds the best alternative, rates the difference and explains it in plain
 * language based on concrete features (hits, shots, points, escapes, race).
 */

export type MistakeCategory =
  | 'opening'
  | 'hitting'
  | 'positioning'
  | 'running'
  | 'racing'
  | 'bearing-off'
  | 'cube'
  | 'risk';

export type Severity = 'best' | 'fine' | 'inaccuracy' | 'mistake' | 'blunder';

export interface SeverityThresholds {
  fine: number;
  inaccuracy: number;
  mistake: number;
}

/**
 * Equity losses (points per game) at which a move stops being fine. Each
 * evaluator has its own scale: the hand-written heuristic is flat, the
 * trained network sees bigger (and more accurate) differences. With the
 * network an inaccuracy costs about 2% of winning chances and a blunder
 * over 12%, in line with how strong engines grade play.
 */
export const HEURISTIC_THRESHOLDS: SeverityThresholds = { fine: 0.02, inaccuracy: 0.06, mistake: 0.14 };
export const NETWORK_THRESHOLDS: SeverityThresholds = { fine: 0.04, inaccuracy: 0.12, mistake: 0.25 };

export function severityThresholds(): SeverityThresholds {
  return hasNetwork() ? NETWORK_THRESHOLDS : HEURISTIC_THRESHOLDS;
}

export function severityFor(loss: number, rank: number, thresholds: SeverityThresholds = severityThresholds()): Severity {
  if (loss < thresholds.fine) return rank === 1 ? 'best' : 'fine';
  if (loss < thresholds.inaccuracy) return 'inaccuracy';
  if (loss < thresholds.mistake) return 'mistake';
  return 'blunder';
}

export interface MoveReview {
  /** Index into the game's history. */
  index: number;
  player: Player;
  roll: DiceRoll;
  boardBefore: BoardState;
  played: CheckerMove[];
  best: CheckerMove[];
  playedEquity: number;
  bestEquity: number;
  loss: number;
  rank: number;
  alternatives: number;
  severity: Severity;
  category: MistakeCategory;
  headline: string;
  explanation: string;
}

export interface CubeReview {
  index: number;
  action: 'double' | 'take' | 'drop';
  winChance: number;
  correct: boolean;
  headline: string;
  explanation: string;
}

export interface GameReview {
  moves: MoveReview[];
  cube: CubeReview[];
  summary: {
    movesReviewed: number;
    bestMoves: number;
    inaccuracies: number;
    mistakes: number;
    blunders: number;
    averageLoss: number;
    byCategory: Partial<Record<MistakeCategory, number>>;
    focus: MistakeCategory | null;
    biggest: number | null;
  };
}

const CATEGORY_LABEL: Record<MistakeCategory, string> = {
  opening: 'Opening moves',
  hitting: 'Hitting',
  positioning: 'Building points',
  running: 'Escaping back checkers',
  racing: 'Racing',
  'bearing-off': 'Bearing off',
  cube: 'Doubling cube',
  risk: 'Risk management',
};

export const categoryLabel = (category: MistakeCategory) => CATEGORY_LABEL[category];

function hitsOf(moves: readonly CheckerMove[]) {
  return moves.filter((move) => move.hit);
}

function newPoints(before: BoardState, after: BoardState, player: Player): number[] {
  const had = new Set(madePoints(before, player));
  return madePoints(after, player).filter((point) => !had.has(point));
}

function pointName(player: Player, point: number): string {
  const label = pipDistance(player, point);
  if (label === 5) return 'your 5-point';
  if (label === 7) return 'your bar point (7-point)';
  // Points in the opponent's home board and their bar point: anchors for the back checkers.
  if (label >= 18) return `an anchor on the ${label}-point`;
  return `your ${label}-point`;
}

function isOpeningMove(history: readonly TurnRecord[], index: number, player: Player): boolean {
  const ownTurns = history.slice(0, index + 1).filter((record) => record.player === player && !record.cubeAction);
  return ownTurns.length <= 2;
}

interface Explained {
  category: MistakeCategory;
  headline: string;
  explanation: string;
}

/**
 * The headline of each kind of weaker move. Stable keys: Coach Watch picks its
 * clue by them, and the coach files mistakes under skills by them.
 */
export const REVIEW_HEADLINES = {
  bearOffMore: 'You could bear off more',
  smootherBearOff: 'A smoother bear-off was possible',
  raceEfficiently: 'Race more efficiently',
  missedHit: 'You missed a hit',
  anchor: 'An anchor was available',
  point: 'You could make a point',
  safer: 'You had a safer option',
  slightlySafer: 'A slightly safer play existed',
  backCheckers: 'Get your back checkers moving',
  pressure: 'Keep the pressure on',
  structure: 'A stronger structure was possible',
} as const;

/** Plain-language reason why `best` beats `played`. */
export function explainDifference(
  before: BoardState,
  player: Player,
  played: readonly CheckerMove[],
  best: readonly CheckerMove[],
  opening: boolean,
): Explained {
  const opponent = opponentOf(player);
  const afterPlayed = applyPlay(before, player, played);
  const afterBest = applyPlay(before, player, best);
  const bestText = formatPlay(player, best);
  const fPlayed = extractFeatures(afterPlayed, player);
  const fBest = extractFeatures(afterBest, player);
  const tag = (category: MistakeCategory) => (opening ? 'opening' : category);

  if (!hasContact(before)) {
    if (allCheckersHome(before, player)) {
      const extraOff = afterBest.off[player] - afterPlayed.off[player];
      return {
        category: 'bearing-off',
        headline: extraOff > 0 ? REVIEW_HEADLINES.bearOffMore : REVIEW_HEADLINES.smootherBearOff,
        explanation:
          extraOff > 0
            ? `${bestText} takes ${extraOff === 1 ? 'one more checker' : `${extraOff} more checkers`} off this turn. In a bear-off every checker counts.`
            : `${bestText} keeps your checkers spread across more points, so fewer future rolls are wasted.`,
      };
    }
    return {
      category: 'racing',
      headline: REVIEW_HEADLINES.raceEfficiently,
      explanation: `It’s a pure race now, so speed is everything. ${bestText} brings your checkers home with less wasted movement.`,
    };
  }

  const bestHits = hitsOf(best);
  const playedHits = hitsOf(played);
  if (bestHits.length > playedHits.length) {
    const target = bestHits[0].to as number;
    const pips = 25 - pipDistance(opponent, target);
    return {
      category: tag('hitting'),
      headline: REVIEW_HEADLINES.missedHit,
      explanation: `${bestText} hits the blot on the ${target}-point. That checker would have to start over, costing your opponent ${pips} pips.`,
    };
  }

  const madeByBest = newPoints(before, afterBest, player);
  const madeByPlayed = new Set(newPoints(before, afterPlayed, player));
  const missedPoint = madeByBest.find((point) => !madeByPlayed.has(point));
  const keyPoint =
    missedPoint !== undefined &&
    ([4, 5, 6, 7].includes(pipDistance(player, missedPoint)) || pipDistance(player, missedPoint) >= 18);
  const pointExplanation = (point: number): Explained => {
    const anchor = pipDistance(player, point) >= 18;
    return {
      category: tag('positioning'),
      headline: anchor ? REVIEW_HEADLINES.anchor : REVIEW_HEADLINES.point,
      explanation: anchor
        ? `${bestText} makes ${pointName(player, point)}: a safe base for your back checkers.`
        : `${bestText} makes ${pointName(player, point)}. Every point you make blocks your opponent and gives your checkers a safe landing spot.`,
    };
  };
  if (keyPoint && missedPoint !== undefined) return pointExplanation(missedPoint);

  // Risk is about what a hit would cost: loose checkers deep in your own half
  // lose a lot of ground, while blots in the opponent's home board lose little.
  const shotsPlayed = fPlayed.exposure.hittingRolls;
  const shotsBest = fBest.exposure.hittingRolls;
  const costPlayed = fPlayed.exposure.expectedPipLoss;
  const costBest = fBest.exposure.expectedPipLoss;
  if (shotsPlayed - shotsBest >= 4 && costPlayed - costBest >= 1.5) {
    return {
      category: tag(playedHits.length > bestHits.length ? 'hitting' : 'risk'),
      headline: REVIEW_HEADLINES.safer,
      explanation:
        shotsBest === 0
          ? `Your move leaves a blot that gets hit by ${shotsPlayed} of 36 rolls. ${bestText} leaves nothing to hit at all.`
          : `Your move leaves blots that get hit by ${shotsPlayed} of 36 rolls. ${bestText} cuts that to ${shotsBest}.`,
    };
  }

  if (missedPoint !== undefined) return pointExplanation(missedPoint);

  if (fBest.backCheckers < fPlayed.backCheckers) {
    return {
      category: tag('running'),
      headline: REVIEW_HEADLINES.backCheckers,
      explanation: `${bestText} brings a back checker out before your opponent can build a wall in front of it.`,
    };
  }

  if (fBest.opponentOnBar > fPlayed.opponentOnBar) {
    return {
      category: tag('hitting'),
      headline: REVIEW_HEADLINES.pressure,
      explanation: `${bestText} keeps more of your opponent’s checkers on the bar.`,
    };
  }

  if (shotsPlayed > shotsBest) {
    return {
      category: tag('risk'),
      headline: REVIEW_HEADLINES.slightlySafer,
      explanation: `${bestText} leaves ${shotsBest} shots instead of ${shotsPlayed}, without giving anything up.`,
    };
  }

  return {
    category: tag('positioning'),
    headline: REVIEW_HEADLINES.structure,
    explanation: `${bestText} keeps your checkers better placed to build points on the next rolls.`,
  };
}

/**
 * What a play achieves, in a sentence, for coaching hints: the single most
 * instructive thing about it, judged the same way reviews judge mistakes.
 */
export function describePlay(before: BoardState, player: Player, moves: readonly CheckerMove[]): string {
  const opponent = opponentOf(player);
  const after = applyPlay(before, player, moves);
  if (!hasContact(before)) {
    if (allCheckersHome(before, player)) {
      const off = after.off[player] - before.off[player];
      return off > 0
        ? `It takes ${off === 1 ? 'a checker' : `${off} checkers`} off and keeps the rest spread for the next rolls.`
        : 'It keeps your checkers spread over more points, so fewer future rolls are wasted.';
    }
    return 'It’s a pure race: this brings your checkers home with the least wasted movement.';
  }
  const hits = hitsOf(moves);
  const made = newPoints(before, after, player);
  const keyPoints = made.filter((point) => [4, 5, 6, 7].includes(pipDistance(player, point)) || pipDistance(player, point) >= 18);
  const shotsBefore = extractFeatures(before, player).exposure.hittingRolls;
  const shots = extractFeatures(after, player).exposure.hittingRolls;
  const safe = shots === 0 ? ', and leaves nothing to hit' : '';
  if (hits.length > 0) {
    const target = hits[0].to as number;
    const pips = 25 - pipDistance(opponent, target);
    const point = keyPoints.length > 0 ? ` while making ${pointName(player, keyPoints[0])}` : '';
    return `It hits the blot on the ${target}-point${point}, sending that checker back ${pips} pips.`;
  }
  const blocking = keyPoints
    .filter((point) => pipDistance(player, point) < 18)
    .sort((a, b) => pipDistance(player, a) - pipDistance(player, b));
  if (blocking.length >= 2) {
    const names = blocking.map((point) => pointName(player, point));
    return `It makes ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}, two points that block your opponent${safe}.`;
  }
  if (keyPoints.length > 0) {
    const point = keyPoints[0];
    return pipDistance(player, point) >= 18
      ? `It makes ${pointName(player, point)}, a safe base for your back checkers${safe}.`
      : `It makes ${pointName(player, point)}, a point that blocks your opponent${safe}.`;
  }
  if (made.length > 0) return `It makes ${pointName(player, made[0])}${safe}.`;
  if (moves.some((move) => move.from === 'bar')) return `It brings your checker back in from the bar${safe}.`;
  if (extractFeatures(after, player).backCheckers < extractFeatures(before, player).backCheckers) {
    return `It brings a back checker out before your opponent can build a wall in front of it${safe}.`;
  }
  if (shots === 0) return 'It leaves nothing for your opponent to hit.';
  if (shotsBefore - shots >= 4) {
    return `It cuts the rolls that would hit you from ${shotsBefore} to ${shots} out of 36.`;
  }
  return 'It keeps your checkers best placed to build points on the next rolls.';
}

/** What each play leads to, in terms a beginner can weigh: shots and winning chances. */
export interface MoveOutcome {
  /** Opponent rolls (of 36) that hit a blot after the played move, and after the coach's. */
  shots: { played: number; best: number };
  /** The player's chance of winning after each move (0..1). */
  winChance: { played: number; best: number };
}

export function moveOutcome(move: Pick<MoveReview, 'boardBefore' | 'player' | 'played' | 'best'>): MoveOutcome {
  const after = (moves: readonly CheckerMove[]) => applyPlay(move.boardBefore, move.player, moves);
  const shots = (board: BoardState) => extractFeatures(board, move.player).exposure.hittingRolls;
  // The same judge that ranked the moves, so the numbers agree with the verdict (a look
  // ahead over all 21 rolls disagreed with it more often, at a few hundred times the cost).
  const win = (board: BoardState) => (hasBorneOffAll(board, move.player) ? 1 : winProbabilityAfterMove(board, move.player));
  const played = after(move.played);
  const best = after(move.best);
  return { shots: { played: shots(played), best: shots(best) }, winChance: { played: win(played), best: win(best) } };
}

const praiseFor = (severity: Severity) =>
  severity === 'best' ? 'Best move' : severity === 'fine' ? 'Good move' : severity === 'inaccuracy' ? 'Small inaccuracy' : severity === 'mistake' ? 'Mistake' : 'Blunder';

export function reviewMove(history: readonly TurnRecord[], index: number): MoveReview | null {
  const record = history[index];
  if (!record || record.cubeAction || !record.roll) return null;
  const ranked = rankByEquity(record.boardBefore, record.player, record.roll);
  if (ranked.length <= 1) return null;
  const playedKey = positionKey(applyPlay(record.boardBefore, record.player, record.moves));
  const rankIndex = ranked.findIndex((entry) => entry.play.key === playedKey);
  const playedEquity = rankIndex >= 0 ? ranked[rankIndex].equity : equityAfterMove(applyPlay(record.boardBefore, record.player, record.moves), record.player);
  const best = ranked[0];
  const loss = Math.max(0, best.equity - playedEquity);
  const rank = rankIndex >= 0 ? rankIndex + 1 : ranked.length;
  const severity = severityFor(loss, rank);
  const opening = isOpeningMove(history, index, record.player);
  const explained =
    severity === 'best' || severity === 'fine'
      ? { category: (opening ? 'opening' : 'positioning') as MistakeCategory, headline: praiseFor(severity), explanation: 'This is one of the strongest moves in the position.' }
      : explainDifference(record.boardBefore, record.player, record.moves, best.play.moves, opening);
  return {
    index,
    player: record.player,
    roll: record.roll,
    boardBefore: record.boardBefore,
    played: record.moves,
    best: best.play.moves,
    playedEquity,
    bestEquity: best.equity,
    loss,
    rank,
    alternatives: ranked.length,
    severity,
    category: explained.category,
    headline: explained.headline,
    explanation: explained.explanation,
  };
}

function reviewCube(history: readonly TurnRecord[], index: number, player: Player): CubeReview | null {
  const record = history[index];
  if (!record?.cubeAction || record.player !== player) return null;
  const board = record.boardBefore;
  if (record.cubeAction === 'double') {
    const chance = winChanceOnRoll(board, player);
    const correct = chance >= 0.66;
    return {
      index,
      action: 'double',
      winChance: chance,
      correct,
      headline: correct ? 'Good double' : 'Early double',
      explanation: correct
        ? `You were about ${Math.round(chance * 100)}% to win: a strong time to double.`
        : `You were only about ${Math.round(chance * 100)}% to win. Doubling usually needs a clear advantage (around 70%).`,
    };
  }
  // A take or drop: the opponent doubled and is on roll.
  const opponent = opponentOf(player);
  const chance = 1 - winChanceOnRoll(board, opponent);
  const shouldTake = chance >= 0.24;
  const took = record.cubeAction === 'take';
  return {
    index,
    action: record.cubeAction,
    winChance: chance,
    correct: shouldTake === took,
    headline: shouldTake === took ? (took ? 'Good take' : 'Good drop') : took ? 'This was a drop' : 'This was a take',
    explanation: `You had about a ${Math.round(chance * 100)}% chance to win. ${
      shouldTake
        ? 'With more than about 25%, taking risks less than dropping.'
        : 'Below about 25%, dropping and losing one point is cheaper than playing on for two.'
    }`,
  };
}

export function reviewGame(history: readonly TurnRecord[], player: Player = 'player1'): GameReview {
  const moves: MoveReview[] = [];
  const cube: CubeReview[] = [];
  history.forEach((record, index) => {
    if (record.player !== player) return;
    if (record.cubeAction) {
      const review = reviewCube(history, index, player);
      if (review) cube.push(review);
      return;
    }
    const review = reviewMove(history, index);
    if (review) moves.push(review);
  });
  const byCategory: Partial<Record<MistakeCategory, number>> = {};
  for (const move of moves) {
    if (move.severity === 'mistake' || move.severity === 'blunder') {
      byCategory[move.category] = (byCategory[move.category] ?? 0) + 1;
    }
  }
  for (const decision of cube) if (!decision.correct) byCategory.cube = (byCategory.cube ?? 0) + 1;
  const focus = (Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] as MistakeCategory | undefined) ?? null;
  const worst = moves.reduce<MoveReview | null>((max, move) => (!max || move.loss > max.loss ? move : max), null);
  return {
    moves,
    cube,
    summary: {
      movesReviewed: moves.length,
      bestMoves: moves.filter((move) => move.severity === 'best' || move.severity === 'fine').length,
      inaccuracies: moves.filter((move) => move.severity === 'inaccuracy').length,
      mistakes: moves.filter((move) => move.severity === 'mistake').length,
      blunders: moves.filter((move) => move.severity === 'blunder').length,
      averageLoss: moves.length ? moves.reduce((sum, move) => sum + move.loss, 0) / moves.length : 0,
      byCategory,
      focus,
      biggest: worst && worst.loss >= severityThresholds().inaccuracy ? worst.index : null,
    },
  };
}
