import type { CustomerInfo, CustomerInfoUpdateListener, PurchasesPackage } from 'react-native-purchases';

import { effectiveEntitlements, FREE_ENTITLEMENTS, OFFLINE_GRACE_DAYS } from '@/features/monetization/entitlements';

import {
  entitlementsFromCustomerInfo,
  productIdFor,
  RevenueCatSubscriptionService,
  type RevenueCatSdk,
} from '../revenueCatProvider';

const pkg = (
  packageType: string,
  identifier: string,
  price: number,
  priceString: string,
  extra: { pricePerMonthString?: string; introPrice?: { price: number; periodUnit: string; periodNumberOfUnits: number } } = {},
) =>
  ({
    identifier: `$rc_${packageType.toLowerCase()}`,
    packageType,
    offeringIdentifier: 'default',
    product: {
      identifier,
      price,
      priceString,
      currencyCode: 'USD',
      pricePerMonthString: extra.pricePerMonthString ?? null,
      introPrice: extra.introPrice ?? null,
    },
  }) as unknown as PurchasesPackage;

const ANNUAL = pkg('ANNUAL', 'com.backgammoncoach.premium.annual', 39.99, '$39.99', {
  pricePerMonthString: '$3.33',
  introPrice: { price: 0, periodUnit: 'WEEK', periodNumberOfUnits: 1 },
});
const MONTHLY = pkg('MONTHLY', 'com.backgammoncoach.premium.monthly', 7.99, '$7.99');

const info = (premium?: Record<string, unknown>) =>
  ({
    entitlements: {
      all: {},
      active: premium
        ? {
            premium: {
              identifier: 'premium',
              isActive: true,
              willRenew: true,
              periodType: 'NORMAL',
              expirationDate: '2027-03-10T10:00:00Z',
              productIdentifier: 'com.backgammoncoach.premium.annual',
              billingIssueDetectedAt: null,
              ...premium,
            },
          }
        : {},
    },
  }) as unknown as CustomerInfo;

function fakeSdk(overrides: Partial<RevenueCatSdk> = {}) {
  const listeners = new Set<CustomerInfoUpdateListener>();
  const sdk: RevenueCatSdk & { emit: (value: CustomerInfo) => void; listenerCount: () => number } = {
    configure: jest.fn(),
    getOfferings: jest.fn(async () => ({ all: {}, current: { availablePackages: [MONTHLY, ANNUAL] } }) as never),
    purchasePackage: jest.fn(async () => ({ customerInfo: info({}) }) as never),
    restorePurchases: jest.fn(async () => info()),
    getCustomerInfo: jest.fn(async () => info()),
    addCustomerInfoUpdateListener: (listener) => {
      listeners.add(listener);
    },
    removeCustomerInfoUpdateListener: (listener) => listeners.delete(listener),
    checkTrialOrIntroductoryPriceEligibility: jest.fn(async () => ({})),
    emit: (value) => listeners.forEach((listener) => listener(value)),
    listenerCount: () => listeners.size,
    ...overrides,
  };
  return sdk;
}

describe('RevenueCat products', () => {
  it('sells our plans in catalogue order, with the store’s prices and trial', async () => {
    const products = await new RevenueCatSubscriptionService(fakeSdk()).getProducts();
    expect(products.map((product) => product.id)).toEqual(['premium_annual', 'premium_monthly']);
    expect(products[0]).toEqual({
      id: 'premium_annual',
      period: 'year',
      title: 'Annual',
      price: { amount: 39.99, currency: 'USD', formatted: '$39.99' },
      monthlyEquivalent: '$3.33',
      trialDays: 7,
    });
    expect(products[1].trialDays).toBeUndefined();
  });

  it('hides the trial when the store says this customer already had one', async () => {
    const sdk = fakeSdk({
      checkTrialOrIntroductoryPriceEligibility: jest.fn(async () => ({ 'com.backgammoncoach.premium.annual': { status: 1 } })),
    });
    const [annual] = await new RevenueCatSubscriptionService(sdk).getProducts();
    expect(annual.trialDays).toBeUndefined();
  });

  it('skips packages we don’t sell', async () => {
    const sdk = fakeSdk({
      getOfferings: jest.fn(
        async () =>
          ({
            all: {},
            current: {
              availablePackages: [
                MONTHLY,
                pkg('WEEKLY', 'weekly', 1.99, '$1.99'),
                pkg('LIFETIME', 'com.backgammoncoach.premium.lifetime', 99, '$99'),
              ],
            },
          }) as never,
      ),
    });
    expect((await new RevenueCatSubscriptionService(sdk).getProducts()).map((product) => product.id)).toEqual(['premium_monthly']);
  });

  it('matches Google Play base plans to our products', () => {
    expect(productIdFor('premium_annual:annual-plan')).toBe('premium_annual');
    expect(productIdFor('com.backgammoncoach.premium.monthly')).toBe('premium_monthly');
    expect(productIdFor('something_else')).toBeNull();
  });
});

describe('RevenueCat purchases', () => {
  it('grants Premium after a purchase', async () => {
    const sdk = fakeSdk({ purchasePackage: jest.fn(async () => ({ customerInfo: info({ periodType: 'TRIAL' }) }) as never) });
    const service = new RevenueCatSubscriptionService(sdk);
    const result = await service.purchase('premium_annual');
    expect(result.status).toBe('success');
    expect(result.status === 'success' && result.entitlements).toMatchObject({
      isPremium: true,
      hasAiCoach: true,
      productId: 'premium_annual',
      inTrial: true,
      willRenew: true,
      source: 'subscription',
    });
    expect(sdk.purchasePackage).toHaveBeenCalledWith(ANNUAL);
  });

  it('turns store errors into outcomes and plain words', async () => {
    const failWith = (error: object) => new RevenueCatSubscriptionService(fakeSdk({ purchasePackage: jest.fn(async () => Promise.reject(error)) }));
    expect(await failWith({ code: '1', userCancelled: true }).purchase('premium_monthly')).toEqual({ status: 'cancelled' });
    expect(await failWith({ code: '20' }).purchase('premium_monthly')).toEqual({ status: 'pending' });
    const network = await failWith({ code: '10', message: 'NSURLErrorDomain -1009' }).purchase('premium_monthly');
    expect(network).toEqual({ status: 'failed', reason: 'We couldn’t reach the store. Check your connection and try again.' });
    const odd = await failWith({ code: '99', message: 'Internal store failure XYZ' }).purchase('premium_monthly');
    expect(odd.status === 'failed' && odd.reason).not.toMatch(/XYZ|Internal/);
  });

  it('restores an earlier purchase when the store says it’s already owned', async () => {
    const sdk = fakeSdk({
      purchasePackage: jest.fn(async () => Promise.reject({ code: '6' })),
      restorePurchases: jest.fn(async () => info({})),
    });
    const result = await new RevenueCatSubscriptionService(sdk).purchase('premium_annual');
    expect(result.status).toBe('success');
  });

  it('restores purchases, or says there were none', async () => {
    expect((await new RevenueCatSubscriptionService(fakeSdk()).restorePurchases()).restored).toBe(false);
    const owned = fakeSdk({ restorePurchases: jest.fn(async () => info({})) });
    expect((await new RevenueCatSubscriptionService(owned).restorePurchases()).restored).toBe(true);
  });

  it('passes on what the store reports later (renewal, expiry, refund)', () => {
    const sdk = fakeSdk();
    const seen: boolean[] = [];
    const stop = new RevenueCatSubscriptionService(sdk).onEntitlementsChange((entitlements) => seen.push(entitlements.isPremium));
    sdk.emit(info({}));
    sdk.emit(info());
    expect(seen).toEqual([true, false]);
    stop();
    expect(sdk.listenerCount()).toBe(0);
  });
});

describe('entitlements from RevenueCat', () => {
  it('reads lifetime access, cancellations and billing problems', () => {
    expect(entitlementsFromCustomerInfo(info())).toEqual(FREE_ENTITLEMENTS);
    expect(entitlementsFromCustomerInfo(info({ expirationDate: null })).source).toBe('lifetime');
    const troubled = entitlementsFromCustomerInfo(info({ willRenew: false, billingIssueDetectedAt: '2027-03-01T00:00:00Z' }));
    expect(troubled).toMatchObject({ isPremium: true, willRenew: false, billingIssue: true });
  });

  it('trusts cached access offline only a little past its end date', () => {
    const premium = entitlementsFromCustomerInfo(info({ expirationDate: '2027-03-10T10:00:00Z' }));
    const day = 24 * 60 * 60 * 1000;
    const end = new Date('2027-03-10T10:00:00Z').getTime();
    expect(effectiveEntitlements(premium, new Date(end + (OFFLINE_GRACE_DAYS - 1) * day)).isPremium).toBe(true);
    expect(effectiveEntitlements(premium, new Date(end + (OFFLINE_GRACE_DAYS + 1) * day))).toEqual(FREE_ENTITLEMENTS);
    const lifetime = entitlementsFromCustomerInfo(info({ expirationDate: null }));
    expect(effectiveEntitlements(lifetime, new Date('2040-01-01'))).toBe(lifetime);
  });
});
