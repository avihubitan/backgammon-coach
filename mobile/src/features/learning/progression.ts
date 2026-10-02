import { allLessons, curriculum, isScored, type Lesson, type Section } from '@/curriculum';

/**
 * Pure progression rules: XP, levels, unlocking and streaks. Stores call these;
 * nothing here touches storage or React.
 */

export interface LessonRecord {
  completed: boolean;
  bestStars: number;
  bestAccuracy: number;
  attempts: number;
  completions: number;
  firstCompletedAt: string | null;
  lastPlayedAt: string | null;
}

export type LessonRecords = Record<string, LessonRecord>;

export const emptyLessonRecord = (): LessonRecord => ({
  completed: false,
  bestStars: 0,
  bestAccuracy: 0,
  attempts: 0,
  completions: 0,
  firstCompletedAt: null,
  lastPlayedAt: null,
});

// ---------------------------------------------------------------------------
// XP and levels

/**
 * XP is earned exercise by exercise, so the "+10 XP" a learner sees after a
 * good answer is exactly what lands on their total. Finishing a lesson for
 * the first time adds the lesson's bonus (`lesson.xp`), a flawless run adds
 * a little more, and replays still reward practice at half rate.
 */
export const EXERCISE_XP = 10;
export const PERFECT_BONUS_XP = 5;

/** How one exercise went (structurally the lesson session's step outcome). */
export interface ExerciseResult {
  mistakes: number;
  solved: boolean;
  revealed: boolean;
}

export function exerciseXp(result: ExerciseResult | undefined, replay = false): number {
  if (!result || !result.solved || result.revealed) return 0;
  const base = result.mistakes === 0 ? EXERCISE_XP : EXERCISE_XP / 2;
  return replay ? Math.ceil(base / 2) : base;
}

export interface LessonXpBreakdown {
  exercises: number;
  /** One-time bonus for finishing the lesson for the first time. */
  completion: number;
  perfect: number;
  total: number;
}

export function lessonXpBreakdown(
  lesson: Lesson,
  results: Record<string, ExerciseResult>,
  outcome: { passed: boolean; stars: number },
  firstCompletion: boolean,
  replay: boolean,
): LessonXpBreakdown {
  const exercises = lesson.steps
    .filter(isScored)
    .reduce((sum, step) => sum + exerciseXp(results[step.id], replay), 0);
  const completion = outcome.passed && firstCompletion ? lesson.xp : 0;
  const perfect = outcome.passed && outcome.stars === 3 && !replay ? PERFECT_BONUS_XP : 0;
  return { exercises, completion, perfect, total: exercises + completion + perfect };
}

/** The most a first, flawless run of a lesson can earn. */
export function maxLessonXp(lesson: Lesson): number {
  return lesson.steps.filter(isScored).length * EXERCISE_XP + lesson.xp + PERFECT_BONUS_XP;
}

/** Total XP needed to reach `level` (level 1 needs 0). Each level asks for 15 XP more than the last. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  const n = level - 1;
  return 30 * n + (15 * n * (n - 1)) / 2;
}

export interface LevelInfo {
  level: number;
  /** XP earned inside the current level. */
  intoLevel: number;
  /** XP the current level spans. */
  levelSpan: number;
  progress: number;
  toNext: number;
}

export function levelInfo(xp: number): LevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  const start = xpForLevel(level);
  const end = xpForLevel(level + 1);
  return {
    level,
    intoLevel: xp - start,
    levelSpan: end - start,
    progress: (xp - start) / (end - start),
    toNext: end - xp,
  };
}

// ---------------------------------------------------------------------------
// Unlocking

export type LessonStatus = 'locked' | 'available' | 'completed';

export function lessonStatus(lessonId: string, records: LessonRecords, lessons: Lesson[] = allLessons): LessonStatus {
  if (records[lessonId]?.completed) return 'completed';
  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  if (index < 0) return 'locked';
  if (index === 0) return 'available';
  return records[lessons[index - 1].id]?.completed ? 'available' : 'locked';
}

/** The lesson the learner should do next, or null when the path is complete. */
export function nextLesson(records: LessonRecords, lessons: Lesson[] = allLessons): Lesson | null {
  return lessons.find((lesson) => !records[lesson.id]?.completed) ?? null;
}

export interface SectionProgress {
  completed: number;
  total: number;
  fraction: number;
  stars: number;
  maxStars: number;
  unlocked: boolean;
  done: boolean;
}

export function sectionProgress(section: Section, records: LessonRecords, lessons: Lesson[] = allLessons): SectionProgress {
  const completed = section.lessons.filter((lesson) => records[lesson.id]?.completed).length;
  const stars = section.lessons.reduce((sum, lesson) => sum + (records[lesson.id]?.bestStars ?? 0), 0);
  const first = section.lessons[0];
  const unlocked = first ? lessonStatus(first.id, records, lessons) !== 'locked' : false;
  return {
    completed,
    total: section.lessons.length,
    fraction: section.lessons.length === 0 ? 0 : completed / section.lessons.length,
    stars,
    maxStars: section.lessons.length * 3,
    unlocked,
    done: section.lessons.length > 0 && completed === section.lessons.length,
  };
}

/** The section the learner is currently working through (the last one if all are done). */
export function currentSection(records: LessonRecords, sections: Section[] = curriculum): Section {
  const lesson = nextLesson(records, sections.flatMap((section) => section.lessons));
  return sections.find((section) => section.id === lesson?.sectionId) ?? sections[sections.length - 1];
}

/** Lessons that become available because `lessonId` was just completed for the first time. */
export function newlyUnlockedLessons(lessonId: string, lessons: Lesson[] = allLessons): Lesson[] {
  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  return index >= 0 && index + 1 < lessons.length ? [lessons[index + 1]] : [];
}

export interface FeatureUnlock {
  id: 'play' | 'practice' | 'cube';
  title: string;
  /** All lessons in this section must be completed. */
  requiresSection: string;
}

export const FEATURE_UNLOCKS: FeatureUnlock[] = [
  { id: 'practice', title: 'Practice drills', requiresSection: 'board' },
  { id: 'play', title: 'Play vs Computer', requiresSection: 'bearing-off' },
];

export function isFeatureUnlocked(
  id: FeatureUnlock['id'],
  records: LessonRecords,
  sections: Section[] = curriculum,
): boolean {
  const unlock = FEATURE_UNLOCKS.find((feature) => feature.id === id);
  if (!unlock) return true;
  const section = sections.find((candidate) => candidate.id === unlock.requiresSection);
  if (!section || section.lessons.length === 0) return false;
  return section.lessons.every((lesson) => records[lesson.id]?.completed);
}

// ---------------------------------------------------------------------------
// Streaks and days

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d + days, 12);
  return dayKey(date);
}

export interface StreakState {
  current: number;
  longest: number;
  lastActiveDay: string | null;
}

export const emptyStreak = (): StreakState => ({ current: 0, longest: 0, lastActiveDay: null });

/** Records activity on `today`; returns the new streak and whether it grew. */
export function registerActivity(streak: StreakState, today: string): { streak: StreakState; extended: boolean } {
  if (streak.lastActiveDay === today) return { streak, extended: false };
  const continues = streak.lastActiveDay === shiftDay(today, -1);
  const current = continues ? streak.current + 1 : 1;
  return {
    streak: { current, longest: Math.max(streak.longest, current), lastActiveDay: today },
    extended: true,
  };
}

/** The streak to display today: it survives until the end of the day after the last activity. */
export function visibleStreak(streak: StreakState, today: string): number {
  if (!streak.lastActiveDay) return 0;
  if (streak.lastActiveDay === today || streak.lastActiveDay === shiftDay(today, -1)) return streak.current;
  return 0;
}

/** Keeps only the most recent `days` entries of a per-day map. */
export function pruneDays<T>(byDay: Record<string, T>, today: string, days = 60): Record<string, T> {
  const cutoff = shiftDay(today, -days);
  return Object.fromEntries(Object.entries(byDay).filter(([key]) => key > cutoff));
}
