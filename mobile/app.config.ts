import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * The app's configuration lives in app.json. This file only adds what depends
 * on the build environment.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [
    ...(config.plugins ?? []),
    // Uploads source maps and debug symbols to Sentry during release builds, so crash
    // reports show real file names and lines. Only when the build has a Sentry token
    // (an EAS secret, with SENTRY_ORG and SENTRY_PROJECT): without one the upload step
    // would fail the build. Crash reporting itself only needs EXPO_PUBLIC_SENTRY_DSN.
    ...(process.env.SENTRY_AUTH_TOKEN ? ['@sentry/react-native'] : []),
  ],
});
