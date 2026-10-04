import type { DrillCategoryInfo, DrillLevel } from '@/curriculum/drills';
import type { Rng } from '@/game';

/**
 * How a drill moves up: each level opens once its lesson is done, and the
 * next one takes over when this one is answered well. Pure, so sessions are
 * predictable and testable.
 */

export interface LevelStats {
  attempted: number;
  firstTry: number;
}

/** A level is cleared after this many answers with this share right on the first try. */
export const LEVEL_UP = { answers: 5, accuracy: 0.8 };

export function levelCleared(stats: LevelStats | undefined): boolean {
  return !!stats && stats.attempted >= LEVEL_UP.answers && stats.firstTry >= LEVEL_UP.accuracy * stats.attempted;
}

export type LessonDone = (lessonId: string) => boolean;

/** Levels whose lesson the learner has done, easiest first. */
export function openLevels(info: DrillCategoryInfo, done: LessonDone): DrillLevel[] {
  return info.levels.filter((level) => !level.requiresLesson || done(level.requiresLesson));
}

export interface LevelProgress {
  /** The level being worked on (the last open one once every level is cleared). */
  level: DrillLevel;
  /** 1-based position of that level among all of the drill's levels. */
  number: number;
  of: number;
  /** Every open level is cleared. */
  allCleared: boolean;
}

export function levelProgress(
  info: DrillCategoryInfo,
  done: LessonDone,
  stats: Partial<Record<string, LevelStats>>,
): LevelProgress | null {
  const open = openLevels(info, done);
  if (open.length === 0) return null;
  const current = open.find((level) => !levelCleared(stats[level.id]));
  const level = current ?? open[open.length - 1];
  return { level, number: info.levels.indexOf(level) + 1, of: info.levels.length, allCleared: !current };
}

/**
 * Which level each question of a session comes from: the current level, with
 * one question from a level already cleared so it doesn't fade. Once every
 * open level is cleared, questions come from all of them.
 */
export function planLevels(
  info: DrillCategoryInfo,
  done: LessonDone,
  stats: Partial<Record<string, LevelStats>>,
  length: number,
  rng: Rng,
): DrillLevel[] {
  const open = openLevels(info, done);
  if (open.length === 0) return [];
  if (info.mixLevels) {
    // A routine: every open question, newest first so the latest lesson gets rehearsed.
    const order = [...open].reverse();
    const start = Math.floor(rng() * order.length);
    return Array.from({ length }, (_, slot) => (slot === 0 ? order[0] : order[(start + slot) % order.length]));
  }
  const progress = levelProgress(info, done, stats)!;
  if (progress.allCleared) return Array.from({ length }, () => open[Math.floor(rng() * open.length)]);
  const slots = Array.from({ length }, () => progress.level);
  const cleared = open.filter((level) => levelCleared(stats[level.id]));
  if (cleared.length > 0 && length >= 3) slots[2] = cleared[Math.floor(rng() * cleared.length)];
  return slots;
}
