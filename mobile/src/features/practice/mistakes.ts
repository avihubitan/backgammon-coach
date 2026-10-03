import type { BoardState, CheckerMove, DiceRoll, GameReview, MistakeCategory } from '@/game';

/** A position the learner got wrong in a real game, saved for practice. */
export interface UserMistake {
  id: string;
  gameId: string;
  createdAt: string;
  position: BoardState;
  dice: DiceRoll;
  selectedMove: CheckerMove[];
  recommendedMove: CheckerMove[];
  category: MistakeCategory;
  /** Equity lost by the played move (points per game). */
  severity: number;
  headline: string;
  explanation: string;
  attempts: number;
  solved: number;
  lastPracticedAt: string | null;
}

export const MAX_MISTAKES = 100;
export const MASTERED_AFTER = 2;

export const isMastered = (mistake: UserMistake) => mistake.solved >= MASTERED_AFTER;

/** Mistakes worth practising from a reviewed game (mistakes and blunders only). */
export function mistakesFromReview(gameId: string, review: GameReview, now: string): UserMistake[] {
  return review.moves
    .filter((move) => move.severity === 'mistake' || move.severity === 'blunder')
    .map((move) => ({
      id: `${gameId}:${move.index}`,
      gameId,
      createdAt: now,
      position: move.boardBefore,
      dice: move.roll,
      selectedMove: move.played,
      recommendedMove: move.best,
      category: move.category,
      severity: move.loss,
      headline: move.headline,
      explanation: move.explanation,
      attempts: 0,
      solved: 0,
      lastPracticedAt: null,
    }));
}

/** Adds new mistakes, skipping duplicates and keeping the most useful ones when full. */
export function mergeMistakes(existing: UserMistake[], incoming: UserMistake[]): UserMistake[] {
  const known = new Set(existing.map((mistake) => mistake.id));
  const merged = [...incoming.filter((mistake) => !known.has(mistake.id)), ...existing];
  if (merged.length <= MAX_MISTAKES) return merged;
  // Drop mastered ones first, then the least severe.
  return merged
    .slice()
    .sort((a, b) => Number(isMastered(a)) - Number(isMastered(b)) || b.severity - a.severity)
    .slice(0, MAX_MISTAKES);
}

/** The next mistakes to practise: unmastered, most costly first, least recently practised. */
export function pickForPractice(mistakes: UserMistake[], count: number): UserMistake[] {
  return mistakes
    .filter((mistake) => !isMastered(mistake))
    .sort(
      (a, b) =>
        (a.lastPracticedAt ?? '').localeCompare(b.lastPracticedAt ?? '') || b.severity - a.severity,
    )
    .slice(0, count);
}

/** A practice run that starts with one chosen position (from a game review), then the usual picks. */
export function withFocus(picks: UserMistake[], all: UserMistake[], focusId: string | undefined, count: number): UserMistake[] {
  const focus = focusId ? all.find((mistake) => mistake.id === focusId) : undefined;
  if (!focus) return picks;
  return [focus, ...picks.filter((mistake) => mistake.id !== focus.id)].slice(0, count);
}

export function recordAttempt(mistake: UserMistake, correct: boolean, now: string): UserMistake {
  return {
    ...mistake,
    attempts: mistake.attempts + 1,
    solved: mistake.solved + (correct ? 1 : 0),
    lastPracticedAt: now,
  };
}
