import { getLesson, getSection } from '@/curriculum';

import type { Entitlements } from './entitlements';

/**
 * The single place that decides who can use what. Screens ask FeatureAccess;
 * they never check prices, products or lesson numbers themselves.
 */
export interface FeatureAccess {
  /** Lessons in free sections are open to everyone; premium sections need the full curriculum. */
  canAccessLesson(lessonId: string): boolean;
  /** Full, move-by-move coach reviews without a daily limit. */
  canUseAiCoach(): boolean;
  /** Whether this particular game's full review can be opened now. */
  canReviewGame(gameId: string): boolean;
  /** Technical numbers (equity, win chances) behind the coach's advice. */
  canAnalyzeGame(): boolean;
  /** Practising your own mistakes and other advanced training. */
  canUseAdvancedTraining(): boolean;
}

export interface AccessPolicy {
  /** Full coach reviews a free player can open per day. */
  freeCoachReviewsPerDay: number;
}

export const ACCESS_POLICY: AccessPolicy = { freeCoachReviewsPerDay: 1 };

export interface AccessUsage {
  /** Games whose full review was unlocked today with the free allowance. */
  reviewedToday: string[];
  /** Games already unlocked (they stay open). */
  unlockedReviews: string[];
}

export function createFeatureAccess(
  entitlements: Entitlements,
  usage: AccessUsage,
  policy: AccessPolicy = ACCESS_POLICY,
): FeatureAccess {
  return {
    canAccessLesson(lessonId) {
      const lesson = getLesson(lessonId);
      if (!lesson) return false;
      const tier = getSection(lesson.sectionId)?.tier ?? 'free';
      return tier === 'free' || entitlements.hasFullCurriculum;
    },
    canUseAiCoach() {
      return entitlements.hasAiCoach;
    },
    canReviewGame(gameId) {
      if (entitlements.hasAiCoach) return true;
      if (usage.unlockedReviews.includes(gameId)) return true;
      return usage.reviewedToday.length < policy.freeCoachReviewsPerDay;
    },
    canAnalyzeGame() {
      return entitlements.hasAdvancedAnalysis;
    },
    canUseAdvancedTraining() {
      return entitlements.hasAdvancedTraining;
    },
  };
}
