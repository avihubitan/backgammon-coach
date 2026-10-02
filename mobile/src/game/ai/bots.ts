import type { DiceRoll, Rng } from '../dice/dice';
import { getLegalPlays, type LegalPlay } from '../rules/plays';
import type { BoardState, CubeState, Player } from '../types';

import {
  hasNetwork,
  rankByEquity,
  rankByEquityDeep,
  rankByHeuristic,
  winChanceOnRoll,
  type EquityRankedPlay,
} from './engine';
import { evaluatePosition } from './evaluate';
import { openingBookPlay } from './openings';

export type AiLevel = 'beginner' | 'intermediate' | 'advanced';

export interface RankedPlay {
  play: LegalPlay;
  /** Heuristic chance that the mover wins after this play. */
  equity: number;
}

/** Ranks plays with the hand-written heuristic only (useful for comparisons and tests). */
export function rankPlays(board: BoardState, player: Player, roll: DiceRoll): RankedPlay[] {
  return getLegalPlays(board, player, roll)
    .map((play) => ({ play, equity: evaluatePosition(play.board, player) }))
    .sort((a, b) => b.equity - a.equity);
}

function softmaxPick(ranked: EquityRankedPlay[], temperature: number, rng: Rng): LegalPlay {
  const best = ranked[0].equity;
  const weights = ranked.map((entry) => Math.exp((entry.equity - best) / temperature));
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = rng() * sum;
  for (let i = 0; i < ranked.length; i++) {
    r -= weights[i];
    if (r <= 0) return ranked[i].play;
  }
  return ranked[0].play;
}

/**
 * Picks a play for the computer.
 * - beginner: sensible but often imprecise (human-like mistakes)
 * - intermediate: the heuristic's best play, with the opening book
 * - advanced: the trained network's best play (2-ply heuristic search
 *   when no network is installed)
 *
 * The gentler levels stay on the heuristic on purpose: they are tuned to
 * be beatable by someone who has just learned the rules.
 */
export function chooseAiPlay(board: BoardState, player: Player, roll: DiceRoll, level: AiLevel, rng: Rng): LegalPlay {
  const plays = getLegalPlays(board, player, roll);
  if (plays.length === 1) return plays[0];
  if (level !== 'beginner') {
    const book = openingBookPlay(board, player, roll);
    if (book) return book;
  }
  if (level === 'beginner') return softmaxPick(rankByHeuristic(board, player, roll).slice(0, 8), 0.07, rng);
  if (level === 'intermediate') return softmaxPick(rankByHeuristic(board, player, roll).slice(0, 3), 0.008, rng);
  if (hasNetwork()) return rankByEquity(board, player, roll)[0].play;
  return rankByEquityDeep(board, player, roll)[0].play;
}

const DOUBLE_WINDOW: Record<AiLevel, [number, number]> = {
  beginner: [0.8, 0.95],
  intermediate: [0.7, 0.88],
  advanced: [0.68, 0.86],
};

const TAKE_THRESHOLD: Record<AiLevel, number> = {
  beginner: 0.14,
  intermediate: 0.22,
  advanced: 0.235,
};

/** Should the computer offer a double before rolling? */
export function aiShouldDouble(board: BoardState, player: Player, cube: CubeState, level: AiLevel): boolean {
  if (cube.owner !== null && cube.owner !== player) return false;
  const [low, high] = DOUBLE_WINDOW[level];
  const chance = winChanceOnRoll(board, player);
  // Above the window the position is "too good": playing on for a gammon is better.
  return chance >= low && chance <= high;
}

/** Should the computer take a double offered by `doubler`? */
export function aiShouldTake(board: BoardState, doubler: Player, level: AiLevel): boolean {
  return 1 - winChanceOnRoll(board, doubler) >= TAKE_THRESHOLD[level];
}
