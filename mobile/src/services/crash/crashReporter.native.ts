import * as Sentry from '@sentry/react-native';
import * as SecureStore from 'expo-secure-store';

import { buildInfo } from '@/services/buildInfo';

import { createSentryReporter, type ConsentStore, type SentrySdk } from './sentryReporter';

const CONSENT_KEY = 'bg-coach.crash-reports';

/** Read synchronously at start, so a player who opted out sends nothing at all. */
const consent: ConsentStore = {
  read() {
    try {
      return SecureStore.getItem(CONSENT_KEY) !== 'off';
    } catch {
      return true;
    }
  },
  write(enabled) {
    try {
      SecureStore.setItem(CONSENT_KEY, enabled ? 'on' : 'off');
    } catch {
      // The settings store stays the source of truth; this is only the early copy.
    }
  },
};

/** Sentry on iOS and Android, when the build has EXPO_PUBLIC_SENTRY_DSN. */
export const crashReporter = createSentryReporter({
  sdk: Sentry as unknown as SentrySdk,
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || undefined,
  environment: buildInfo.variant,
  consent,
  // All sessions while testing; a fifth in production is plenty for start-up and screen timings.
  tracesSampleRate: buildInfo.variant === 'production' ? 0.2 : 1,
  navigation: Sentry.reactNavigationIntegration(),
});

crashReporter.startIfAllowed();
