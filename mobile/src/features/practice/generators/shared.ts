import type { ChoiceOption } from '@/curriculum';
import { formatPlay, type BoardSpec, type CheckerMove, type DieValue, type Rng } from '@/game';

/**
 * Small helpers for drill generators. Generators build positions from a
 * seeded random source and let the rules engine decide every answer, so a
 * generated exercise is as trustworthy as a hand-written one.
 */

export const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)];

export const int = (rng: Rng, min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));

export const die = (rng: Rng): DieValue => int(rng, 1, 6) as DieValue;

export function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Keeps drawing until `make` succeeds; a bad draw never stalls a session. */
export function attempt<T>(tries: number, make: () => T | null): T | null {
  for (let i = 0; i < tries; i++) {
    const result = make();
    if (result) return result;
  }
  return null;
}

/** Where a point sits from the learner's side of the board, for hints. */
export function whereIs(point: number): string {
  if (point <= 6) return 'bottom right, in your home board';
  if (point <= 12) return 'bottom left';
  if (point <= 18) return 'top left';
  return 'top right, in their home board';
}

/** A point as the opponent counts it: your 20-point is their 5-point. */
export const theirPoint = (point: number): number => 25 - point;

export const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

/** "6 + 6 + 4 + 2" for a sum the learner should be able to follow. */
export const additions = (values: readonly number[]): string => values.join(' + ');

/** Every checker as its own term, highest first: { 6: 2, 4: 1 } → [6, 6, 4]. */
export function pipTerms(placement: Record<number, number>, count: (point: number) => number = (point) => point): number[] {
  return Object.entries(placement)
    .flatMap(([point, checkers]) => Array.from({ length: checkers }, () => count(Number(point))))
    .sort((a, b) => b - a);
}

export const notation = (moves: readonly CheckerMove[]): string => formatPlay('player1', moves);

/** A dice pair in the order the prompt shows it. */
export const diceText = (a: number, b: number): string => `**${Math.max(a, b)}-${Math.min(a, b)}**`;

/**
 * Numeric choice: the right value and two distractors, in random order. Each
 * option explains itself, and the wrong ones point at the likely slip.
 */
export function numberOptions(
  rng: Rng,
  correct: number,
  distractors: readonly number[],
  label: (value: number) => string,
  explain: (value: number) => string,
): ChoiceOption[] {
  const values = [correct];
  for (const value of distractors) {
    if (values.length >= 3) break;
    if (value > 0 && !values.includes(value)) values.push(value);
  }
  for (let step = 2; values.length < 3; step += 2) {
    if (!values.includes(correct + step)) values.push(correct + step);
  }
  return shuffled(rng, values).map((value) => ({
    id: String(value),
    text: label(value),
    correct: value === correct || undefined,
    explanation: explain(value),
  }));
}

/** Adds `count` checkers to a placement (merging with what's there). */
export function place(placement: Record<number, number>, point: number, count = 1): Record<number, number> {
  return { ...placement, [point]: (placement[point] ?? 0) + count };
}

export const occupied = (spec: BoardSpec, point: number): boolean =>
  (spec.player1?.[point] ?? 0) > 0 || (spec.player2?.[point] ?? 0) > 0;

/** Checkers a placement holds. */
export const total = (placement: Record<number, number> = {}): number => sum(Object.values(placement));
