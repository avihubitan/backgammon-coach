import type { BillingPeriod, ProductId } from '@/features/monetization/catalog';
import type { Entitlements } from '@/features/monetization/entitlements';

/** A product as the store sells it, with a localised price. */
export interface StoreProduct {
  id: ProductId;
  period: BillingPeriod;
  title: string;
  price: {
    amount: number;
    currency: string;
    /** Ready to display, e.g. "$39.99" or "39,99 €". */
    formatted: string;
  };
  /** For annual plans: what it works out to per month, formatted. */
  monthlyEquivalent?: string;
  /** Free trial offered to this customer, if any. */
  trialDays?: number;
}

export type PurchaseResult =
  | { status: 'success'; entitlements: Entitlements }
  | { status: 'cancelled' }
  | { status: 'pending' }
  | { status: 'failed'; reason: string };

/**
 * The boundary between the app and a store (App Store, Google Play, or a
 * service such as RevenueCat). UI code never talks to a store directly.
 */
export interface SubscriptionService {
  readonly name: string;
  /** False when purchases can't be made here (e.g. a build without a store). */
  readonly available: boolean;
  getProducts(): Promise<StoreProduct[]>;
  purchase(productId: ProductId): Promise<PurchaseResult>;
  restorePurchases(): Promise<{ restored: boolean; entitlements: Entitlements }>;
  getEntitlements(): Promise<Entitlements>;
  /** Changes the store reports on its own (renewals, expiry, refunds). Returns an unsubscribe function. */
  onEntitlementsChange?(listener: (entitlements: Entitlements) => void): () => void;
}
