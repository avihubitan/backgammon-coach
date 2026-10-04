import { gameLayout, LAYOUT } from '../gameLayout';

// Width × height in points, with the usual safe-area insets.
const PHONES = {
  'small Android / iPhone SE 1': { width: 320, height: 568, insets: { top: 20, bottom: 0 } },
  'Android 360': { width: 360, height: 640, insets: { top: 24, bottom: 0 } },
  'iPhone SE': { width: 375, height: 667, insets: { top: 20, bottom: 0 } },
  'iPhone 13–16': { width: 390, height: 844, insets: { top: 47, bottom: 34 } },
  'Pixel 7': { width: 412, height: 915, insets: { top: 24, bottom: 24 } },
  'iPhone Pro Max': { width: 430, height: 932, insets: { top: 59, bottom: 34 } },
  'tall Android 20:9': { width: 360, height: 800, insets: { top: 24, bottom: 16 } },
};

describe('game screen layout', () => {
  it.each(Object.entries(PHONES))('fits everything on a %s without overlap', (_name, phone) => {
    const layout = gameLayout(phone.width, phone.height, phone.insets);
    const used =
      phone.insets.top + layout.topBar + 2 * layout.seat + layout.boardHeight + layout.panel + layout.actions + layout.bottomInset;
    expect(layout.spare).toBeGreaterThanOrEqual(0);
    expect(used + layout.spare).toBeLessThanOrEqual(phone.height);
    expect(layout.boardWidth).toBeGreaterThanOrEqual(LAYOUT.minBoardWidth);
    expect(layout.panel).toBeGreaterThanOrEqual(LAYOUT.panel.min);
  });

  it('gives the board the full width on ordinary phones', () => {
    for (const name of ['iPhone SE', 'iPhone 13–16', 'Pixel 7', 'iPhone Pro Max', 'tall Android 20:9'] as const) {
      const phone = PHONES[name];
      expect(gameLayout(phone.width, phone.height, phone.insets).boardWidth).toBe(phone.width);
    }
  });

  it('lays short screens out compact and keeps room for the coach', () => {
    const se = gameLayout(375, 667, { top: 20, bottom: 0 });
    expect(se.compact).toBe(true);
    const tall = gameLayout(390, 844, { top: 47, bottom: 34 });
    expect(tall.compact).toBe(false);
    expect(tall.panel).toBe(LAYOUT.panel.max);
    // Leftover height goes around the board instead of piling up under it.
    expect(tall.spare).toBeGreaterThan(0);
  });

  it('stays phone-shaped on a tablet', () => {
    const ipad = gameLayout(820, 1180, { top: 24, bottom: 20 });
    expect(ipad.boardWidth).toBeLessThanOrEqual(520);
  });
});
