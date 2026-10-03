import type { ComponentType } from 'react';

/** Context attached to a report: where it happened, never who it happened to. */
export type CrashContext = Record<string, string>;

/**
 * Reports crashes and unexpected errors so they can be fixed. Native builds
 * use Sentry when they have a DSN; everywhere else this does nothing.
 */
export interface CrashReporter {
  readonly name: string;
  /** False when this build can't report (no DSN, or the web build). */
  readonly available: boolean;
  /** Follows the player's "share anonymous usage data" choice; remembered for the next start. */
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
  /** For errors the app caught itself (a screen that failed to render). */
  captureException(error: unknown, context?: CrashContext): void;
  /** Wraps the root component (touch breadcrumbs, app start timing). */
  wrap<P extends object>(component: ComponentType<P>): ComponentType<P>;
  /** Records screen changes as breadcrumbs, so a report shows where the player was. */
  trackNavigation(navigationRef: unknown): void;
}
