import type { RevenueCatSubscriptionService } from './revenueCatProvider';

/** Web builds don't sell subscriptions. */
export function createRevenueCatService(): RevenueCatSubscriptionService | null {
  return null;
}
