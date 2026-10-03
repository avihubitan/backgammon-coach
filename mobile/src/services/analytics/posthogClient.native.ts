import PostHog from 'posthog-react-native';

import type { PostHogClient } from './posthogProvider';

/**
 * PostHog on iOS and Android, when this build has EXPO_PUBLIC_POSTHOG_KEY.
 * Created only once the player allows usage data: the SDK contacts PostHog
 * as soon as it exists.
 */
export function createPostHogClient(installId: string): PostHogClient | null {
  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return null;
  return new PostHog(apiKey, {
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    // The app's own app_opened follows the opt-out; the SDK's lifecycle events wouldn't.
    captureAppLifecycleEvents: false,
    // No location lookups from IP addresses.
    disableGeoip: true,
    // No feature flags or surveys yet (turn flags on for A/B tests later).
    preloadFeatureFlags: false,
    disableRemoteFeatureFlags: true,
    disableSurveys: true,
    // One anonymous profile per install (the random install id), so retention and funnels work.
    personProfiles: 'always',
    bootstrap: { distinctId: installId },
  }) as unknown as PostHogClient;
}
