import { checkersAt, hasContact, opponentOf, pipCount, pointAtDistance } from '../board/board';
import { hasBorneOffAll } from '../rules/movement';
import type { BoardState, Player } from '../types';

import { exposure, type Exposure } from './shots';

/**
 * Heuristic evaluation. All values are from the point of view of `player`,
 * who has just finished moving; the opponent is about to roll.
 *
 * The result is an estimated probability that `player` wins. It is a
 * hand-tuned model rather than a neural network, which keeps it explainable:
 * the same features power the coach's explanations.
 */

/** Value of owning a point, indexed by distance from home (1..24) from the owner's view. */
const POINT_VALUE = [
  0, 0.25, 0.4, 0.6, 0.85, 1.0, 0.9, 0.75, 0.35, 0.2, 0.15, 0.1, 0.05, 0.2, 0.05, 0.05, 0.05, 0.05, 0.25,
  0.35, 0.65, 0.55, 0.3, 0.2, 0.15,
];

const PRIME_VALUE = [0, 0, 0.15, 0.4, 0.9, 1.7, 2.8];

export interface PositionFeatures {
  pips: number;
  opponentPips: number;
  contact: boolean;
  blots: number;
  exposure: Exposure;
  madePoints: number;
  homePoints: number;
  opponentHomePoints: number;
  pointScore: number;
  primeLength: number;
  /** Opponent checkers stuck behind that prime. */
  trapped: number;
  anchors: number;
  backCheckers: number;
  onBar: number;
  opponentOnBar: number;
  borneOff: number;
  opponentBorneOff: number;
  opponentBlots: number;
  stacking: number;
  /** Checkers already buried on the 1- and 2-points (out of play early on). */
  deadCheckers: number;
  /** Distinct points 4..11 holding a checker that could help make a new point. */
  builders: number;
}

function longestPrime(board: BoardState, player: Player): { length: number; start: number } {
  let best = { length: 0, start: 0 };
  let run = 0;
  for (let distance = 1; distance <= 24; distance++) {
    if (checkersAt(board, pointAtDistance(player, distance), player) >= 2) {
      run += 1;
      if (run > best.length) best = { length: run, start: distance - run + 1 };
    } else {
      run = 0;
    }
  }
  return best;
}

function homeStrength(board: BoardState, player: Player): number {
  let made = 0;
  for (let distance = 1; distance <= 6; distance++) {
    if (checkersAt(board, pointAtDistance(player, distance), player) >= 2) made += 1;
  }
  return made;
}

export function extractFeatures(board: BoardState, player: Player): PositionFeatures {
  const opponent = opponentOf(player);
  let blots = 0;
  let madePoints = 0;
  let pointScore = 0;
  let anchors = 0;
  let backCheckers = 0;
  let opponentBlots = 0;
  let stacking = 0;
  let deadCheckers = 0;
  let builders = 0;
  const opponentBehind: number[] = [];
  for (let distance = 1; distance <= 24; distance++) {
    const point = pointAtDistance(player, distance);
    const mine = checkersAt(board, point, player);
    const theirs = checkersAt(board, point, opponent);
    if (mine === 1) blots += 1;
    if (mine >= 2) {
      madePoints += 1;
      pointScore += POINT_VALUE[distance];
      if (distance >= 19) anchors += 1;
    }
    if (mine > 3) stacking += mine - 3;
    if (distance <= 2) deadCheckers += mine;
    if (mine > 0 && distance >= 4 && distance <= 11) builders += 1;
    if (distance >= 19) backCheckers += mine;
    if (theirs === 1) opponentBlots += 1;
    if (theirs > 0) opponentBehind.push(distance);
  }
  const prime = longestPrime(board, player);
  // Opponent checkers sitting below the prime (in my coordinates) must still get past it.
  const trapped = prime.length >= 3
    ? opponentBehind.filter((d) => d < prime.start).reduce((sum, d) => sum + checkersAt(board, pointAtDistance(player, d), opponent), 0) + board.bar[opponent]
    : 0;
  return {
    pips: pipCount(board, player),
    opponentPips: pipCount(board, opponent),
    contact: hasContact(board),
    blots,
    exposure: exposure(board, player),
    madePoints,
    homePoints: homeStrength(board, player),
    opponentHomePoints: homeStrength(board, opponent),
    pointScore,
    primeLength: prime.length,
    trapped,
    anchors,
    backCheckers,
    onBar: board.bar[player],
    opponentOnBar: board.bar[opponent],
    borneOff: board.off[player],
    opponentBorneOff: board.off[opponent],
    opponentBlots,
    stacking,
    deadCheckers,
    builders,
  };
}

const normalCdf = (z: number) => {
  // Abramowitz–Stegun approximation of the standard normal CDF.
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
};

/** Chance that the player on roll wins a pure race. */
export function raceWinProbability(rollerPips: number, otherPips: number): number {
  if (rollerPips <= 0) return 1;
  if (otherPips <= 0) return 0;
  // Being on roll is worth about half a roll (~4 pips); spread grows with race length.
  const lead = otherPips - rollerPips + 4;
  const spread = 1.43 * Math.sqrt(rollerPips + otherPips);
  return normalCdf(lead / spread);
}

const logistic = (x: number) => 1 / (1 + Math.exp(-x));

function structure(me: PositionFeatures, them: PositionFeatures): number {
  const prime = PRIME_VALUE[Math.min(6, me.primeLength)] * (me.trapped > 0 ? 1 : 0.35);
  return (
    0.42 * me.pointScore +
    0.55 * prime +
    0.18 * me.anchors -
    0.11 * me.backCheckers * (1 + 0.25 * them.homePoints) -
    0.05 * me.stacking -
    0.05 * me.blots -
    0.06 * me.deadCheckers +
    0.035 * me.builders
  );
}

function risk(exposed: PositionFeatures, attacker: PositionFeatures): number {
  // What a hit costs is mostly the ground lost (a blot deep in my home board
  // loses ~20 pips, one on the opponent's side almost none) plus a little tempo,
  // and more when the attacker's home board is hard to re-enter.
  return (
    exposed.exposure.probability * (0.08 + 0.07 * attacker.homePoints) +
    exposed.exposure.expectedPipLoss * 0.024
  );
}

/**
 * Linear score for contact positions (positive is good for `me`). `me` has just
 * moved and `them` is on roll, so my blots are in immediate danger while theirs
 * may still be tidied up before I can attack them.
 */
export function contactScore(me: PositionFeatures, them: PositionFeatures): number {
  const pipEdge = (them.pips - me.pips - 4) / 22;
  return (
    pipEdge +
    structure(me, them) -
    structure(them, me) -
    1.6 * risk(me, them) +
    0.45 * risk(them, me) +
    them.onBar * (0.35 + 0.16 * me.homePoints) -
    me.onBar * (0.35 + 0.16 * them.homePoints) +
    0.06 * (me.borneOff - them.borneOff)
  );
}

/** Estimated chance that `player` (who just moved) wins, with the opponent to roll. */
export function evaluatePosition(board: BoardState, player: Player): number {
  if (hasBorneOffAll(board, player)) return 1;
  const opponent = opponentOf(player);
  if (hasBorneOffAll(board, opponent)) return 0;
  if (!hasContact(board)) {
    return 1 - raceWinProbability(pipCount(board, opponent) + wastage(board, opponent), pipCount(board, player) + wastage(board, player));
  }
  return logistic(contactScore(extractFeatures(board, player), extractFeatures(board, opponent)));
}

/**
 * Pips a player effectively wastes in the bear-off: gaps and stacks on low
 * points mean big numbers are partly lost. A small correction to the race formula.
 */
function wastage(board: BoardState, player: Player): number {
  let checkers = 0;
  let low = 0;
  for (let distance = 1; distance <= 6; distance++) {
    const n = checkersAt(board, pointAtDistance(player, distance), player);
    checkers += n;
    if (distance <= 2) low += n;
  }
  const outside = pipCount(board, player) > 0 ? 1 : 0;
  return outside * (checkers * 0.2 + low * 0.5);
}

