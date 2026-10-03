import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { SkillCategory } from '@/curriculum';
import type { AchievementContext } from '@/features/learning/achievements';
import { dayKey, type ExerciseResult, type LessonAccess } from '@/features/learning/progression';
import {
  applyLessonResult,
  grantXp,
  initialProgress,
  type LessonReward,
  type ProgressData,
  type Reward,
} from '@/features/learning/progressModel';
import type { LessonOutcome } from '@/features/lessons/engine/session';
import { analytics } from '@/services/analytics';

import { persistStorage } from './storage';

function trackStreak(reward: Reward) {
  if (reward.freezesUsed > 0) analytics.track('streak_freeze_used', { freezes: reward.freezesUsed, streak: reward.streak });
  if (reward.freezeEarned) analytics.track('streak_freeze_earned', { streak: reward.streak });
}

interface ProgressActions {
  completeOnboarding: () => void;
  recordLessonResult: (
    lessonId: string,
    outcome: LessonOutcome,
    categoryResults?: { category: SkillCategory; firstTry: boolean }[],
    exerciseResults?: Record<string, ExerciseResult>,
    /** Which lessons the learner can open, so unlocks skip premium ones they can't. */
    canAccess?: LessonAccess,
  ) => LessonReward;
  /**
   * XP from practice drills, games or challenges, with what achievements need to know about them.
   * `active` counts the day for the streak even without XP (a finished drill).
   */
  awardXp: (amount: number, context?: Omit<AchievementContext, 'progress'>, active?: boolean) => Reward;
  recordPracticeSession: () => void;
  setDailyGoal: (xp: number) => void;
  resetProgress: () => void;
}

export type ProgressStore = ProgressData & ProgressActions;

/** Lets tests freeze "today". */
let clock: () => Date = () => new Date();
export function setProgressClock(next: () => Date) {
  clock = next;
}

export const useProgressStore = create<ProgressStore>()(
  persist(
    (set, get) => ({
      ...initialProgress(),

      completeOnboarding: () => set({ onboardingCompleted: true }),

      recordLessonResult: (lessonId, outcome, categoryResults = [], exerciseResults = {}, canAccess) => {
        const { data, reward } = applyLessonResult(
          get(),
          lessonId,
          outcome,
          dayKey(clock()),
          categoryResults,
          exerciseResults,
          canAccess,
        );
        set(data);
        trackStreak(reward);
        return reward;
      },

      awardXp: (amount, context = {}, active = amount > 0) => {
        const { data, reward } = grantXp(get(), amount, dayKey(clock()), context, active);
        set(data);
        trackStreak(reward);
        return reward;
      },

      recordPracticeSession: () =>
        set((state) => ({ stats: { ...state.stats, practiceSessions: state.stats.practiceSessions + 1 } })),

      setDailyGoal: (xp) => set({ dailyGoalXp: Math.max(10, Math.min(200, Math.round(xp))) }),

      resetProgress: () => set(initialProgress()),
    }),
    {
      name: 'bg-coach/progress',
      version: 1,
      storage: persistStorage,
      partialize: (state): ProgressData => ({
        version: state.version,
        onboardingCompleted: state.onboardingCompleted,
        lessons: state.lessons,
        xp: state.xp,
        xpByDay: state.xpByDay,
        streak: state.streak,
        dailyGoalXp: state.dailyGoalXp,
        stats: state.stats,
        achievements: state.achievements,
      }),
    },
  ),
);

/** Today's key according to the store's clock. */
export function todayKey(): string {
  return dayKey(clock());
}
