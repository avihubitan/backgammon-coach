import { checkersAt, opponentOf, pipDistance, pointAtDistance } from '../board/board';
import { ALL_ROLLS } from '../dice/dice';
import type { BoardState, Player } from '../types';

/**
 * How exposed a player's blots are to the opponent's next roll.
 *
 * Distances are measured in the attacker's own coordinates (24 = their back,
 * 1 = deepest home point, 25 = their bar), so an attacker checker at distance
 * `s` hits a blot at distance `b` by travelling exactly `s - b` pips.
 */
export interface Exposure {
  /** Rolls out of 36 that hit at least one blot. */
  hittingRolls: number;
  /** Chance (0..1) of being hit. */
  probability: number;
  /** Average pips lost to the hit, weighted over all 36 rolls. */
  expectedPipLoss: number;
}

export function exposure(board: BoardState, defender: Player): Exposure {
  const attacker = opponentOf(defender);
  const blots: { distance: number; loss: number }[] = [];
  for (let point = 1; point <= 24; point++) {
    if (checkersAt(board, point, defender) === 1) {
      // A hit sends the blot back to the bar: it loses the ground it covered.
      blots.push({ distance: pipDistance(attacker, point), loss: 25 - pipDistance(defender, point) });
    }
  }
  if (blots.length === 0) return { hittingRolls: 0, probability: 0, expectedPipLoss: 0 };

  const blocked = (distance: number) =>
    distance >= 1 && distance <= 24 && checkersAt(board, pointAtDistance(attacker, distance), defender) >= 2;

  const sources: number[] = [];
  for (let point = 1; point <= 24; point++) {
    if (checkersAt(board, point, attacker) > 0) sources.push(pipDistance(attacker, point));
  }
  const onBar = board.bar[attacker];

  let hittingRolls = 0;
  let lossSum = 0;
  for (const { dice, weight } of ALL_ROLLS) {
    const [a, b] = dice;
    const reach = new Set<number>();
    const addPath = (from: number, steps: number[]) => {
      let at = from;
      for (const step of steps) {
        at -= step;
        if (at < 1 || blocked(at)) return;
        reach.add(at);
      }
    };
    if (onBar > 0) {
      // Entering checkers hit on entry; a single bar checker may continue with the other die.
      if (a === b) {
        addPath(25, onBar === 1 ? [a, a, a, a] : [a]);
        if (onBar < 4 && !blocked(25 - a)) for (const s of sources) addPath(s, Array(4 - onBar).fill(a));
      } else {
        addPath(25, onBar === 1 ? [a, b] : [a]);
        addPath(25, onBar === 1 ? [b, a] : [b]);
        if (onBar === 1) {
          if (!blocked(25 - a)) for (const s of sources) addPath(s, [b]);
          if (!blocked(25 - b)) for (const s of sources) addPath(s, [a]);
        }
      }
    } else if (a === b) {
      for (const s of sources) addPath(s, [a, a, a, a]);
    } else {
      for (const s of sources) {
        addPath(s, [a, b]);
        addPath(s, [b, a]);
      }
    }
    let worst = 0;
    for (const blot of blots) if (reach.has(blot.distance)) worst = Math.max(worst, blot.loss);
    if (worst > 0) {
      hittingRolls += weight;
      lossSum += worst * weight;
    }
  }
  return { hittingRolls, probability: hittingRolls / 36, expectedPipLoss: lossSum / 36 };
}
