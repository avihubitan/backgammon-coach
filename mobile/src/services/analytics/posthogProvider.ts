import type { AnalyticsProvider, AnalyticsValue, TrackedEvent } from './analytics';

type Properties = Record<string, AnalyticsValue>;

/** The part of the PostHog client used here (lets tests pass a fake). */
export interface PostHogClient {
  capture(event: string, properties?: Properties): void;
  register(properties: Properties): Promise<void> | void;
}

/**
 * Sends events to PostHog (product analytics: funnels, retention). Only events
 * that passed the Analytics gate arrive here, so the player's opt-out holds.
 * PostHog adds its own session, app version and OS details to each event.
 */
export class PostHogProvider implements AnalyticsProvider {
  readonly name = 'posthog';

  constructor(
    private readonly client: PostHogClient,
    superProperties: Properties = {},
  ) {
    void Promise.resolve(client.register(superProperties)).catch(() => {});
  }

  track(event: TrackedEvent) {
    this.client.capture(event.name, event.properties);
  }
}
