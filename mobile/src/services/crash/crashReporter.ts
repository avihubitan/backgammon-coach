import type { CrashReporter } from './types';

/** The web build (development only) doesn't report crashes. */
export const crashReporter: CrashReporter & { startIfAllowed(): void } = {
  name: 'none',
  available: false,
  startIfAllowed() {},
  setEnabled() {},
  isEnabled: () => false,
  captureException() {},
  wrap: (component) => component,
  trackNavigation() {},
};
