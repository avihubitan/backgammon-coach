// The build environment check (scripts/check-env.js), run before EAS builds.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { checkEnv } = require('../../scripts/check-env') as {
  checkEnv: (
    env: Record<string, string>,
    profile: string,
    platform?: string,
  ) => { level: string; name: string; message: string }[];
};

const errors = (env: Record<string, string>, profile: string) =>
  checkEnv(env, profile).filter((result) => result.level === 'error').map((result) => result.name);

const READY = {
  EXPO_PUBLIC_APP_VARIANT: 'production',
  EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'appl_AbCdEf123',
  EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'goog_AbCdEf123',
  EXPO_PUBLIC_SENTRY_DSN: 'https://0123abcd@o12345.ingest.de.sentry.io/678',
  SENTRY_AUTH_TOKEN: 'sntrys_secret',
  SENTRY_ORG: 'backgammon-coach',
  SENTRY_PROJECT: 'mobile',
  EXPO_PUBLIC_POSTHOG_KEY: 'phc_AbCdEf123',
  EXPO_PUBLIC_POSTHOG_HOST: 'https://eu.i.posthog.com',
  EXPO_PUBLIC_API_URL: 'https://api.example.com',
  EXPO_PUBLIC_PRIVACY_URL: 'https://example.com/privacy',
  EXPO_PUBLIC_TERMS_URL: 'https://example.com/terms',
};

describe('build environment check', () => {
  it('passes a complete production setup without a word', () => {
    expect(checkEnv(READY, 'production')).toEqual([]);
  });

  it('only warns when services are missing, so a first build still runs', () => {
    const results = checkEnv({ EXPO_PUBLIC_APP_VARIANT: 'preview' }, 'preview');
    expect(results.filter((result) => result.level === 'error')).toEqual([]);
    expect(results.filter((result) => result.level === 'warning').map((result) => result.name)).toEqual([
      'EXPO_PUBLIC_REVENUECAT_IOS_KEY',
      'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY',
      'EXPO_PUBLIC_SENTRY_DSN',
      'EXPO_PUBLIC_POSTHOG_KEY',
    ]);
  });

  it('on EAS, only asks for the key of the platform being built', () => {
    const results = checkEnv({ EXPO_PUBLIC_APP_VARIANT: 'preview' }, 'preview', 'android');
    expect(results.map((result) => result.name)).toContain('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY');
    expect(results.map((result) => result.name)).not.toContain('EXPO_PUBLIC_REVENUECAT_IOS_KEY');
  });

  it('refuses secrets in public variables, whatever the profile', () => {
    for (const secret of ['sk_live_123', 'sntrys_abc', 'phx_abc', 'mongodb+srv://user:pass@cluster/db']) {
      expect(errors({ EXPO_PUBLIC_API_URL: secret }, 'development')).toContain('EXPO_PUBLIC_API_URL');
    }
    // Secret build variables without the prefix are how it should be.
    expect(errors({ SENTRY_AUTH_TOKEN: 'sntrys_abc', SENTRY_ORG: 'o', SENTRY_PROJECT: 'p' }, 'preview')).toEqual([]);
  });

  it('refuses a Test Store key in production only, and swapped platform keys anywhere', () => {
    expect(errors({ ...READY, EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'test_abc' }, 'production')).toEqual([
      'EXPO_PUBLIC_REVENUECAT_IOS_KEY',
    ]);
    expect(errors({ ...READY, EXPO_PUBLIC_APP_VARIANT: 'preview', EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'test_abc' }, 'preview')).toEqual([]);
    expect(errors({ ...READY, EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'appl_abc' }, 'production')).toEqual([
      'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY',
    ]);
  });

  it('refuses addresses phones would block or the app would ignore', () => {
    expect(errors({ ...READY, EXPO_PUBLIC_API_URL: 'http://api.example.com' }, 'production')).toEqual(['EXPO_PUBLIC_API_URL']);
    expect(errors({ EXPO_PUBLIC_API_URL: 'http://192.168.1.20:3000' }, 'development')).toEqual([]);
    expect(errors({ ...READY, EXPO_PUBLIC_PRIVACY_URL: 'example.com/privacy' }, 'production')).toEqual([
      'EXPO_PUBLIC_PRIVACY_URL',
    ]);
    expect(errors({ ...READY, EXPO_PUBLIC_SENTRY_DSN: 'abc123' }, 'production')).toEqual(['EXPO_PUBLIC_SENTRY_DSN']);
  });

  it('catches a source map upload that would fail the build', () => {
    const { SENTRY_ORG: _org, ...withoutOrg } = READY;
    expect(errors(withoutOrg, 'production')).toEqual(['SENTRY_ORG']);
  });
});
