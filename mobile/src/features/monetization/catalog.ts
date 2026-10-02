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
  { icon: 'school', title: 'Unlimited coach reviews', text: 'A full move-by-move review of every game, explained in plain words.' },
  { icon: 'auto-fix', title: 'Practise your own mistakes', text: 'Positions you got wrong come back until you get them right.' },
  { icon: 'chart-line', title: 'Advanced analysis', text: 'Win chances and equity behind every coaching tip.' },
  { icon: 'book-open-page-variant', title: 'Advanced courses', text: 'Doubling cube, openings, middle game and more as they’re released.' },
];

/** What stays free for everyone: the promise that keeps the paywall honest. */
export const FREE_FOREVER = [
  'The complete beginner course',
  'Daily challenges and skill drills',
  'Games against the computer at every level',
  'A coach summary of every game, plus a full review each day',
];
