import { getLesson, isScored, isSkillId, stepSkill, type Lesson, type LessonStep, type SkillId } from '@/curriculum';
import type { LessonOutcome } from '@/features/lessons/engine/session';
import { isMasteryLevel, masteryRank, type MasteryLevel } from '@/features/skills/masteryLevel';
import { isPlainObject } from '@/state/sanitize';

import { ACHIEVEMENTS, type AchievementContext } from './achievements';
import {
  emptyLessonRecord,
  emptyStreak,
  lessonPlaysToday,
  lessonRepeatFactor,
  lessonXpBreakdown,
  levelInfo,
  newlyUnlockedLessons,
  OPEN_ACCESS,
  pruneDays,
  registerActivity,
  visibleStreak,
  type ExerciseResult,
  type LessonAccess,
  type LessonRecords,
  type LessonXpBreakdown,
  type StreakState,
} from './progression';

/** Everything about the learner's progress that is persisted on the device. */
export interface ProgressData {
  version: 2;
  onboardingCompleted: boolean;
  lessons: LessonRecords;
  xp: number;
  xpByDay: Record<string, number>;
  streak: StreakState;
  dailyGoalXp: number;
  stats: LearningStats;
  /** Achievement id -> ISO date unlocked. */
  achievements: Record<string, string>;
  /** The highest mastery level each skill has reached. Only goes up: its XP is paid once. */
  skillLevels: Partial<Record<SkillId, MasteryLevel>>;
}

/**
 * How the learner does at one skill, from every scored answer that trains it:
 * lessons, drills and positions from their own games.
 */
export interface SkillStats {
  attempted: number;
  firstTry: number;
  /** The latest answers, oldest first: '1' right on the first try, '0' not. At most RECENT_ANSWERS. */
  recent: string;
  /** Days with at least one answer. */
  days: number;
  /** The last day with an answer, and the last with a first-try answer (YYYY-MM-DD). */
  lastDay: string | null;
  lastFirstTryDay: string | null;
}

/** How many of the latest answers a skill remembers: enough to see a trend, short enough to move. */
export const RECENT_ANSWERS = 12;

/** One scored answer, filed under the skill it trains. */
export interface SkillResult {
  skill: SkillId;
  firstTry: boolean;
}

export const emptySkillStats = (): SkillStats => ({
  attempted: 0,
  firstTry: 0,
  recent: '',
  days: 0,
  lastDay: null,
  lastFirstTryDay: null,
});

export const isSkillStats = (value: unknown): value is SkillStats =>
  isPlainObject(value) &&
  typeof value.attempted === 'number' &&
  typeof value.firstTry === 'number' &&
  typeof value.recent === 'string' &&
  typeof value.days === 'number';

export interface LearningStats {
  exercisesAttempted: number;
  exercisesFirstTry: number;
  bySkill: Partial<Record<SkillId, SkillStats>>;
  timeLearningMs: number;
  practiceSessions: number;
}

export const DEFAULT_DAILY_GOAL = 30;

export function initialProgress(): ProgressData {
  return {
    version: 2,
    onboardingCompleted: false,
    lessons: {},
    xp: 0,
    xpByDay: {},
    streak: emptyStreak(),
    dailyGoalXp: DEFAULT_DAILY_GOAL,
    stats: {
      exercisesAttempted: 0,
      exercisesFirstTry: 0,
      bySkill: {},
      timeLearningMs: 0,
      practiceSessions: 0,
    },
    achievements: {},
    skillLevels: {},
  };
}

export interface Reward {
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
  streak: number;
  streakExtended: boolean;
  /** Streak freezes spent today to keep the streak going. */
  freezesUsed: number;
  freezeEarned: boolean;
  dailyGoalReached: boolean;
  newAchievements: string[];
}

export interface LessonReward extends Reward {
  xp: LessonXpBreakdown;
  firstCompletion: boolean;
  unlockedLessons: Lesson[];
  stars: number;
  bestStars: number;
}

/**
 * Adds XP for today, updates the streak and daily goal, and unlocks achievements.
 * `active` says whether this counts as a day of learning for the streak: any XP
 * does, and so does finishing a lesson or drill even when every answer was shown.
 */
export function grantXp(
  data: ProgressData,
  amount: number,
  today: string,
  context: Omit<AchievementContext, 'progress'> = {},
  active = amount > 0,
): { data: ProgressData; reward: Reward } {
  const levelBefore = levelInfo(data.xp).level;
  const todayBefore = data.xpByDay[today] ?? 0;
  const activity =
    active || amount > 0
      ? registerActivity(data.streak, today)
      : { streak: data.streak, extended: false, freezesUsed: 0, freezeEarned: false };
  const { streak, extended } = activity;
  let next: ProgressData = {
    ...data,
    xp: data.xp + amount,
    xpByDay: pruneDays({ ...data.xpByDay, [today]: todayBefore + amount }, today),
    streak,
  };
  const newAchievements = ACHIEVEMENTS.filter(
    (achievement) => !next.achievements[achievement.id] && achievement.isUnlocked({ ...context, progress: next }),
  ).map((achievement) => achievement.id);
  if (newAchievements.length > 0) {
    next = {
      ...next,
      achievements: {
        ...next.achievements,
        ...Object.fromEntries(newAchievements.map((id) => [id, today])),
      },
    };
  }
  return {
    data: next,
    reward: {
      xpGained: amount,
      levelBefore,
      levelAfter: levelInfo(next.xp).level,
      streak: visibleStreak(next.streak, today),
      streakExtended: extended,
      freezesUsed: activity.freezesUsed,
      freezeEarned: activity.freezeEarned,
      dailyGoalReached: todayBefore < data.dailyGoalXp && todayBefore + amount >= data.dailyGoalXp,
      newAchievements,
    },
  };
}

/** Records the outcome of a lesson attempt and returns the rewards to celebrate. */
export function applyLessonResult(
  data: ProgressData,
  lessonId: string,
  outcome: LessonOutcome,
  today: string,
  skillResults: SkillResult[] = [],
  exerciseResults: Record<string, ExerciseResult> = {},
  canAccess: LessonAccess = OPEN_ACCESS,
): { data: ProgressData; reward: LessonReward } {
  const lesson = getLesson(lessonId);
  if (!lesson) throw new Error(`Unknown lesson ${lessonId}`);
  const previous = data.lessons[lessonId] ?? emptyLessonRecord();
  const firstCompletion = outcome.passed && !previous.completed;
  const replay = previous.completed;
  const record = {
    ...previous,
    dayPlays: lessonPlaysToday(previous, today) + 1,
    attempts: previous.attempts + 1,
    completed: previous.completed || outcome.passed,
    completions: previous.completions + (outcome.passed ? 1 : 0),
    bestStars: Math.max(previous.bestStars, outcome.stars),
    bestAccuracy: Math.max(previous.bestAccuracy, outcome.accuracy),
    firstCompletedAt: previous.firstCompletedAt ?? (outcome.passed ? today : null),
    lastPlayedAt: today,
  };

  const withLesson: ProgressData = {
    ...data,
    lessons: { ...data.lessons, [lessonId]: record },
    stats: {
      ...data.stats,
      exercisesAttempted: data.stats.exercisesAttempted + outcome.scoredSteps,
      exercisesFirstTry: data.stats.exercisesFirstTry + outcome.firstTryCorrect,
      bySkill: applySkillResults(data.stats.bySkill, skillResults, today),
      timeLearningMs: data.stats.timeLearningMs + Math.max(0, Math.min(outcome.durationMs, 60 * 60 * 1000)),
    },
  };

  // Replaying the same lesson again and again in one day earns less.
  const xp = lessonXpBreakdown(lesson, exerciseResults, outcome, firstCompletion, replay, lessonRepeatFactor(previous, today));
  // Finishing a lesson counts for the streak, passed or not.
  const granted = grantXp(withLesson, xp.total, today, {}, true);
  return {
    data: granted.data,
    reward: {
      ...granted.reward,
      xp,
      firstCompletion,
      unlockedLessons: firstCompletion ? newlyUnlockedLessons(lessonId, undefined, canAccess) : [],
      stars: outcome.stars,
      bestStars: record.bestStars,
    },
  };
}

/** A lesson's reward with XP granted after it (skills that reached a new level), as one celebration. */
export function withSkillXp(lesson: LessonReward, extra: Reward): LessonReward {
  if (extra.xpGained <= 0) return lesson;
  return {
    ...lesson,
    xpGained: lesson.xpGained + extra.xpGained,
    levelAfter: extra.levelAfter,
    dailyGoalReached: lesson.dailyGoalReached || extra.dailyGoalReached,
    newAchievements: [...lesson.newAchievements, ...extra.newAchievements],
    xp: { ...lesson.xp, skills: (lesson.xp.skills ?? 0) + extra.xpGained, total: lesson.xp.total + extra.xpGained },
  };
}

/**
 * First-try results of a finished lesson or practice run, each filed under the
 * skill its step trains (the step's own, else `fallback`: the lesson's skill).
 */
export function skillResultsFor(
  steps: readonly LessonStep[],
  outcomes: Record<string, { mistakes: number; solved: boolean; revealed: boolean }>,
  fallback: Pick<Lesson, 'skill'>,
): SkillResult[] {
  return steps.filter(isScored).map((step) => {
    const outcome = outcomes[step.id];
    return {
      skill: stepSkill(fallback, step),
      firstTry: !!outcome && outcome.solved && !outcome.revealed && outcome.mistakes === 0,
    };
  });
}

/** Adds answers to the per-skill statistics. */
export function applySkillResults(
  bySkill: Partial<Record<SkillId, SkillStats>>,
  results: readonly SkillResult[],
  today: string,
): Partial<Record<SkillId, SkillStats>> {
  const next = { ...bySkill };
  for (const result of results) {
    const current = next[result.skill] ?? emptySkillStats();
    next[result.skill] = {
      attempted: current.attempted + 1,
      firstTry: current.firstTry + (result.firstTry ? 1 : 0),
      recent: (current.recent + (result.firstTry ? '1' : '0')).slice(-RECENT_ANSWERS),
      days: current.days + (current.lastDay === today ? 0 : 1),
      lastDay: today,
      lastFirstTryDay: result.firstTry ? today : current.lastFirstTryDay,
    };
  }
  return next;
}

/** Records answers from practice (drills and positions from games) toward their skills. */
export function applyPracticeResults(data: ProgressData, results: readonly SkillResult[], today: string): ProgressData {
  if (results.length === 0) return data;
  return {
    ...data,
    stats: {
      ...data.stats,
      exercisesAttempted: data.stats.exercisesAttempted + results.length,
      exercisesFirstTry: data.stats.exercisesFirstTry + results.filter((result) => result.firstTry).length,
      bySkill: applySkillResults(data.stats.bySkill, results, today),
    },
  };
}

/** Where the lesson categories of progress version 1 went in the skill taxonomy. */
const SKILL_OF_CATEGORY: Record<string, SkillId> = {
  board: 'board',
  movement: 'rules',
  scoring: 'rules',
  hitting: 'hitting',
  positioning: 'points',
  'bearing-off': 'bear-off',
  opening: 'openings',
  racing: 'racing',
  strategy: 'plans',
  cube: 'cube',
};

/**
 * Saved progress in today's shape. Version 1 counted answers per lesson
 * category; they carry over to the skill each category became, so nothing the
 * learner did is lost. Anything else passes through for the store's checks.
 */
export function upgradeProgress<T>(saved: T): T {
  if (!isPlainObject(saved) || !isPlainObject(saved.stats)) return saved;
  const stats = saved.stats;
  if (stats.bySkill !== undefined) return saved;
  const bySkill: Partial<Record<SkillId, SkillStats>> = {};
  if (isPlainObject(stats.byCategory)) {
    for (const [category, entry] of Object.entries(stats.byCategory)) {
      const skill = SKILL_OF_CATEGORY[category];
      if (!skill || !isPlainObject(entry) || typeof entry.attempted !== 'number' || typeof entry.firstTry !== 'number') continue;
      const current = bySkill[skill] ?? emptySkillStats();
      bySkill[skill] = { ...current, attempted: current.attempted + entry.attempted, firstTry: current.firstTry + entry.firstTry };
    }
  }
  const rest: Record<string, unknown> = { ...stats };
  delete rest.byCategory;
  return { ...saved, version: 2, stats: { ...rest, bySkill } } as T;
}

/** Saves the levels skills have reached, keeping the highest of each. */
export function raiseSkillLevels(
  saved: Partial<Record<SkillId, MasteryLevel>>,
  reached: Partial<Record<SkillId, MasteryLevel>>,
): Partial<Record<SkillId, MasteryLevel>> {
  const next = { ...saved };
  for (const [skill, level] of Object.entries(reached) as [SkillId, MasteryLevel][]) {
    if (masteryRank(level) > masteryRank(next[skill] ?? 'none')) next[skill] = level;
  }
  return next;
}

/** Mastery levels a save may hold: known skills and known levels. */
export function checkedSkillLevels(value: unknown): Partial<Record<SkillId, MasteryLevel>> {
  if (!isPlainObject(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([skill, level]) => isSkillId(skill) && isMasteryLevel(level)),
  ) as Partial<Record<SkillId, MasteryLevel>>;
}

/** Per-skill statistics a save may hold: known skills with the expected fields. */
export function checkedSkillStats(value: unknown): Partial<Record<SkillId, SkillStats>> {
  if (!isPlainObject(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([skill, entry]) => isSkillId(skill) && isSkillStats(entry))
      .map(([skill, entry]) => [skill, { ...emptySkillStats(), ...(entry as SkillStats) }]),
  ) as Partial<Record<SkillId, SkillStats>>;
}

export function todayXp(data: ProgressData, today: string): number {
  return data.xpByDay[today] ?? 0;
}

export function accuracy(stats: LearningStats): number {
  return stats.exercisesAttempted === 0 ? 0 : stats.exercisesFirstTry / stats.exercisesAttempted;
}
