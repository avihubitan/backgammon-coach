import { Platform } from 'react-native';

import { Analytics, ConsoleProvider, MemoryProvider } from './analytics';

export type { AnalyticsEventName, AnalyticsEvents } from './events';
export type { AnalyticsProvider, TrackedEvent } from './analytics';

/** The app-wide analytics instance. Add a vendor provider here when one is chosen. */
export const analytics = new Analytics();

/** Recent events, handy when debugging on a device. */
export const recentEvents = new MemoryProvider();

analytics.addProvider(recentEvents);
if (__DEV__ && process.env.NODE_ENV !== 'test') analytics.addProvider(new ConsoleProvider());

function randomId(): string {
  // Not security-sensitive: only distinguishes sessions and installs.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function startAnalyticsSession(installId: string, appVersion: string) {
  analytics.configure({
    install_id: installId,
    session_id: randomId(),
    platform: Platform.OS,
    app_version: appVersion,
  });
}

export { randomId as newAnalyticsId };
