import AsyncStorage from '@react-native-async-storage/async-storage';

import { MockSubscriptionService } from './mockProvider';
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
 * The store used by this build. Development builds get the mock store so the
 * purchase flow can be tried end to end; a real store adapter (StoreKit /
 * Play Billing, e.g. via RevenueCat) replaces the unavailable one for release.
 */
function createService(): SubscriptionService {
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
