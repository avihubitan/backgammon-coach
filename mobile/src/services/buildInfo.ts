import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Which EAS profile built this app (EXPO_PUBLIC_APP_VARIANT in eas.json). */
export type BuildVariant = 'development' | 'preview' | 'production';

export function buildVariant(
  variant: string | undefined = process.env.EXPO_PUBLIC_APP_VARIANT,
  dev: boolean = __DEV__,
): BuildVariant {
  if (variant === 'development' || variant === 'preview' || variant === 'production') return variant;
  // A release build without the variant is treated as production: test tools stay hidden.
  return dev ? 'development' : 'production';
}

/** What testers quote in bug reports, and what reports are grouped by. */
export const buildInfo = {
  variant: buildVariant(),
  version: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '0',
  /** iOS build number / Android version code (set by EAS); null on web and in development. */
  build: Application.nativeBuildVersion ?? null,
  platform: Platform.OS,
};

/** "1.0.0 (14)", or "1.0.0" when there is no build number. */
export function versionLabel(info: { version: string; build: string | null } = buildInfo): string {
  return info.build && info.build !== info.version ? `${info.version} (${info.build})` : info.version;
}
