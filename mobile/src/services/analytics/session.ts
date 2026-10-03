import type { AppStateStatus } from 'react-native';

import type { Analytics } from './analytics';

/** Coming back after this long in the background starts a new session. */
export const SESSION_GAP_MS = 30 * 60 * 1000;

interface SessionDeps {
  analytics: Pick<Analytics, 'configure' | 'track'>;
  onAppStateChange: (listener: (state: AppStateStatus) => void) => { remove(): void };
  newId: () => string;
  now?: () => number;
}

/**
 * Sessions for retention and engagement: a cold start opens one (with its
 * start-up time), and so does coming back after SESSION_GAP_MS away, because
 * phones keep apps in memory for days.
 */
export function startSessions(
  { analytics, onAppStateChange, newId, now = Date.now }: SessionDeps,
  coldStart: { firstOpen: boolean; startupMs?: number },
): () => void {
  analytics.configure({ session_id: newId() });
  analytics.track('app_opened', { first_open: coldStart.firstOpen, cold: true, startup_ms: coldStart.startupMs });
  let backgroundSince: number | null = null;
  const subscription = onAppStateChange((state) => {
    if (state === 'background') {
      backgroundSince = now();
    } else if (state === 'active' && backgroundSince !== null) {
      const away = now() - backgroundSince;
      backgroundSince = null;
      if (away >= SESSION_GAP_MS) {
        analytics.configure({ session_id: newId() });
        analytics.track('app_opened', { first_open: false, cold: false });
      }
    }
  });
  return () => subscription.remove();
}
