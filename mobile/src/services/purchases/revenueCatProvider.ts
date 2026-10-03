import type {
  CustomerInfo,
  CustomerInfoUpdateListener,
  MakePurchaseResult,
  PurchasesConfiguration,
  PurchasesOfferings,
  PurchasesPackage,
} from 'react-native-purchases';

import { enabledProducts, PRODUCTS, type BillingPeriod, type ProductId } from '@/features/monetization/catalog';
import { FREE_ENTITLEMENTS, type Entitlements } from '@/features/monetization/entitlements';

import type { PurchaseResult, StoreProduct, SubscriptionService } from './types';

/**
 * Production purchases through RevenueCat, which handles StoreKit and Google
 * Play Billing, validates receipts, tracks renewals, trials, grace periods and
 * refunds, and restores purchases. The app only maps its answers onto our own
 * products and entitlements: nothing outside this file knows about it.
 *
 * Dashboard setup: one entitlement, `premium`, attached to every product; a
 * current offering with Monthly, Annual (and optionally Lifetime) packages.
 */
export const PREMIUM_ENTITLEMENT = 'premium';

/**
 * The SDK key a build may use. RevenueCat's Test Store keys (`test_…`) make
 * purchases that cost nothing: fine in development and preview builds, never
 * in a store build, where it would give Premium away (the paywall then says
 * Premium isn't on sale instead).
 */
export function usableApiKey(key: string | undefined, variant: string): string | null {
  const trimmed = key?.trim();
  if (!trimmed) return null;
  if (variant === 'production' && trimmed.startsWith('test_')) return null;
  return trimmed;
}

/** The part of the RevenueCat SDK used here (lets tests pass a fake). */
export interface RevenueCatSdk {
  configure(configuration: PurchasesConfiguration): void;
  getOfferings(): Promise<PurchasesOfferings>;
  purchasePackage(aPackage: PurchasesPackage): Promise<MakePurchaseResult>;
  restorePurchases(): Promise<CustomerInfo>;
  getCustomerInfo(): Promise<CustomerInfo>;
  addCustomerInfoUpdateListener(listener: CustomerInfoUpdateListener): void;
  removeCustomerInfoUpdateListener(listener: CustomerInfoUpdateListener): boolean;
  /** iOS only (resolves to an empty map elsewhere). */
  checkTrialOrIntroductoryPriceEligibility(productIds: string[]): Promise<Record<string, { status: number }>>;
}

const PACKAGE_PRODUCT: Record<string, ProductId> = {
  MONTHLY: 'premium_monthly',
  ANNUAL: 'premium_annual',
  LIFETIME: 'premium_lifetime',
};

const UNIT_DAYS: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };
/** RevenueCat's INTRO_ELIGIBILITY_STATUS_INELIGIBLE. */
const INELIGIBLE = 1;

/** Our product for a store product id ("premium_annual" or "premium_annual:annual-base-plan"). */
export function productIdFor(storeProductId: string): ProductId | null {
  const base = storeProductId.split(':')[0];
  const config = PRODUCTS.find((product) => product.storeIds.ios === base || product.storeIds.android === base);
  return config?.id ?? null;
}

function productIdOf(pkg: PurchasesPackage): ProductId | null {
  return PACKAGE_PRODUCT[pkg.packageType] ?? productIdFor(pkg.product.identifier);
}

export function entitlementsFromCustomerInfo(info: CustomerInfo): Entitlements {
  const premium = info.entitlements.active[PREMIUM_ENTITLEMENT];
  if (!premium || !premium.isActive) return FREE_ENTITLEMENTS;
  return {
    isPremium: true,
    hasFullCurriculum: true,
    hasAiCoach: true,
    hasAdvancedAnalysis: true,
    hasAdvancedTraining: true,
    hasCosmetics: true,
    source: premium.expirationDate === null ? 'lifetime' : 'subscription',
    productId: productIdFor(premium.productIdentifier),
    expiresAt: premium.expirationDate,
    inTrial: premium.periodType === 'TRIAL',
    willRenew: premium.willRenew,
    billingIssue: premium.billingIssueDetectedAt !== null,
  };
}

/** A store package as one of our products, or null if we don't sell it. */
export function productFromPackage(pkg: PurchasesPackage, trialEligible = true): StoreProduct | null {
  const id = productIdOf(pkg);
  const config = enabledProducts().find((product) => product.id === id);
  if (!id || !config) return null;
  const product = pkg.product;
  const intro = product.introPrice;
  const trialDays =
    trialEligible && intro && intro.price === 0 ? intro.periodNumberOfUnits * (UNIT_DAYS[intro.periodUnit] ?? 0) || undefined : undefined;
  const period: BillingPeriod = config.period;
  return {
    id,
    period,
    title: period === 'year' ? 'Annual' : period === 'month' ? 'Monthly' : 'Lifetime',
    price: { amount: product.price, currency: product.currencyCode, formatted: product.priceString },
    monthlyEquivalent: period === 'year' ? (product.pricePerMonthString ?? undefined) : undefined,
    trialDays,
  };
}

const MESSAGES = {
  network: 'We couldn’t reach the store. Check your connection and try again.',
  notAllowed: 'Purchases aren’t allowed on this device. Check its Screen Time or family settings.',
  unavailable: 'This plan isn’t available right now. Try another plan, or come back later.',
  generic: 'The store couldn’t complete the purchase. Please try again in a moment.',
};

interface StoreError {
  code?: string;
  userCancelled?: boolean | null;
}

/** RevenueCat error codes, as strings (see PURCHASES_ERROR_CODE). */
const CODE = {
  cancelled: '1',
  storeProblem: '2',
  notAllowed: '3',
  productUnavailable: '5',
  alreadyPurchased: '6',
  network: '10',
  pending: '20',
  offline: '35',
} as const;

export class RevenueCatSubscriptionService implements SubscriptionService {
  readonly name = 'revenuecat';
  readonly available = true;
  /** Packages from the last product load, to buy by our product id. */
  private packages = new Map<ProductId, PurchasesPackage>();

  constructor(private readonly sdk: RevenueCatSdk) {}

  async getProducts(): Promise<StoreProduct[]> {
    const offerings = await this.sdk.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];
    let eligibility: Record<string, { status: number }> = {};
    try {
      eligibility = await this.sdk.checkTrialOrIntroductoryPriceEligibility(packages.map((pkg) => pkg.product.identifier));
    } catch {
      // Unknown eligibility: show the trial and let the store decide.
    }
    this.packages.clear();
    const products: StoreProduct[] = [];
    for (const pkg of packages) {
      const eligible = eligibility[pkg.product.identifier]?.status !== INELIGIBLE;
      const product = productFromPackage(pkg, eligible);
      if (!product || this.packages.has(product.id)) continue;
      this.packages.set(product.id, pkg);
      products.push(product);
    }
    // Same order as the catalogue (the highlighted plan first).
    const order = PRODUCTS.map((product) => product.id);
    return products.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  }

  async purchase(productId: ProductId): Promise<PurchaseResult> {
    if (!this.packages.has(productId)) await this.getProducts().catch(() => []);
    const pkg = this.packages.get(productId);
    if (!pkg) return { status: 'failed', reason: MESSAGES.unavailable };
    try {
      const { customerInfo } = await this.sdk.purchasePackage(pkg);
      const entitlements = entitlementsFromCustomerInfo(customerInfo);
      // Paid, but premium not granted: the dashboard entitlement is missing. Restoring may fix it.
      return entitlements.isPremium ? { status: 'success', entitlements } : { status: 'failed', reason: MESSAGES.generic };
    } catch (error) {
      const { code, userCancelled } = (error ?? {}) as StoreError;
      if (userCancelled || code === CODE.cancelled) return { status: 'cancelled' };
      if (code === CODE.pending) return { status: 'pending' };
      if (code === CODE.alreadyPurchased) {
        const restored = await this.restorePurchases().catch(() => null);
        if (restored?.restored) return { status: 'success', entitlements: restored.entitlements };
      }
      const reason =
        code === CODE.network || code === CODE.offline
          ? MESSAGES.network
          : code === CODE.notAllowed
            ? MESSAGES.notAllowed
            : code === CODE.productUnavailable
              ? MESSAGES.unavailable
              : MESSAGES.generic;
      return { status: 'failed', reason };
    }
  }

  async restorePurchases() {
    const entitlements = entitlementsFromCustomerInfo(await this.sdk.restorePurchases());
    return { restored: entitlements.isPremium, entitlements };
  }

  async getEntitlements() {
    return entitlementsFromCustomerInfo(await this.sdk.getCustomerInfo());
  }

  onEntitlementsChange(listener: (entitlements: Entitlements) => void): () => void {
    const onUpdate: CustomerInfoUpdateListener = (info) => listener(entitlementsFromCustomerInfo(info));
    this.sdk.addCustomerInfoUpdateListener(onUpdate);
    return () => {
      this.sdk.removeCustomerInfoUpdateListener(onUpdate);
    };
  }
}
