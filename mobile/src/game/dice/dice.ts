import type { DieValue } from '../types';

/** A source of uniformly distributed numbers in [0, 1). */
export type Rng = () => number;

export type DiceRoll = [DieValue, DieValue];

/**
 * Small, fast, seedable PRNG (mulberry32). Deterministic seeds make games
 * replayable and tests reproducible.
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const defaultRng: Rng = Math.random;

export function rollDie(rng: Rng = defaultRng): DieValue {
  return (Math.floor(rng() * 6) + 1) as DieValue;
}

export function rollDice(rng: Rng = defaultRng): DiceRoll {
  return [rollDie(rng), rollDie(rng)];
}

export function isDouble(dice: readonly DieValue[]): boolean {
  return dice.length === 2 && dice[0] === dice[1];
}

/** The individual moves a roll grants: doubles are played four times. */
export function movesForRoll(dice: DiceRoll): DieValue[] {
  return isDouble(dice) ? [dice[0], dice[0], dice[0], dice[0]] : [dice[0], dice[1]];
}

export interface WeightedRoll {
  dice: DiceRoll;
  /** Probability out of 36 (1 for doubles, 2 for other rolls). */
  weight: 1 | 2;
}

/** The 21 distinct rolls with their frequencies out of 36. */
export const ALL_ROLLS: readonly WeightedRoll[] = (() => {
  const rolls: WeightedRoll[] = [];
  for (let a = 1; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      rolls.push({ dice: [b as DieValue, a as DieValue], weight: a === b ? 1 : 2 });
    }
  }
  return rolls;
})();

export const DIE_VALUES: readonly DieValue[] = [1, 2, 3, 4, 5, 6];

export function isDieValue(value: unknown): value is DieValue {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 6;
}
