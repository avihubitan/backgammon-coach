import { AppState, Platform } from 'react-native';

import { buildInfo } from '@/services/buildInfo';

import { Analytics, ConsoleProvider, MemoryProvider } from './analytics';
import type { LaunchSource } from './events';
import { createPostHogClient } from './posthogClient';
import { PostHogProvider } from './posthogProvider';
import { startSessions } from './session';

export type { AnalyticsEventName, AnalyticsEvents, LaunchSource } from './events';
export type { AnalyticsProvider, TrackedEvent } from './analytics';

/** The app-wide analytics instance. */
export const analytics = new Analytics();

/** Recent events, handy when debugging on a device. */
export const recentEvents = new MemoryProvider();

analytics.addProvider(recentEvents);
if (__DEV__ && process.env.NODE_ENV !== 'test') analytics.addProvider(new ConsoleProvider());

function randomId(): string {
  // Not security-sensitive: only distinguishes sessions and installs.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

let installId: string | null = null;
let vendorConnected = false;

/** PostHog, once settings are loaded, if this build has a key and the player allows usage data. */
function connectVendor() {
  if (vendorConnected || !installId || !analytics.isEnabled()) return;
  const client = createPostHogClient(installId);
  if (!client) return;
  vendorConnected = true;
  analytics.addProvider(new PostHogProvider(client, { build_variant: buildInfo.variant }));
}

/**
 * Whether written feedback can reach us: usage data is on (`usageData`, the
 * player's setting, passed in so screens update when it changes), and this
 * build sends events somewhere (a vendor, or a development/preview log).
 */
export function canSendFeedback(usageData: boolean): boolean {
  return usageData && (vendorConnected || buildInfo.variant !== 'production');
}

/** Whether this build has somewhere to send feedback at all (shows "Send feedback"). */
export function feedbackConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_POSTHOG_KEY) || buildInfo.variant !== 'production';
}

/** The player's choice ("Share anonymous usage data"): off stops every event. */
export function setAnalyticsEnabled(enabled: boolean) {
  analytics.setEnabled(enabled);
  connectVendor();
}

const LAUNCH_SOURCES: readonly LaunchSource[] = ['coach_pick', 'daily_challenge', 'path', 'practice', 'review'];

/** A route's `source` param, if it is one we know. */
export function launchSource(value: string | undefined): LaunchSource | undefined {
  return LAUNCH_SOURCES.find((source) => source === value);
}

/**
 * Starts analytics once settings are loaded: the context every event carries,
 * the vendor provider (when this build has one and the player allows it), and
 * sessions. Returns a stop function.
 */
export function startAnalytics({
  installId: id,
  appVersion,
  firstOpen,
  startupMs,
}: {
  installId: string;
  appVersion: string;
  firstOpen: boolean;
  startupMs?: number;
}): () => void {
  analytics.configure({ install_id: id, platform: Platform.OS, app_version: appVersion });
  installId = id;
  connectVendor();
  return startSessions(
    { analytics, newId: randomId, onAppStateChange: (listener) => AppState.addEventListener('change', listener) },
    { firstOpen, startupMs },
  );
}

export { randomId as newAnalyticsId };
