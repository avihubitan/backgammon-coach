import type { AnalyticsEventName, AnalyticsEvents } from './events';

export type AnalyticsValue = string | number | boolean | null;

export interface AnalyticsContext {
  /** Random id created on this device; not linked to any account. */
  install_id: string;
  session_id: string;
  platform: string;
  app_version: string;
}

export interface TrackedEvent {
  name: AnalyticsEventName;
  properties: Record<string, AnalyticsValue>;
  context: AnalyticsContext;
  timestamp: string;
}

/** Where events go: a vendor SDK, the backend, the dev console… */
export interface AnalyticsProvider {
  readonly name: string;
  track(event: TrackedEvent): void;
}

const MAX_STRING = 120;

/** Keeps only flat primitives and shortens long strings, so nothing unexpected leaks. */
export function sanitize(properties: object): Record<string, AnalyticsValue> {
  const clean: Record<string, AnalyticsValue> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined) continue;
    if (typeof value === 'number') clean[key] = Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null;
    else if (typeof value === 'boolean' || value === null) clean[key] = value;
    else if (typeof value === 'string') clean[key] = value.slice(0, MAX_STRING);
  }
  return clean;
}

/**
 * Typed analytics front door. Providers are pluggable; nothing is sent
 * when the player has opted out.
 */
export class Analytics {
  private providers: AnalyticsProvider[] = [];
  private enabled = true;
  private context: AnalyticsContext = { install_id: 'unknown', session_id: 'unknown', platform: 'unknown', app_version: '0' };

  constructor(private readonly now: () => Date = () => new Date()) {}

  configure(context: Partial<AnalyticsContext>) {
    this.context = { ...this.context, ...context };
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  addProvider(provider: AnalyticsProvider) {
    if (!this.providers.some((existing) => existing.name === provider.name)) this.providers.push(provider);
  }

  removeProvider(name: string) {
    this.providers = this.providers.filter((provider) => provider.name !== name);
  }

  track<E extends AnalyticsEventName>(name: E, properties: AnalyticsEvents[E]) {
    if (!this.enabled || this.providers.length === 0) return;
    const event: TrackedEvent = {
      name,
      properties: sanitize(properties),
      context: this.context,
      timestamp: this.now().toISOString(),
    };
    for (const provider of this.providers) {
      try {
        provider.track(event);
      } catch {
        // A broken provider must never affect the game.
      }
    }
  }
}

/** Keeps the latest events in memory (debug screens, tests). */
export class MemoryProvider implements AnalyticsProvider {
  readonly name = 'memory';
  readonly events: TrackedEvent[] = [];
  constructor(private readonly limit = 200) {}
  track(event: TrackedEvent) {
    this.events.push(event);
    if (this.events.length > this.limit) this.events.shift();
  }
}

/** Logs events in development builds. */
export class ConsoleProvider implements AnalyticsProvider {
  readonly name = 'console';
  track(event: TrackedEvent) {
    console.log(`[analytics] ${event.name}`, event.properties);
  }
}
