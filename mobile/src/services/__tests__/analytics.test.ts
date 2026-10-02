import { Analytics, MemoryProvider, sanitize } from '../analytics/analytics';

describe('analytics', () => {
  const now = () => new Date('2026-10-02T12:00:00Z');

  it('delivers typed events with context to every provider', () => {
    const analytics = new Analytics(now);
    const memory = new MemoryProvider();
    analytics.addProvider(memory);
    analytics.configure({ install_id: 'abc', session_id: 's1', platform: 'ios', app_version: '1.0.0' });
    analytics.track('lesson_completed', {
      lesson_id: 'board-1',
      section_id: 'board',
      stars: 3,
      accuracy: 0.912345,
      duration_ms: 64000,
      xp: 40,
      replay: false,
      retry_count: 0,
    });
    expect(memory.events).toHaveLength(1);
    expect(memory.events[0]).toMatchObject({
      name: 'lesson_completed',
      timestamp: '2026-10-02T12:00:00.000Z',
      context: { install_id: 'abc', session_id: 's1', platform: 'ios' },
      properties: { lesson_id: 'board-1', accuracy: 0.912, stars: 3 },
    });
  });

  it('sends nothing after the player opts out', () => {
    const analytics = new Analytics(now);
    const memory = new MemoryProvider();
    analytics.addProvider(memory);
    analytics.setEnabled(false);
    analytics.track('app_opened', { first_open: true });
    expect(memory.events).toHaveLength(0);
  });

  it('keeps only flat primitives', () => {
    expect(sanitize({ a: 1, b: 'x'.repeat(500), c: { nested: true }, d: [1], e: undefined, f: Infinity, g: false })).toEqual({
      a: 1,
      b: 'x'.repeat(120),
      f: null,
      g: false,
    });
  });

  it('isolates failing providers', () => {
    const analytics = new Analytics(now);
    const memory = new MemoryProvider();
    analytics.addProvider({ name: 'broken', track: () => { throw new Error('boom'); } });
    analytics.addProvider(memory);
    expect(() => analytics.track('onboarding_started', {})).not.toThrow();
    expect(memory.events).toHaveLength(1);
  });
});
