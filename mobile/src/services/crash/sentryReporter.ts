import type { ComponentType } from 'react';

import type { CrashContext, CrashReporter } from './types';

/** The part of the Sentry SDK used here (lets tests pass a fake). */
export interface SentrySdk {
  init(options: Record<string, unknown>): void;
  close(): Promise<void>;
  captureException(error: unknown, hint?: { tags?: CrashContext }): string;
  wrap<P extends object>(component: ComponentType<P>): ComponentType<P>;
}

export interface NavigationIntegration {
  registerNavigationContainer(navigationContainerRef: unknown): void;
}

/** Where the player's choice is kept so the next start knows it before anything else loads. */
export interface ConsentStore {
  read(): boolean;
  write(enabled: boolean): void;
}

export interface SentryReporterDeps {
  sdk: SentrySdk;
  dsn: string | undefined;
  environment: string;
  consent: ConsentStore;
  /** Share of sessions with performance data (app start, screen loads). */
  tracesSampleRate: number;
  navigation?: NavigationIntegration;
}

type SentryEvent = {
  user?: Record<string, unknown>;
  server_name?: string;
  contexts?: { device?: Record<string, unknown> } & Record<string, unknown>;
} & Record<string, unknown>;

/**
 * Keeps reports anonymous: only Sentry's random installation id stays on the
 * user; device names (which can be a person's name) are removed.
 */
export function scrubEvent<E extends SentryEvent>(event: E): E {
  if (event.user) event.user = event.user.id ? { id: event.user.id } : {};
  delete event.server_name;
  if (event.contexts?.device) delete event.contexts.device.name;
  return event;
}

export function createSentryReporter({
  sdk,
  dsn,
  environment,
  consent,
  tracesSampleRate,
  navigation,
}: SentryReporterDeps): CrashReporter & { startIfAllowed(): void } {
  let started = false;
  let pendingNavigation: unknown = null;

  function start() {
    if (started || !dsn) return;
    started = true;
    sdk.init({
      dsn,
      environment,
      // No IP address, no user details; nothing that identifies the player.
      sendDefaultPii: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
      // Crash-free sessions per release: the beta's main stability number.
      enableAutoSessionTracking: true,
      tracesSampleRate,
      integrations: navigation ? [navigation] : [],
      beforeSend: scrubEvent,
      beforeSendTransaction: scrubEvent,
    });
    if (pendingNavigation && navigation) navigation.registerNavigationContainer(pendingNavigation);
  }

  return {
    name: 'sentry',
    available: Boolean(dsn),

    /** At app start, before the settings load: uses the choice saved last time. */
    startIfAllowed() {
      if (consent.read()) start();
    },

    setEnabled(enabled) {
      consent.write(enabled);
      if (enabled) {
        start();
      } else if (started) {
        started = false;
        void sdk.close().catch(() => {});
      }
    },

    isEnabled: () => started,

    captureException(error, context) {
      if (!started) return;
      sdk.captureException(error, context ? { tags: context } : undefined);
    },

    wrap: (component) => (dsn ? sdk.wrap(component) : component),

    trackNavigation(navigationRef) {
      pendingNavigation = navigationRef;
      if (started && navigation) navigation.registerNavigationContainer(navigationRef);
    },
  };
}
