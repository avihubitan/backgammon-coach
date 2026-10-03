import AsyncStorage from '@react-native-async-storage/async-storage';

import { MockSubscriptionService } from './mockProvider';
import { createRevenueCatService } from './revenueCat';
import type { SubscriptionService } from './types';
import { UnavailableSubscriptionService } from './unavailableProvider';

export type { PurchaseResult, StoreProduct, SubscriptionService } from './types';
export { MockSubscriptionService } from './mockProvider';

const MOCK_STORE_KEY = 'bg-coach/dev-mock-store';

function localeCurrency(): { locale: string; currency: string } {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
    const region = locale.split('-')[1]?.toUpperCase();
    const euro = ['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'PT', 'IE', 'FI', 'GR'];
    const currency = region === 'GB' ? 'GBP' : region === 'IL' ? 'ILS' : region && euro.includes(region) ? 'EUR' : 'USD';
    return { locale, currency };
  } catch {
    return { locale: 'en-US', currency: 'USD' };
  }
}

/**
 * The store used by this build: RevenueCat when the build has its key for this
 * platform; otherwise the simulated store in development builds (so the flow
 * can be tried end to end) and "unavailable" in release builds.
 * EXPO_PUBLIC_STORE=mock forces the simulated store in a development build.
 */
function createService(): SubscriptionService {
  if (!(__DEV__ && process.env.EXPO_PUBLIC_STORE === 'mock')) {
    const revenueCat = createRevenueCatService();
    if (revenueCat) return revenueCat;
  }
  if (__DEV__) {
    const { locale, currency } = localeCurrency();
    return new MockSubscriptionService(currency, locale, () => new Date(), 600, {
      load: () => AsyncStorage.getItem(MOCK_STORE_KEY),
      save: (value) => AsyncStorage.setItem(MOCK_STORE_KEY, value),
    });
  }
  return new UnavailableSubscriptionService();
}

export const subscriptionService: SubscriptionService = createService();
