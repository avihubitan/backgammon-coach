import type { BillingPeriod, ProductId } from './catalog';

/** Everything the app needs to know about what a player has paid for, in one place. */
export interface Entitlements {
  isPremium: boolean;
  hasFullCurriculum: boolean;
  hasAiCoach: boolean;
  hasAdvancedAnalysis: boolean;
  hasAdvancedTraining: boolean;
  /** Premium board styles (cosmetic only). */
  hasCosmetics: boolean;
  source: 'free' | 'subscription' | 'lifetime';
  productId: ProductId | null;
  /** ISO date when access ends (null for free or lifetime). */
  expiresAt: string | null;
  /** True while the subscription is in a free trial. */
  inTrial: boolean;
  /** False once the player has cancelled: access continues until `expiresAt`. */
  willRenew?: boolean;
  /** The store couldn't take the last payment (access may continue in a grace period). */
  billingIssue?: boolean;
}

/** Cached access is trusted offline until a few days after its end date (renewals need the store to confirm). */
export const OFFLINE_GRACE_DAYS = 3;

/**
 * What the cached entitlements allow right now. A subscription that ended
 * more than OFFLINE_GRACE_DAYS ago, while the store couldn't be asked, no
 * longer counts.
 */
export function effectiveEntitlements(cached: Entitlements, now: Date = new Date()): Entitlements {
  if (!cached.isPremium || !cached.expiresAt) return cached;
  const end = new Date(cached.expiresAt).getTime() + OFFLINE_GRACE_DAYS * 24 * 60 * 60 * 1000;
  return Number.isFinite(end) && end < now.getTime() ? FREE_ENTITLEMENTS : cached;
}

export const FREE_ENTITLEMENTS: Entitlements = {
  isPremium: false,
  hasFullCurriculum: false,
  hasAiCoach: false,
  hasAdvancedAnalysis: false,
  hasAdvancedTraining: false,
  hasCosmetics: false,
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
    hasCosmetics: true,
    source: purchase.period === 'lifetime' ? 'lifetime' : 'subscription',
    productId: purchase.productId,
    expiresAt: purchase.expiresAt,
    inTrial: purchase.inTrial,
  };
}
