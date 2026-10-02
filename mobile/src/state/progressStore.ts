import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { SkillCategory } from '@/curriculum';
import type { GameAchievementStats } from '@/features/learning/achievements';
import { dayKey } from '@/features/learning/progression';
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
  ) => LessonReward;
  /** XP from practice drills, games or challenges. */
  awardXp: (amount: number, games?: GameAchievementStats) => Reward;
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

      recordLessonResult: (lessonId, outcome, categoryResults = []) => {
        const { data, reward } = applyLessonResult(get(), lessonId, outcome, dayKey(clock()), categoryResults);
        set(data);
        return reward;
      },

      awardXp: (amount, games) => {
        const { data, reward } = grantXp(get(), amount, dayKey(clock()), { games });
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
