/**
 * Links the stores require next to a subscription offer: Terms of Use (EULA)
 * and the Privacy Policy. Set EXPO_PUBLIC_TERMS_URL and EXPO_PUBLIC_PRIVACY_URL
 * for store builds. Without a terms URL, iOS uses Apple's standard EULA.
 */
export const APPLE_STANDARD_EULA = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

export interface LegalLinks {
  terms: string | null;
  privacy: string | null;
}

const url = (value: string | undefined) => (value && /^https:\/\//.test(value.trim()) ? value.trim() : null);

export function legalLinks(
  platform: string,
  env: { terms?: string; privacy?: string } = {
    terms: process.env.EXPO_PUBLIC_TERMS_URL,
    privacy: process.env.EXPO_PUBLIC_PRIVACY_URL,
  },
): LegalLinks {
  return {
    terms: url(env.terms) ?? (platform === 'ios' ? APPLE_STANDARD_EULA : null),
    privacy: url(env.privacy),
  };
}

/** Where the player manages or cancels a subscription, for this platform's store. */
export function subscriptionManagementUrl(platform: string, packageName = 'com.backgammoncoach.app'): string | null {
  if (platform === 'ios') return 'https://apps.apple.com/account/subscriptions';
  if (platform === 'android') return `https://play.google.com/store/account/subscriptions?package=${packageName}`;
  return null;
}
