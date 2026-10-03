/**
 * What we sell, as configuration. Prices are never set here: they come from
 * the store (localised per region) through the SubscriptionService.
 */
export type ProductId = 'premium_monthly' | 'premium_annual' | 'premium_lifetime';
export type BillingPeriod = 'month' | 'year' | 'lifetime';

export interface ProductConfig {
  id: ProductId;
  /** Identifiers in App Store Connect / Google Play Console. */
  storeIds: { ios: string; android: string };
  period: BillingPeriod;
  /** Free trial offered to new subscribers (the store decides eligibility). */
  trialDays?: number;
  /** Shown first and marked as the best value. */
  highlight?: boolean;
  /** Off until we decide to sell it. */
  enabled: boolean;
}

export const PRODUCTS: ProductConfig[] = [
  {
    id: 'premium_annual',
    storeIds: { ios: 'com.backgammoncoach.premium.annual', android: 'premium_annual' },
    period: 'year',
    trialDays: 7,
    highlight: true,
    enabled: true,
  },
  {
    id: 'premium_monthly',
    storeIds: { ios: 'com.backgammoncoach.premium.monthly', android: 'premium_monthly' },
    period: 'month',
    enabled: true,
  },
  {
    id: 'premium_lifetime',
    storeIds: { ios: 'com.backgammoncoach.premium.lifetime', android: 'premium_lifetime' },
    period: 'lifetime',
    enabled: false,
  },
];

export const enabledProducts = (): ProductConfig[] => PRODUCTS.filter((product) => product.enabled);

export function productConfig(id: ProductId): ProductConfig | undefined {
  return PRODUCTS.find((product) => product.id === id);
}

/** What Premium adds, shown on the paywall. Keep in sync with the access policy. */
export const PREMIUM_BENEFITS: { icon: string; title: string; text: string }[] = [
  { icon: 'school', title: 'Unlimited coaching', text: 'A full review of every game, and as many hints as you like while you play.' },
  { icon: 'auto-fix', title: 'Practise your own mistakes', text: 'Positions you got wrong come back until you get them right.' },
  { icon: 'chart-line', title: 'Advanced analysis', text: 'Win chances behind every tip, and your move quality game by game.' },
  { icon: 'book-open-page-variant', title: 'Advanced courses', text: 'The middle game, racing, the doubling cube and advanced strategy.' },
  { icon: 'palette', title: 'Board styles', text: 'Play on the Midnight and Royal boards. Purely cosmetic.' },
];

/** What stays free for everyone: the promise that keeps the paywall honest. */
export const FREE_FOREVER = [
  'The complete beginner course and Opening Moves',
  'The first lesson of every advanced course',
  'Daily challenges and skill drills',
  'Games against the computer at every level',
  'A coach summary of every game, a full review each day, and 3 hints per game',
];
