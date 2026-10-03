import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { productConfig, type ProductId } from '@/features/monetization/catalog';
import { FREE_ENTITLEMENTS, type Entitlements } from '@/features/monetization/entitlements';
import { analytics } from '@/services/analytics';
import { subscriptionService, type PurchaseResult, type StoreProduct } from '@/services/purchases';

import { mergeChecked } from './sanitize';
import { persistStorage } from './storage';

/** Free coach reviews already used are remembered per day; unlocked games stay unlocked. */
const MAX_UNLOCKED_REVIEWS = 60;

export type RestoreOutcome = 'restored' | 'none' | 'failed';

interface EntitlementsState {
  /** Last known entitlements (cached so premium works offline). */
  entitlements: Entitlements;
  reviewDay: string | null;
  reviewedToday: string[];
  unlockedReviews: string[];
  /** Products as the store sells them (not persisted). */
  products: StoreProduct[] | null;
  refresh: () => Promise<void>;
  /** Refreshes from the store and follows the changes it reports. Returns a stop function. */
  start: () => () => void;
  loadProducts: () => Promise<StoreProduct[]>;
  purchase: (productId: ProductId) => Promise<PurchaseResult>;
  /** 'failed' when the store couldn't be reached: not the same as having nothing to restore. */
  restore: () => Promise<RestoreOutcome>;
  /** Spends today's free full review on a game (no-op for premium or already unlocked games). */
  unlockReview: (gameId: string, day: string) => void;
  reset: () => void;
}

export const useEntitlementsStore = create<EntitlementsState>()(
  persist(
    (set, get) => ({
      entitlements: FREE_ENTITLEMENTS,
      reviewDay: null,
      reviewedToday: [],
      unlockedReviews: [],
      products: null,

      refresh: async () => {
        try {
          set({ entitlements: await subscriptionService.getEntitlements() });
        } catch {
          // Keep the cached entitlements when the store can't be reached.
        }
      },

      start: () => {
        void get().refresh();
        return subscriptionService.onEntitlementsChange?.((entitlements) => set({ entitlements })) ?? (() => {});
      },

      loadProducts: async () => {
        const products = await subscriptionService.getProducts();
        set({ products });
        return products;
      },

      purchase: async (productId) => {
        analytics.track('purchase_started', { product_id: productId });
        let result: PurchaseResult;
        try {
          result = await subscriptionService.purchase(productId);
        } catch {
          // Never show the store's raw error text.
          result = { status: 'failed', reason: 'Something went wrong with the purchase. Please try again.' };
        }
        if (result.status === 'success') {
          set({ entitlements: result.entitlements });
          analytics.track('purchase_completed', { product_id: productId });
          analytics.track('subscription_started', {
            product_id: productId,
            period: productConfig(productId)?.period ?? 'unknown',
            trial: result.entitlements.inTrial,
          });
        } else if (result.status === 'failed') {
          analytics.track('purchase_failed', { product_id: productId, reason: result.reason });
        }
        return result;
      },

      restore: async () => {
        try {
          const { restored, entitlements } = await subscriptionService.restorePurchases();
          set({ entitlements });
          analytics.track('purchases_restored', { restored });
          return restored ? 'restored' : 'none';
        } catch {
          return 'failed';
        }
      },

      unlockReview: (gameId, day) => {
        const state = get();
        if (state.entitlements.hasAiCoach || state.unlockedReviews.includes(gameId)) return;
        const reviewedToday = state.reviewDay === day ? state.reviewedToday : [];
        set({
          reviewDay: day,
          reviewedToday: [...reviewedToday, gameId],
          unlockedReviews: [gameId, ...state.unlockedReviews].slice(0, MAX_UNLOCKED_REVIEWS),
        });
      },

      reset: () => set({ reviewDay: null, reviewedToday: [], unlockedReviews: [] }),
    }),
    {
      name: 'bg-coach/entitlements',
      version: 1,
      storage: persistStorage,
      merge: mergeChecked<EntitlementsState, Pick<EntitlementsState, 'entitlements' | 'reviewDay' | 'reviewedToday' | 'unlockedReviews'>>({
        entitlements: FREE_ENTITLEMENTS,
        reviewDay: null,
        reviewedToday: [],
        unlockedReviews: [],
      }),
      partialize: ({ entitlements, reviewDay, reviewedToday, unlockedReviews }) => ({
        entitlements,
        reviewDay,
        reviewedToday,
        unlockedReviews,
      }),
    },
  ),
);
