import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

import { RevenueCatSubscriptionService } from './revenueCatProvider';

/**
 * RevenueCat on iOS and Android, when this build has the platform's public SDK
 * key (EXPO_PUBLIC_REVENUECAT_IOS_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_KEY).
 */
export function createRevenueCatService(): RevenueCatSubscriptionService | null {
  const apiKey =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : Platform.OS === 'android'
        ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
        : undefined;
  if (!apiKey) return null;
  if (__DEV__) void Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey });
  return new RevenueCatSubscriptionService(Purchases);
}
