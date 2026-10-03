import { createSentryReporter, scrubEvent, type SentrySdk } from '../sentryReporter';

function fakeSdk() {
  const sdk = {
    init: jest.fn(),
    close: jest.fn(() => Promise.resolve()),
    captureException: jest.fn(() => 'id'),
    wrap: jest.fn((component) => component),
  };
  return sdk as typeof sdk & SentrySdk;
}

function memoryConsent(initial: boolean) {
  let value = initial;
  return { read: () => value, write: jest.fn((next: boolean) => (value = next)) };
}

const deps = (overrides: Partial<Parameters<typeof createSentryReporter>[0]> = {}) => ({
  sdk: fakeSdk(),
  dsn: 'https://key@example.ingest.sentry.io/1',
  environment: 'preview',
  consent: memoryConsent(true),
  tracesSampleRate: 1,
  ...overrides,
});

describe('crash reporting', () => {
  it('starts at launch when the player allowed it last time, without personal data', () => {
    const options = deps();
    const reporter = createSentryReporter(options);
    reporter.startIfAllowed();
    expect(options.sdk.init).toHaveBeenCalledTimes(1);
    expect(options.sdk.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: options.dsn,
        environment: 'preview',
        sendDefaultPii: false,
        attachScreenshot: false,
        attachViewHierarchy: false,
      }),
    );
    expect(reporter.isEnabled()).toBe(true);
  });

  it('sends nothing at launch after the player opted out', () => {
    const options = deps({ consent: memoryConsent(false) });
    const reporter = createSentryReporter(options);
    reporter.startIfAllowed();
    reporter.captureException(new Error('boom'));
    expect(options.sdk.init).not.toHaveBeenCalled();
    expect(options.sdk.captureException).not.toHaveBeenCalled();
  });

  it('does nothing without a DSN', () => {
    const options = deps({ dsn: undefined });
    const reporter = createSentryReporter(options);
    reporter.startIfAllowed();
    reporter.setEnabled(true);
    expect(reporter.available).toBe(false);
    expect(options.sdk.init).not.toHaveBeenCalled();
    const Component = () => null;
    expect(reporter.wrap(Component)).toBe(Component);
  });

  it('follows the setting and remembers it for the next launch', () => {
    const options = deps();
    const reporter = createSentryReporter(options);
    reporter.startIfAllowed();

    reporter.setEnabled(false);
    expect(options.sdk.close).toHaveBeenCalledTimes(1);
    expect(options.consent.write).toHaveBeenLastCalledWith(false);
    reporter.captureException(new Error('after opting out'));
    expect(options.sdk.captureException).not.toHaveBeenCalled();

    reporter.setEnabled(true);
    reporter.setEnabled(true);
    expect(options.sdk.init).toHaveBeenCalledTimes(2);
    reporter.captureException(new Error('boom'), { source: 'error-boundary' });
    expect(options.sdk.captureException).toHaveBeenCalledWith(expect.any(Error), { tags: { source: 'error-boundary' } });
  });

  it('registers navigation once started, even when the ref arrives first', () => {
    const navigation = { registerNavigationContainer: jest.fn() };
    const options = deps({ consent: memoryConsent(false), navigation });
    const reporter = createSentryReporter(options);
    reporter.startIfAllowed();
    const ref = { current: null };
    reporter.trackNavigation(ref);
    expect(navigation.registerNavigationContainer).not.toHaveBeenCalled();
    reporter.setEnabled(true);
    expect(navigation.registerNavigationContainer).toHaveBeenCalledWith(ref);
  });

  it('keeps only the anonymous installation id on events', () => {
    const event = scrubEvent({
      user: { id: 'install-123', ip_address: '1.2.3.4', email: 'a@b.c' },
      server_name: 'Ana’s iPhone',
      contexts: { device: { name: 'Ana’s iPhone', model: 'iPhone15,2' } },
    });
    expect(event.user).toEqual({ id: 'install-123' });
    expect(event.server_name).toBeUndefined();
    expect(event.contexts?.device).toEqual({ model: 'iPhone15,2' });
  });
});
