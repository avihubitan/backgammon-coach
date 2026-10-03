import type { PostHogClient } from './posthogProvider';

/** The web build (development only) sends no analytics to a vendor. */
export function createPostHogClient(_installId: string): PostHogClient | null {
  return null;
}
