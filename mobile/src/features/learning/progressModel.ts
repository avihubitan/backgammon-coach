import { getLesson, isScored, type Lesson, type SkillCategory } from '@/curriculum';
import type { LessonOutcome } from '@/features/lessons/engine/session';

import { ACHIEVEMENTS, type AchievementContext } from './achievements';
import {
  emptyLessonRecord,
  emptyStreak,
  lessonXp,
  levelInfo,
  newlyUnlockedLessons,
  pruneDays,
  registerActivity,
  visibleStreak,
  type LessonRecords,
  type StreakState,
} from './progression';

/** Everything about the learner's progress that is persisted on the device. */
export interface ProgressData {
  version: 1;
  onboardingCompleted: boolean;
  lessons: LessonRecords;
  xp: number;
  xpByDay: Record<string, number>;
  streak: StreakState;
  dailyGoalXp: number;
  stats: LearningStats;
  /** Achievement id -> ISO date unlocked. */
  achievements: Record<string, string>;
}

export interface CategoryStats {
  attempted: number;
  firstTry: number;
}

export interface LearningStats {
  exercisesAttempted: number;
  exercisesFirstTry: number;
  byCategory: Partial<Record<SkillCategory, CategoryStats>>;
  timeLearningMs: number;
  practiceSessions: number;
}

export const DEFAULT_DAILY_GOAL = 30;

export function initialProgress(): ProgressData {
  return {
    version: 1,
    onboardingCompleted: false,
    lessons: {},
    xp: 0,
    xpByDay: {},
    streak: emptyStreak(),
    dailyGoalXp: DEFAULT_DAILY_GOAL,
    stats: {
      exercisesAttempted: 0,
      exercisesFirstTry: 0,
      byCategory: {},
      timeLearningMs: 0,
      practiceSessions: 0,
    },
    achievements: {},
  };
}

export interface Reward {
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
  streak: number;
  streakExtended: boolean;
  dailyGoalReached: boolean;
  newAchievements: string[];
}

export interface LessonReward extends Reward {
  firstCompletion: boolean;
  unlockedLessons: Lesson[];
  stars: number;
  bestStars: number;
}

/** Adds XP for today, updates the streak and daily goal, and unlocks achievements. */
export function grantXp(
  data: ProgressData,
  amount: number,
  today: string,
  context: Omit<AchievementContext, 'progress'> = {},
): { data: ProgressData; reward: Reward } {
  const levelBefore = levelInfo(data.xp).level;
  const todayBefore = data.xpByDay[today] ?? 0;
  const { streak, extended } = amount > 0 ? registerActivity(data.streak, today) : { streak: data.streak, extended: false };
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
  categoryResults: { category: SkillCategory; firstTry: boolean }[] = [],
): { data: ProgressData; reward: LessonReward } {
  const lesson = getLesson(lessonId);
  if (!lesson) throw new Error(`Unknown lesson ${lessonId}`);
  const previous = data.lessons[lessonId] ?? emptyLessonRecord();
  const firstCompletion = outcome.passed && !previous.completed;
  const record = {
    ...previous,
    attempts: previous.attempts + 1,
    completed: previous.completed || outcome.passed,
    completions: previous.completions + (outcome.passed ? 1 : 0),
    bestStars: Math.max(previous.bestStars, outcome.stars),
    bestAccuracy: Math.max(previous.bestAccuracy, outcome.accuracy),
    firstCompletedAt: previous.firstCompletedAt ?? (outcome.passed ? today : null),
    lastPlayedAt: today,
  };

  const byCategory = { ...data.stats.byCategory };
  for (const result of categoryResults) {
    const current = byCategory[result.category] ?? { attempted: 0, firstTry: 0 };
    byCategory[result.category] = {
      attempted: current.attempted + 1,
      firstTry: current.firstTry + (result.firstTry ? 1 : 0),
    };
  }

  const withLesson: ProgressData = {
    ...data,
    lessons: { ...data.lessons, [lessonId]: record },
    stats: {
      ...data.stats,
      exercisesAttempted: data.stats.exercisesAttempted + outcome.scoredSteps,
      exercisesFirstTry: data.stats.exercisesFirstTry + outcome.firstTryCorrect,
      byCategory,
      timeLearningMs: data.stats.timeLearningMs + Math.max(0, Math.min(outcome.durationMs, 60 * 60 * 1000)),
    },
  };

  const xp = lessonXp(lesson, outcome.stars, outcome.passed, firstCompletion);
  const granted = grantXp(withLesson, xp, today);
  return {
    data: granted.data,
    reward: {
      ...granted.reward,
      firstCompletion,
      unlockedLessons: firstCompletion ? newlyUnlockedLessons(lessonId) : [],
      stars: outcome.stars,
      bestStars: record.bestStars,
    },
  };
}

/** Per-category first-try results for a finished lesson, used for skill statistics. */
export function categoryResultsFor(
  lesson: Lesson,
  outcomes: Record<string, { mistakes: number; solved: boolean; revealed: boolean }>,
): { category: SkillCategory; firstTry: boolean }[] {
  return lesson.steps.filter(isScored).map((step) => {
    const outcome = outcomes[step.id];
    return {
      category: lesson.category,
      firstTry: !!outcome && outcome.solved && !outcome.revealed && outcome.mistakes === 0,
    };
  });
}

export function todayXp(data: ProgressData, today: string): number {
  return data.xpByDay[today] ?? 0;
}

export function accuracy(stats: LearningStats): number {
  return stats.exercisesAttempted === 0 ? 0 : stats.exercisesFirstTry / stats.exercisesAttempted;
}
