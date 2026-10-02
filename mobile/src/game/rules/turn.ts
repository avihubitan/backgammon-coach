import { isDouble, movesForRoll, type DiceRoll } from '../dice/dice';
import type { BoardState, CheckerMove, DieValue, MoveSource, MoveTarget, Player } from '../types';
import { applyMove, hasBorneOffAll, legalSingleMoves, sameMove } from './movement';
import { maxDiceUsable } from './plays';

/**
 * Tracks a turn while it is being played one checker at a time, which is how
 * people actually move on a board (and how the UI works).
 */
export interface TurnState {
  player: Player;
  /** The roll being played, or null for lesson exercises that use custom dice (e.g. a single die). */
  roll: DiceRoll | null;
  /** Every die available at the start of the turn (doubles expanded to four). */
  dice: DieValue[];
  startBoard: BoardState;
  board: BoardState;
  /** Dice values not yet used. */
  remaining: DieValue[];
  moves: CheckerMove[];
  /** How many dice must be played in total this turn. */
  requiredMoves: number;
}

export function startTurn(board: BoardState, player: Player, roll: DiceRoll): TurnState {
  const dice = movesForRoll(roll);
  return {
    player,
    roll,
    dice,
    startBoard: board,
    board,
    remaining: dice,
    moves: [],
    requiredMoves: maxDiceUsable(board, player, dice),
  };
}

/**
 * Starts a turn with an arbitrary list of dice, used by lessons such as
 * "move this checker 5 spaces" where only one die is in play.
 */
export function startCustomTurn(board: BoardState, player: Player, dice: DieValue[]): TurnState {
  return {
    player,
    roll: null,
    dice: dice.slice(),
    startBoard: board,
    board,
    remaining: dice.slice(),
    moves: [],
    requiredMoves: maxDiceUsable(board, player, dice),
  };
}

function withoutOne(dice: readonly DieValue[], die: DieValue): DieValue[] {
  const index = dice.indexOf(die);
  return index < 0 ? dice.slice() : [...dice.slice(0, index), ...dice.slice(index + 1)];
}

/** True when the player has used every die they are obliged to use (or has already won). */
export function isTurnComplete(turn: TurnState): boolean {
  return turn.moves.length >= turn.requiredMoves || hasBorneOffAll(turn.board, turn.player);
}

/**
 * Single-checker moves that are legal right now, taking the whole-turn rules
 * into account (a move is only allowed if the rest of the roll can still be
 * played as fully as possible).
 */
export function legalMovesNow(turn: TurnState): CheckerMove[] {
  if (isTurnComplete(turn)) return [];
  const needed = turn.requiredMoves - turn.moves.length;
  const result: CheckerMove[] = [];
  const seen = new Set<string>();
  for (const die of Array.from(new Set(turn.remaining))) {
    for (const move of legalSingleMoves(turn.board, turn.player, die)) {
      const next = applyMove(turn.board, turn.player, move);
      const rest = withoutOne(turn.remaining, die);
      const continuation = hasBorneOffAll(next, turn.player)
        ? needed - 1
        : maxDiceUsable(next, turn.player, rest);
      if (continuation < needed - 1) continue;
      const key = `${move.from}>${move.to}:${move.die}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(move);
    }
  }
  // If only one die of a non-double can be played, the larger one must be used.
  if (turn.roll && turn.requiredMoves === 1 && turn.moves.length === 0 && !isDouble(turn.roll)) {
    const larger = Math.max(turn.roll[0], turn.roll[1]);
    const withLarger = result.filter((move) => move.die === larger);
    if (withLarger.length > 0) return withLarger;
  }
  return result;
}

export function isMoveLegalNow(turn: TurnState, move: Pick<CheckerMove, 'from' | 'to' | 'die'>): boolean {
  return legalMovesNow(turn).some((candidate) => sameMove(candidate, move));
}

/** Plays a move, throwing if it is not legal right now. */
export function playMove(turn: TurnState, move: Pick<CheckerMove, 'from' | 'to' | 'die'>): TurnState {
  const legal = legalMovesNow(turn).find((candidate) => sameMove(candidate, move));
  if (!legal) {
    throw new Error(`Illegal move ${String(move.from)}->${String(move.to)} with ${move.die}`);
  }
  return {
    ...turn,
    board: applyMove(turn.board, turn.player, legal),
    remaining: withoutOne(turn.remaining, legal.die),
    moves: [...turn.moves, legal],
  };
}

/** Rebuilds the turn without its last move. */
export function undoLastMove(turn: TurnState): TurnState {
  if (turn.moves.length === 0) return turn;
  const moves = turn.moves.slice(0, -1);
  let board = turn.startBoard;
  let remaining = turn.dice.slice();
  for (const move of moves) {
    board = applyMove(board, turn.player, move);
    remaining = withoutOne(remaining, move.die);
  }
  return { ...turn, board, remaining, moves };
}

/** Legal destinations for a checker on `from`, grouped for UI highlighting. */
export function destinationsFrom(turn: TurnState, from: MoveSource): CheckerMove[] {
  return legalMovesNow(turn).filter((move) => move.from === from);
}

/** Legal moves that end on `to`, used for "tap the destination" shortcuts. */
export function movesTo(turn: TurnState, to: MoveTarget): CheckerMove[] {
  return legalMovesNow(turn).filter((move) => move.to === to);
}

/** All sources that currently have at least one legal move. */
export function movableSources(turn: TurnState): MoveSource[] {
  return Array.from(new Set(legalMovesNow(turn).map((move) => move.from)));
}
