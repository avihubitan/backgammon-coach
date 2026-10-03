import { FREE_ENTITLEMENTS } from '@/features/monetization/entitlements';
import { subscriptionService } from '@/services/purchases';

import { useEntitlementsStore } from '../entitlementsStore';

afterEach(() => {
  jest.restoreAllMocks();
  useEntitlementsStore.setState({ entitlements: FREE_ENTITLEMENTS });
});

describe('restoring purchases', () => {
  const premium = { ...FREE_ENTITLEMENTS, isPremium: true, hasFullCurriculum: true, hasAiCoach: true };

  it('tells a failed store call apart from having nothing to restore', async () => {
    jest.spyOn(subscriptionService, 'restorePurchases').mockRejectedValueOnce(new Error('Network request failed'));
    expect(await useEntitlementsStore.getState().restore()).toBe('failed');
    jest.spyOn(subscriptionService, 'restorePurchases').mockResolvedValueOnce({ restored: false, entitlements: FREE_ENTITLEMENTS });
    expect(await useEntitlementsStore.getState().restore()).toBe('none');
    jest.spyOn(subscriptionService, 'restorePurchases').mockResolvedValueOnce({ restored: true, entitlements: premium });
    expect(await useEntitlementsStore.getState().restore()).toBe('restored');
    expect(useEntitlementsStore.getState().entitlements.isPremium).toBe(true);
  });

  it('never shows the store’s raw error text after a failed purchase', async () => {
    jest.spyOn(subscriptionService, 'purchase').mockRejectedValueOnce(new TypeError('undefined is not an object'));
    const result = await useEntitlementsStore.getState().purchase('premium_annual');
    expect(result.status).toBe('failed');
    expect(result.status === 'failed' && result.reason).not.toMatch(/undefined|TypeError/);
  });

  it('keeps the cached entitlements when the store can’t be reached', async () => {
    useEntitlementsStore.setState({ entitlements: premium });
    jest.spyOn(subscriptionService, 'getEntitlements').mockRejectedValueOnce(new Error('offline'));
    await useEntitlementsStore.getState().refresh();
    expect(useEntitlementsStore.getState().entitlements.isPremium).toBe(true);
  });
});
