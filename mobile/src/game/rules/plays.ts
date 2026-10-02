import { cloneBoard, positionKey } from '../board/board';
import { isDouble, movesForRoll, type DiceRoll } from '../dice/dice';
import type { BoardState, DieValue, Play, Player } from '../types';
import {
  applyMove,
  applyMoveInPlace,
  hasBorneOffAll,
  legalSingleMoves,
  sourceDistance,
} from './movement';

function distinctDice(dice: readonly DieValue[]): DieValue[] {
  return Array.from(new Set(dice));
}

function withoutOne(dice: readonly DieValue[], die: DieValue): DieValue[] {
  const index = dice.indexOf(die);
  if (index < 0) return dice.slice();
  return [...dice.slice(0, index), ...dice.slice(index + 1)];
}

/**
 * The largest number of dice that can be played from this position.
 * Bearing off the final checker counts as using every remaining die, because
 * the game ends immediately.
 */
export function maxDiceUsable(board: BoardState, player: Player, dice: readonly DieValue[]): number {
  if (dice.length === 0) return 0;
  if (hasBorneOffAll(board, player)) return dice.length;
  let best = 0;
  for (const die of distinctDice(dice)) {
    for (const move of legalSingleMoves(board, player, die)) {
      const used = 1 + maxDiceUsable(applyMove(board, player, move), player, withoutOne(dice, die));
      if (used > best) best = used;
      if (best === dice.length) return best;
    }
  }
  return best;
}

export interface LegalPlay {
  moves: Play;
  board: BoardState;
  key: string;
}

/**
 * Every distinct legal way to play a roll, one entry per resulting position.
 *
 * Enforces the full-turn rules: use as many dice as possible; if only one die
 * of a non-double can be played, play the larger one when possible.
 * Returns a single empty play when no move is possible.
 */
export function getLegalPlays(board: BoardState, player: Player, roll: DiceRoll): LegalPlay[] {
  return getLegalPlaysForDice(board, player, movesForRoll(roll), { largerDieRule: !isDouble(roll) });
}

/**
 * Same as `getLegalPlays` but for an arbitrary list of dice (lessons use a
 * single die, for example). The larger-die rule only applies to real rolls.
 */
export function getLegalPlaysForDice(
  board: BoardState,
  player: Player,
  dice: readonly DieValue[],
  options: { largerDieRule?: boolean } = {},
): LegalPlay[] {
  const allSame = dice.length > 1 && dice.every((die) => die === dice[0]);
  const found = new Map<string, { moves: Play; board: BoardState; used: number }>();
  let maxUsed = 0;

  const record = (current: BoardState, moves: Play, used: number) => {
    if (used < maxUsed) return;
    if (used > maxUsed) {
      maxUsed = used;
      found.clear();
    }
    const key = positionKey(current);
    if (!found.has(key)) found.set(key, { moves: moves.slice(), board: cloneBoard(current), used });
  };

  const search = (current: BoardState, remaining: DieValue[], moves: Play, lastSource: number) => {
    if (hasBorneOffAll(current, player) && moves.length > 0) {
      record(current, moves, dice.length);
      return;
    }
    let moved = false;
    for (const die of distinctDice(remaining)) {
      for (const move of legalSingleMoves(current, player, die)) {
        const source = sourceDistance(player, move.from);
        // With identical dice, any order of moves can be rearranged so sources
        // never move "backwards"; enforcing that ordering avoids duplicate work.
        if (allSame && source > lastSource) continue;
        moved = true;
        const next = cloneBoard(current);
        applyMoveInPlace(next, player, move);
        moves.push(move);
        search(next, withoutOne(remaining, die), moves, source);
        moves.pop();
      }
    }
    if (!moved) record(current, moves, moves.length);
  };

  search(board, dice.slice(), [], 25);

  let plays = Array.from(found.entries()).map(([key, value]) => ({
    key,
    moves: value.moves,
    board: value.board,
  }));

  if (options.largerDieRule && dice.length === 2 && dice[0] !== dice[1] && maxUsed === 1) {
    const larger = Math.max(dice[0], dice[1]) as DieValue;
    const usingLarger = plays.filter((play) => play.moves[0]?.die === larger);
    if (usingLarger.length > 0) plays = usingLarger;
  }
  return plays;
}

/** Number of dice the player must use this turn (0 when blocked). */
export function requiredMoveCount(board: BoardState, player: Player, roll: DiceRoll): number {
  return maxDiceUsable(board, player, movesForRoll(roll));
}
