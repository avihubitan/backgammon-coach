import { APPLE_STANDARD_EULA, legalLinks, subscriptionManagementUrl } from '../legal';

describe('legal links', () => {
  it('uses the configured pages', () => {
    expect(legalLinks('android', { terms: 'https://example.com/terms', privacy: 'https://example.com/privacy' })).toEqual({
      terms: 'https://example.com/terms',
      privacy: 'https://example.com/privacy',
    });
  });

  it("falls back to Apple's standard EULA on iOS only, and never to a made-up privacy page", () => {
    expect(legalLinks('ios', {})).toEqual({ terms: APPLE_STANDARD_EULA, privacy: null });
    expect(legalLinks('android', {})).toEqual({ terms: null, privacy: null });
  });

  it('ignores anything that is not an https link', () => {
    expect(legalLinks('android', { terms: 'example.com', privacy: 'http://example.com' })).toEqual({ terms: null, privacy: null });
  });

  it('knows where each store manages subscriptions', () => {
    expect(subscriptionManagementUrl('ios')).toBe('https://apps.apple.com/account/subscriptions');
    expect(subscriptionManagementUrl('android')).toContain('package=com.backgammoncoach.app');
    expect(subscriptionManagementUrl('web')).toBeNull();
  });
});
