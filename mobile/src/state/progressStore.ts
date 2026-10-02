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

import { persistStorage } from './storage';

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
  /** XP from practice drills, games or challenges, with what achievements need to know about them. */
  awardXp: (amount: number, context?: Omit<AchievementContext, 'progress'>) => Reward;
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
        return reward;
      },

      awardXp: (amount, context = {}) => {
        const { data, reward } = grantXp(get(), amount, dayKey(clock()), context);
        set(data);
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
