import type { BillingPeriod, ProductId } from './catalog';

/** Everything the app needs to know about what a player has paid for, in one place. */
export interface Entitlements {
  isPremium: boolean;
  hasFullCurriculum: boolean;
  hasAiCoach: boolean;
  hasAdvancedAnalysis: boolean;
  hasAdvancedTraining: boolean;
  source: 'free' | 'subscription' | 'lifetime';
  productId: ProductId | null;
  /** ISO date when access ends (null for free or lifetime). */
  expiresAt: string | null;
  /** True while the subscription is in a free trial. */
  inTrial: boolean;
}

export const FREE_ENTITLEMENTS: Entitlements = {
  isPremium: false,
  hasFullCurriculum: false,
  hasAiCoach: false,
  hasAdvancedAnalysis: false,
  hasAdvancedTraining: false,
  source: 'free',
  productId: null,
  expiresAt: null,
  inTrial: false,
};

/** An active purchase as reported by a store. */
export interface ActivePurchase {
  productId: ProductId;
  period: BillingPeriod;
  expiresAt: string | null;
  inTrial: boolean;
}

export function entitlementsFor(purchase: ActivePurchase | null, now: Date = new Date()): Entitlements {
  if (!purchase) return FREE_ENTITLEMENTS;
  if (purchase.expiresAt && new Date(purchase.expiresAt).getTime() <= now.getTime()) return FREE_ENTITLEMENTS;
  return {
    isPremium: true,
    hasFullCurriculum: true,
    hasAiCoach: true,
    hasAdvancedAnalysis: true,
    hasAdvancedTraining: true,
    source: purchase.period === 'lifetime' ? 'lifetime' : 'subscription',
    productId: purchase.productId,
    expiresAt: purchase.expiresAt,
    inTrial: purchase.inTrial,
  };
}
