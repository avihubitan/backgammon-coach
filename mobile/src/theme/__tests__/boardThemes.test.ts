import { createFeatureAccess } from '@/features/monetization/access';
import { entitlementsFor, FREE_ENTITLEMENTS } from '@/features/monetization/entitlements';

import { boardColors } from '../colors';
import { BOARD_THEMES, getBoardTheme } from '../boardThemes';

/** WCAG relative luminance contrast between two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe('board styles', () => {
  it('have unique ids, complete palettes, and both free and Premium choices', () => {
    expect(new Set(BOARD_THEMES.map((theme) => theme.id)).size).toBe(BOARD_THEMES.length);
    for (const theme of BOARD_THEMES) {
      expect(Object.keys(theme.palette).sort()).toEqual(Object.keys(boardColors).sort());
    }
    expect(BOARD_THEMES.filter((theme) => theme.tier === 'free').length).toBeGreaterThanOrEqual(2);
    expect(BOARD_THEMES.some((theme) => theme.tier === 'premium')).toBe(true);
    expect(getBoardTheme('classic').palette).toEqual(boardColors);
    expect(getBoardTheme('no-such-style').id).toBe('classic');
  });

  // The shipped Classic board sets the bar: no style may be harder to read.
  it.each(BOARD_THEMES.map((theme) => [theme.id, theme] as const))('%s keeps checkers and points readable', (_id, theme) => {
    const p = theme.palette;
    for (const checker of [p.lightCheckerFace, p.darkCheckerFace]) {
      for (const point of [p.pointLightBase, p.pointDarkBase]) expect(contrast(checker, point)).toBeGreaterThanOrEqual(1.2);
    }
    for (const point of [p.pointLightBase, p.pointDarkBase]) expect(contrast(point, p.feltCenter)).toBeGreaterThanOrEqual(1.4);
    expect(contrast(p.lightCheckerFace, p.darkCheckerFace)).toBeGreaterThanOrEqual(4.5);
  });

  it('are cosmetic only: free styles for everyone, Premium styles with Premium', () => {
    const usage = { reviewedToday: [], unlockedReviews: [] };
    const free = createFeatureAccess(FREE_ENTITLEMENTS, usage);
    const premium = createFeatureAccess(
      entitlementsFor({ productId: 'premium_annual', period: 'year', expiresAt: '2027-01-01T00:00:00Z', inTrial: false }, new Date('2026-10-03')),
      usage,
    );
    for (const theme of BOARD_THEMES) {
      expect(free.canUseBoardTheme(theme.id)).toBe(theme.tier === 'free');
      expect(premium.canUseBoardTheme(theme.id)).toBe(true);
    }
  });
});
