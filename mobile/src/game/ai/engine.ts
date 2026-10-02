import { opponentOf } from '../board/board';
import { ALL_ROLLS, type DiceRoll } from '../dice/dice';
import { getLegalPlays, type LegalPlay } from '../rules/plays';
import type { BoardState, Player } from '../types';

import { evaluatePosition } from './evaluate';
import { evaluateNetwork, type Network } from './network';

/**
 * The single place that decides how positions are judged. It uses the trained
 * network when one is installed and falls back to the heuristic evaluator.
 *
 * Equity is from the point of view of `player`, who has just moved, in points
 * per game (+1 = sure single win, -1 = sure single loss).
 */
let network: Network | null = null;

export function installNetwork(net: Network | null) {
  network = net;
}

export function hasNetwork(): boolean {
  return network !== null;
}

export function equityAfterMove(board: BoardState, player: Player): number {
  if (network) return evaluateNetwork(network, board, player).equity;
  return 2 * evaluatePosition(board, player) - 1;
}

/** Win probability for `player` (who just moved), used for cube decisions. */
export function winProbabilityAfterMove(board: BoardState, player: Player): number {
  if (network) return evaluateNetwork(network, board, player).win;
  return evaluatePosition(board, player);
}

export interface EquityRankedPlay {
  play: LegalPlay;
  equity: number;
}

export function rankByEquity(board: BoardState, player: Player, roll: DiceRoll): EquityRankedPlay[] {
  return getLegalPlays(board, player, roll)
    .map((play) => ({ play, equity: equityAfterMove(play.board, player) }))
    .sort((a, b) => b.equity - a.equity);
}

/** Averages the opponent's best reply over all 21 rolls (2-ply). */
export function lookaheadEquity(board: BoardState, player: Player): number {
  const opponent = opponentOf(player);
  let total = 0;
  for (const { dice, weight } of ALL_ROLLS) {
    let best = -Infinity;
    for (const reply of getLegalPlays(board, opponent, dice)) {
      const value = equityAfterMove(reply.board, opponent);
      if (value > best) best = value;
    }
    total += -best * weight;
  }
  return total / 36;
}

/** Refines the strongest 1-ply candidates with a 2-ply search. */
export function rankByEquityDeep(board: BoardState, player: Player, roll: DiceRoll, candidates = 5): EquityRankedPlay[] {
  const shallow = rankByEquity(board, player, roll);
  if (shallow.length <= 1) return shallow;
  const best = shallow[0].equity;
  return shallow
    .filter((entry, index) => index < candidates && best - entry.equity < 0.25)
    .map(({ play }) => ({ play, equity: lookaheadEquity(play.board, player) }))
    .sort((a, b) => b.equity - a.equity);
}

/** Chance that `player` wins when it is their turn to roll. */
export function winChanceOnRoll(board: BoardState, player: Player): number {
  let total = 0;
  for (const { dice, weight } of ALL_ROLLS) {
    let best = -Infinity;
    for (const play of getLegalPlays(board, player, dice)) {
      const value = winProbabilityAfterMove(play.board, player);
      if (value > best) best = value;
    }
    total += best * weight;
  }
  return total / 36;
}
