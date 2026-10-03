import { todayKey } from '@/state/progressStore';
import { useEntitlementsStore } from '@/state/entitlementsStore';

import { createFeatureAccess, type FeatureAccess } from './access';
import { effectiveEntitlements } from './entitlements';

/** Feature access for screens; re-renders when entitlements or today's usage change. */
export function useFeatureAccess(): FeatureAccess {
  const entitlements = useEntitlementsStore((state) => state.entitlements);
  const reviewDay = useEntitlementsStore((state) => state.reviewDay);
  const reviewedToday = useEntitlementsStore((state) => state.reviewedToday);
  const unlockedReviews = useEntitlementsStore((state) => state.unlockedReviews);
  const today = todayKey();
  return createFeatureAccess(effectiveEntitlements(entitlements), {
    reviewedToday: reviewDay === today ? reviewedToday : [],
    unlockedReviews,
  });
}

/** The same, outside React (services). */
export function currentFeatureAccess(): FeatureAccess {
  const state = useEntitlementsStore.getState();
  const today = todayKey();
  return createFeatureAccess(effectiveEntitlements(state.entitlements), {
    reviewedToday: state.reviewDay === today ? state.reviewedToday : [],
    unlockedReviews: state.unlockedReviews,
  });
}
