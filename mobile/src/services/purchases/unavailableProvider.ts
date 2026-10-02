import { FREE_ENTITLEMENTS } from '@/features/monetization/entitlements';

import type { SubscriptionService } from './types';

/** Used in builds without a store integration: nothing to buy, everyone is on the free plan. */
export class UnavailableSubscriptionService implements SubscriptionService {
  readonly name = 'unavailable';
  readonly available = false;
  async getProducts() {
    return [];
  }
  async purchase() {
    return { status: 'failed' as const, reason: 'Purchases aren’t available in this version yet.' };
  }
  async restorePurchases() {
    return { restored: false, entitlements: FREE_ENTITLEMENTS };
  }
  async getEntitlements() {
    return FREE_ENTITLEMENTS;
  }
}
