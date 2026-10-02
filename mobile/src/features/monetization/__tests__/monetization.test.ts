import { allLessons, curriculum } from '@/curriculum';
import { MockSubscriptionService } from '@/services/purchases/mockProvider';

import { ACCESS_POLICY, createFeatureAccess } from '../access';
import { enabledProducts, PRODUCTS } from '../catalog';
import { entitlementsFor, FREE_ENTITLEMENTS } from '../entitlements';

const NOW = new Date('2026-10-02T12:00:00Z');
const noUsage = { reviewedToday: [], unlockedReviews: [] };

const FULL = entitlementsFor({ productId: 'premium_annual', period: 'year', expiresAt: '2027-01-01T00:00:00Z', inTrial: false }, NOW);

describe('feature access', () => {
  it('keeps the whole beginner course and Opening Moves free', () => {
    const access = createFeatureAccess(FREE_ENTITLEMENTS, noUsage);
    const lastFree = curriculum.findIndex((section) => section.id === 'openings');
    expect(lastFree).toBeGreaterThan(0);
    for (const section of curriculum.slice(0, lastFree + 1)) {
      expect(section.tier ?? 'free').toBe('free');
      for (const lesson of section.lessons) {
        expect(access.canAccessLesson(lesson.id)).toBe(true);
        expect(access.isPreviewLesson(lesson.id)).toBe(false);
      }
    }
    expect(access.canAccessLesson('no-such-lesson')).toBe(false);
  });

  it('gives free players the first lesson of every premium course as a preview', () => {
    const access = createFeatureAccess(FREE_ENTITLEMENTS, noUsage);
    const premiumSections = curriculum.filter((section) => section.tier === 'premium');
    expect(premiumSections.length).toBeGreaterThan(0);
    for (const section of premiumSections) {
      const [first, ...rest] = section.lessons;
      expect(access.canAccessLesson(first.id)).toBe(true);
      expect(access.isPreviewLesson(first.id)).toBe(true);
      for (const lesson of rest) {
        expect(access.canAccessLesson(lesson.id)).toBe(false);
        expect(access.isPreviewLesson(lesson.id)).toBe(false);
      }
    }
    // The policy decides how long a preview is.
    const longer = createFeatureAccess(FREE_ENTITLEMENTS, noUsage, { ...ACCESS_POLICY, freePreviewLessons: 2 });
    expect(longer.canAccessLesson(premiumSections[0].lessons[1].id)).toBe(true);
  });

  it('opens every lesson with the full curriculum, with no preview labels', () => {
    const access = createFeatureAccess(FULL, noUsage);
    for (const lesson of allLessons) {
      expect(access.canAccessLesson(lesson.id)).toBe(true);
      expect(access.isPreviewLesson(lesson.id)).toBe(false);
    }
  });

  it('gives free players one full coach review a day; unlocked games stay open', () => {
    const fresh = createFeatureAccess(FREE_ENTITLEMENTS, noUsage);
    expect(fresh.canReviewGame('g1')).toBe(true);
    const used = createFeatureAccess(FREE_ENTITLEMENTS, { reviewedToday: ['g1'], unlockedReviews: ['g1'] });
    expect(used.canReviewGame('g1')).toBe(true);
    expect(used.canReviewGame('g2')).toBe(false);
    expect(used.canUseAiCoach()).toBe(false);
    expect(used.canAnalyzeGame()).toBe(false);
    expect(used.canUseAdvancedTraining()).toBe(false);
  });

  it('opens everything for premium', () => {
    const access = createFeatureAccess(FULL, { reviewedToday: ['a', 'b'], unlockedReviews: [] });
    expect(access.canReviewGame('anything')).toBe(true);
    expect(access.canUseAiCoach()).toBe(true);
    expect(access.canAnalyzeGame()).toBe(true);
    expect(access.canUseAdvancedTraining()).toBe(true);
  });
});

describe('entitlements', () => {
  it('expire with the subscription', () => {
    const purchase = { productId: 'premium_monthly' as const, period: 'month' as const, expiresAt: '2026-10-01T00:00:00Z', inTrial: false };
    expect(entitlementsFor(purchase, NOW)).toEqual(FREE_ENTITLEMENTS);
    expect(entitlementsFor({ ...purchase, expiresAt: '2026-11-01T00:00:00Z' }, NOW).isPremium).toBe(true);
    expect(entitlementsFor({ ...purchase, period: 'lifetime', expiresAt: null }, NOW).source).toBe('lifetime');
    expect(entitlementsFor(null, NOW)).toEqual(FREE_ENTITLEMENTS);
  });

  it('sells only enabled products, with no prices in the catalogue', () => {
    expect(enabledProducts().map((product) => product.id)).toEqual(['premium_annual', 'premium_monthly']);
    for (const product of PRODUCTS) expect(Object.keys(product)).not.toContain('price');
  });
});

describe('mock store', () => {
  function memoryStorage() {
    let value: string | null = null;
    return { load: async () => value, save: async (next: string) => void (value = next) };
  }

  it('sells localised products, grants premium, and offers the trial only once', async () => {
    const storage = memoryStorage();
    const store = new MockSubscriptionService('EUR', 'de-DE', () => NOW, 0, storage);
    const products = await store.getProducts();
    expect(products.map((product) => product.id)).toEqual(['premium_annual', 'premium_monthly']);
    expect(products[0].price.formatted).toContain('39,99');
    expect(products[0].trialDays).toBe(7);
    expect(products[0].monthlyEquivalent).toBeDefined();

    const result = await store.purchase('premium_annual');
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.entitlements.isPremium).toBe(true);
      expect(result.entitlements.inTrial).toBe(true);
    }
    expect((await store.getProducts())[0].trialDays).toBeUndefined();

    // A new instance over the same storage remembers the purchase (restore).
    const again = new MockSubscriptionService('EUR', 'de-DE', () => NOW, 0, storage);
    expect((await again.restorePurchases()).restored).toBe(true);
    await again.cancel();
    expect((await again.getEntitlements()).isPremium).toBe(false);
  });

  it('refuses products that are not for sale', async () => {
    const store = new MockSubscriptionService('USD', 'en-US', () => NOW, 0);
    expect((await store.purchase('premium_lifetime')).status).toBe('failed');
  });
});
