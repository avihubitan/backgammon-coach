import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { AchievementContext } from '@/features/learning/achievements';
import { dayKey, emptyLessonRecord, type ExerciseResult, type LessonAccess } from '@/features/learning/progression';
import {
  applyLessonResult,
  applyPracticeResults,
  checkedSkillLevels,
  checkedSkillStats,
  grantXp,
  initialProgress,
  raiseSkillLevels,
  upgradeProgress,
  type LessonReward,
  type ProgressData,
  type Reward,
  type SkillResult,
} from '@/features/learning/progressModel';
import type { LessonOutcome } from '@/features/lessons/engine/session';
import type { SkillId } from '@/curriculum';
import type { MasteryLevel } from '@/features/skills/masteryLevel';
import { analytics } from '@/services/analytics';

import { isPlainObject, keepEntries, mergeChecked, withDefaults } from './sanitize';
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
    skillResults?: SkillResult[],
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
  /** First-try results from practice (drills, positions from games), filed under their skills. */
  recordSkillResults: (results: SkillResult[]) => void;
  /** Mastery levels skills have reached (each skill keeps its highest). */
  recordSkillLevels: (levels: Partial<Record<SkillId, MasteryLevel>>) => void;
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

      recordLessonResult: (lessonId, outcome, skillResults = [], exerciseResults = {}, canAccess) => {
        const { data, reward } = applyLessonResult(
          get(),
          lessonId,
          outcome,
          dayKey(clock()),
          skillResults,
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

      recordSkillResults: (results) => set(applyPracticeResults(get(), results, dayKey(clock()))),

      recordSkillLevels: (levels) => set({ skillLevels: raiseSkillLevels(get().skillLevels, levels) }),

      setDailyGoal: (xp) => set({ dailyGoalXp: Math.max(10, Math.min(200, Math.round(xp))) }),

      resetProgress: () => set(initialProgress()),
    }),
    {
      name: 'bg-coach/progress',
      version: 2,
      storage: persistStorage,
      // Version 1 kept answers per lesson category: they carry over to skills.
      migrate: (persisted) => upgradeProgress(persisted) as ProgressStore,
      // A damaged field falls back to its default; everything else the player earned is kept.
      merge: mergeChecked<ProgressStore, ProgressData>(initialProgress(), (saved) => ({
        ...saved,
        lessons: Object.fromEntries(
          Object.entries(saved.lessons)
            .filter(([, record]) => isPlainObject(record))
            .map(([id, record]) => [id, withDefaults(emptyLessonRecord(), record)]),
        ),
        xpByDay: keepEntries<number>(saved.xpByDay, (xp) => typeof xp === 'number' && Number.isFinite(xp)),
        achievements: keepEntries<string>(saved.achievements, (day) => typeof day === 'string'),
        stats: { ...saved.stats, bySkill: checkedSkillStats(saved.stats.bySkill) },
        skillLevels: checkedSkillLevels(saved.skillLevels),
      })),
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
        skillLevels: state.skillLevels,
      }),
    },
  ),
);

/** Today's key according to the store's clock. */
export function todayKey(): string {
  return dayKey(clock());
}

/** The time now according to the store's clock. */
export function currentTime(): Date {
  return clock();
}
