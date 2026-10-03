import type { AppStateStatus } from 'react-native';

import { Analytics, MemoryProvider } from '../analytics/analytics';
import { PostHogProvider } from '../analytics/posthogProvider';
import { SESSION_GAP_MS, startSessions } from '../analytics/session';

function setup() {
  const analytics = new Analytics(() => new Date('2026-10-03T10:00:00Z'));
  const memory = new MemoryProvider();
  analytics.addProvider(memory);
  let listener: ((state: AppStateStatus) => void) | null = null;
  let clock = 0;
  let ids = 0;
  const stop = startSessions(
    {
      analytics,
      newId: () => `s${++ids}`,
      now: () => clock,
      onAppStateChange: (next) => {
        listener = next;
        return { remove: () => (listener = null) };
      },
    },
    { firstOpen: true, startupMs: 840 },
  );
  return {
    memory,
    stop,
    advance: (ms: number) => (clock += ms),
    emit: (state: AppStateStatus) => listener?.(state),
    listening: () => listener !== null,
  };
}

describe('analytics sessions', () => {
  it('opens a session on a cold start, with its start-up time', () => {
    const { memory } = setup();
    expect(memory.events).toHaveLength(1);
    expect(memory.events[0]).toMatchObject({
      name: 'app_opened',
      properties: { first_open: true, cold: true, startup_ms: 840 },
      context: { session_id: 's1' },
    });
  });

  it('keeps the session through a short trip away, and starts a new one after a long one', () => {
    const { memory, advance, emit } = setup();
    emit('background');
    advance(SESSION_GAP_MS - 1000);
    emit('active');
    expect(memory.events).toHaveLength(1);

    emit('background');
    advance(SESSION_GAP_MS);
    emit('active');
    expect(memory.events).toHaveLength(2);
    expect(memory.events[1]).toMatchObject({
      name: 'app_opened',
      properties: { first_open: false, cold: false },
      context: { session_id: 's2' },
    });
  });

  it('ignores becoming active without having been in the background', () => {
    const { memory, emit } = setup();
    emit('inactive');
    emit('active');
    expect(memory.events).toHaveLength(1);
  });

  it('stops listening when stopped', () => {
    const { stop, listening } = setup();
    stop();
    expect(listening()).toBe(false);
  });
});

describe('PostHog provider', () => {
  it('sends events by name with their properties, and registers the build variant', () => {
    const client = { capture: jest.fn(), register: jest.fn(() => Promise.resolve()) };
    const provider = new PostHogProvider(client, { build_variant: 'preview' });
    expect(client.register).toHaveBeenCalledWith({ build_variant: 'preview' });
    provider.track({
      name: 'lesson_completed',
      properties: { lesson_id: 'board-1', stars: 3 },
      context: { install_id: 'i', session_id: 's', platform: 'ios', app_version: '1.0.0 (3)' },
      timestamp: '2026-10-03T10:00:00.000Z',
    });
    expect(client.capture).toHaveBeenCalledWith('lesson_completed', { lesson_id: 'board-1', stars: 3 });
  });

  it('only receives events that passed the opt-out gate', () => {
    const client = { capture: jest.fn(), register: jest.fn() };
    const analytics = new Analytics();
    analytics.addProvider(new PostHogProvider(client));
    analytics.setEnabled(false);
    analytics.track('onboarding_started', {});
    expect(client.capture).not.toHaveBeenCalled();
    analytics.setEnabled(true);
    analytics.track('onboarding_started', {});
    expect(client.capture).toHaveBeenCalledTimes(1);
  });

  it('gives written feedback more room than other strings', () => {
    const memory = new MemoryProvider();
    const analytics = new Analytics();
    analytics.addProvider(memory);
    const text = 'x'.repeat(600);
    analytics.track('feedback_submitted', { context: 'profile', text });
    analytics.track('paywall_viewed', { source: text });
    expect(memory.events[0].properties.text).toHaveLength(600);
    expect(memory.events[1].properties.source).toHaveLength(120);
  });
});
