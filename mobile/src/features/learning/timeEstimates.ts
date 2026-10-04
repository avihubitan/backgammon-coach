import { isScored, type Lesson } from '@/curriculum';

/**
 * About how long each kind of session takes, for the "2 min" labels on
 * recommendations. Rough by design: reading a short explanation takes about
 * 15 seconds and an exercise with its feedback about 25; drill questions are
 * built to take 10–30 seconds.
 */
const READ_SECONDS = 15;
const ANSWER_SECONDS = 25;
/** A position from your own game: think, answer, read why. */
const REVIEW_SECONDS = 40;

export function lessonMinutes(lesson: Lesson): number {
  const seconds = lesson.steps.reduce((sum, step) => sum + (isScored(step) ? ANSWER_SECONDS : READ_SECONDS), 0);
  return Math.max(1, Math.round(seconds / 60));
}

/** A drill session: five questions. */
export const DRILL_MINUTES = 2;

/** One "What would you play?" position. */
export const POSITION_MINUTES = 1;

/** A review of positions from your games (a session holds at most five). */
export const reviewMinutes = (positions: number): number => Math.max(1, Math.round((Math.min(positions, 5) * REVIEW_SECONDS) / 60));
