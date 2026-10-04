import { dayKey, daysBetween, shiftDay } from '@/features/learning/progression';
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
  /*
   * Spaced repetition. Saves from before it lack these fields: such a mistake
   * is simply due now, with its earlier correct answers as its run.
   */
  /** Right on the first try this many times in a row, each on a different day. */
  streak?: number;
  /** Times answered wrong in practice. */
  wrong?: number;
  /** The day it comes back (YYYY-MM-DD). */
  dueDay?: string;
  /** The day of the last right answer: answering again that day doesn't count twice. */
  lastCorrectDay?: string | null;
}

export const MAX_MISTAKES = 100;
/** Right answers needed before spaced repetition (the rule saves from before it were mastered by). */
export const MASTERED_AFTER = 2;
/** Right on this many separate days in a row, with growing gaps: the lesson has stuck. */
export const MASTERED_STREAK = 3;

/**
 * Days until a mistake comes back, by its run of right answers: soon while
 * it's new, then further apart each time it's remembered.
 */
export const REVIEW_INTERVALS = [0, 1, 3, 7, 16, 35];

/** The run of right answers (saves from before spaced repetition use their right-answer count). */
export function streakOf(mistake: UserMistake): number {
  if (typeof mistake.streak === 'number') return mistake.streak;
  return mistake.solved >= MASTERED_AFTER ? MASTERED_STREAK : mistake.solved;
}

export const isMastered = (mistake: UserMistake) => streakOf(mistake) >= MASTERED_STREAK;

/** The day a mistake is due: its schedule, or the day it was made. */
export function dueDayOf(mistake: UserMistake): string {
  if (typeof mistake.dueDay === 'string') return mistake.dueDay;
  const created = new Date(mistake.createdAt);
  return Number.isNaN(created.getTime()) ? '0000-00-00' : dayKey(created);
}

/** Due today or earlier, and not yet mastered. */
export const isDue = (mistake: UserMistake, today: string) => !isMastered(mistake) && dueDayOf(mistake) <= today;

/** Unmastered mistakes that are due, most overdue first, then the most costly. */
export function dueMistakes(mistakes: readonly UserMistake[], today: string): UserMistake[] {
  return mistakes
    .filter((mistake) => isDue(mistake, today))
    .sort((a, b) => dueDayOf(a).localeCompare(dueDayOf(b)) || b.severity - a.severity);
}

/** When the next unmastered mistake comes back, if none is due now (null when nothing is waiting). */
export function nextDueDay(mistakes: readonly UserMistake[], today: string): string | null {
  const upcoming = mistakes.filter((mistake) => !isMastered(mistake) && dueDayOf(mistake) > today).map(dueDayOf).sort();
  return upcoming[0] ?? null;
}

/** "tomorrow", "in 3 days": how far away a day is. */
export function dueIn(day: string, today: string): string {
  const days = daysBetween(today, day);
  if (days <= 0) return 'today';
  return days === 1 ? 'tomorrow' : `in ${days} days`;
}

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
      streak: 0,
      wrong: 0,
      // A fresh mistake comes back the same day, while the game is still in mind.
      dueDay: dayKey(new Date(now)),
      lastCorrectDay: null,
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

/**
 * The next mistakes to practise: the ones due (most overdue first, then the
 * most costly), then the ones coming up soonest, so a session is never empty
 * while something is left to learn.
 */
export function pickForPractice(mistakes: UserMistake[], count: number, today: string): UserMistake[] {
  const due = dueMistakes(mistakes, today);
  const upcoming = mistakes
    .filter((mistake) => !isMastered(mistake) && !isDue(mistake, today))
    .sort((a, b) => dueDayOf(a).localeCompare(dueDayOf(b)) || b.severity - a.severity);
  return [...due, ...upcoming].slice(0, count);
}

/** A practice run that starts with one chosen position (from a game review), then the usual picks. */
export function withFocus(picks: UserMistake[], all: UserMistake[], focusId: string | undefined, count: number): UserMistake[] {
  const focus = focusId ? all.find((mistake) => mistake.id === focusId) : undefined;
  if (!focus) return picks;
  return [focus, ...picks.filter((mistake) => mistake.id !== focus.id)].slice(0, count);
}

/**
 * One practice answer. Right on the first try: the run grows (once per day)
 * and the mistake comes back later. Wrong: the run starts over and it comes
 * back tomorrow.
 */
export function recordAttempt(mistake: UserMistake, correct: boolean, now: string): UserMistake {
  const today = dayKey(new Date(now));
  const practised = { ...mistake, attempts: mistake.attempts + 1, lastPracticedAt: now };
  if (!correct) {
    return { ...practised, streak: 0, wrong: (mistake.wrong ?? 0) + 1, dueDay: shiftDay(today, 1) };
  }
  if (mistake.lastCorrectDay === today) return { ...practised, solved: mistake.solved + 1 };
  const streak = streakOf(mistake) + 1;
  const interval = REVIEW_INTERVALS[Math.min(streak, REVIEW_INTERVALS.length - 1)];
  return { ...practised, solved: mistake.solved + 1, streak, lastCorrectDay: today, dueDay: shiftDay(today, interval) };
}

/** A saved mistake with its spaced-repetition fields readable (anything malformed starts fresh). */
export function sanitizeMistake(mistake: UserMistake): UserMistake {
  const clean = { ...mistake };
  if (typeof clean.streak !== 'number' || !Number.isFinite(clean.streak)) delete clean.streak;
  if (typeof clean.wrong !== 'number' || !Number.isFinite(clean.wrong)) delete clean.wrong;
  if (typeof clean.dueDay !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(clean.dueDay)) delete clean.dueDay;
  if (clean.lastCorrectDay !== null && typeof clean.lastCorrectDay !== 'string') delete clean.lastCorrectDay;
  return clean;
}
