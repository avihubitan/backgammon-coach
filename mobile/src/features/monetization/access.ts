import { getLesson, getSection } from '@/curriculum';
import { getBoardTheme } from '@/theme/boardThemes';

import type { Entitlements } from './entitlements';

/**
 * The single place that decides who can use what. Screens ask FeatureAccess;
 * they never check prices, products or lesson numbers themselves.
 */
export interface FeatureAccess {
  /**
   * Lessons in free sections are open to everyone. Premium sections need the
   * full curriculum, except for their first lessons: a free preview.
   */
  canAccessLesson(lessonId: string): boolean;
  /** A free preview of a premium course (only true for players without the full curriculum). */
  isPreviewLesson(lessonId: string): boolean;
  /** Full, move-by-move coach reviews without a daily limit. */
  canUseAiCoach(): boolean;
  /** Whether this particular game's full review can be opened now. */
  canReviewGame(gameId: string): boolean;
  /** Technical numbers (equity, win chances) behind the coach's advice. */
  canAnalyzeGame(): boolean;
  /** Practising your own mistakes and other advanced training. */
  canUseAdvancedTraining(): boolean;
  /** Board styles: free ones for everyone, the rest with Premium. Purely cosmetic. */
  canUseBoardTheme(themeId: string): boolean;
  /** Coach hints a player can ask for in one game (null: as many as they like). */
  hintsPerGame(): number | null;
}

export interface AccessPolicy {
  /** Full coach reviews a free player can open per day. */
  freeCoachReviewsPerDay: number;
  /** Lessons at the start of every premium section that anyone can play. */
  freePreviewLessons: number;
  /** Coach hints per game without Premium. */
  freeHintsPerGame: number;
}

export const ACCESS_POLICY: AccessPolicy = { freeCoachReviewsPerDay: 1, freePreviewLessons: 1, freeHintsPerGame: 3 };

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
  /** 'open' for everyone, 'preview' for a free taste of a premium course, 'premium' otherwise. */
  const lessonTier = (lessonId: string): 'open' | 'preview' | 'premium' | null => {
    const lesson = getLesson(lessonId);
    const section = lesson ? getSection(lesson.sectionId) : undefined;
    if (!lesson || !section) return null;
    if ((section.tier ?? 'free') === 'free') return 'open';
    const index = section.lessons.findIndex((candidate) => candidate.id === lessonId);
    return index < policy.freePreviewLessons ? 'preview' : 'premium';
  };
  return {
    canAccessLesson(lessonId) {
      const tier = lessonTier(lessonId);
      if (tier === null) return false;
      return tier !== 'premium' || entitlements.hasFullCurriculum;
    },
    isPreviewLesson(lessonId) {
      return lessonTier(lessonId) === 'preview' && !entitlements.hasFullCurriculum;
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
    canUseBoardTheme(themeId) {
      return getBoardTheme(themeId).tier === 'free' || !!entitlements.hasCosmetics;
    },
    hintsPerGame() {
      return entitlements.hasAiCoach ? null : policy.freeHintsPerGame;
    },
  };
}
