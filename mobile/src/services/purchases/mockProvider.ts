import { enabledProducts, type ProductId } from '@/features/monetization/catalog';
import { entitlementsFor, type ActivePurchase } from '@/features/monetization/entitlements';

import type { PurchaseResult, StoreProduct, SubscriptionService } from './types';

/**
 * Development-only store: lets the whole purchase flow be exercised without
 * App Store or Play accounts. Prices are sample data per currency, standing
 * in for the store's own regional pricing.
 */
const SAMPLE_PRICES: Record<string, Partial<Record<ProductId, number>>> = {
  USD: { premium_monthly: 7.99, premium_annual: 39.99, premium_lifetime: 99.99 },
  EUR: { premium_monthly: 7.99, premium_annual: 39.99, premium_lifetime: 99.99 },
  GBP: { premium_monthly: 6.99, premium_annual: 34.99, premium_lifetime: 89.99 },
  ILS: { premium_monthly: 29.9, premium_annual: 149.9, premium_lifetime: 349.9 },
};

const DAY = 24 * 60 * 60 * 1000;

/** Where the mock remembers its "purchases" between launches. */
export interface MockStoreStorage {
  load(): Promise<string | null>;
  save(value: string): Promise<void>;
}

export class MockSubscriptionService implements SubscriptionService {
  readonly name = 'mock';
  readonly available = true;
  private active: ActivePurchase | null = null;
  private usedTrial = false;
  private loaded: Promise<void> | null = null;

  constructor(
    private readonly currency: string = 'USD',
    private readonly locale: string = 'en-US',
    private readonly now: () => Date = () => new Date(),
    private readonly latencyMs = 600,
    private readonly storage?: MockStoreStorage,
  ) {}

  private load(): Promise<void> {
    this.loaded ??= (async () => {
      try {
        const raw = await this.storage?.load();
        if (!raw) return;
        const saved = JSON.parse(raw) as { active: ActivePurchase | null; usedTrial: boolean };
        this.active = saved.active;
        this.usedTrial = saved.usedTrial;
      } catch {
        // A corrupt mock store just starts empty.
      }
    })();
    return this.loaded;
  }

  private save() {
    this.storage?.save(JSON.stringify({ active: this.active, usedTrial: this.usedTrial })).catch(() => {});
  }

  private format(amount: number): string {
    try {
      return new Intl.NumberFormat(this.locale, { style: 'currency', currency: this.currency }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${this.currency}`;
    }
  }

  private wait() {
    return new Promise((resolve) => setTimeout(resolve, this.latencyMs));
  }

  async getProducts(): Promise<StoreProduct[]> {
    await this.load();
    await this.wait();
    const table = SAMPLE_PRICES[this.currency] ?? SAMPLE_PRICES.USD;
    return enabledProducts().flatMap((config) => {
      const amount = table[config.id];
      if (amount === undefined) return [];
      return [
        {
          id: config.id,
          period: config.period,
          title: config.period === 'year' ? 'Annual' : config.period === 'month' ? 'Monthly' : 'Lifetime',
          price: { amount, currency: this.currency, formatted: this.format(amount) },
          monthlyEquivalent: config.period === 'year' ? this.format(Math.floor((amount / 12) * 100) / 100) : undefined,
          trialDays: config.trialDays && !this.usedTrial ? config.trialDays : undefined,
        },
      ];
    });
  }

  async purchase(productId: ProductId): Promise<PurchaseResult> {
    await this.load();
    await this.wait();
    const config = enabledProducts().find((product) => product.id === productId);
    if (!config) return { status: 'failed', reason: 'This product is not available.' };
    const trial = !!config.trialDays && !this.usedTrial;
    if (trial) this.usedTrial = true;
    const days = trial ? config.trialDays! : config.period === 'year' ? 365 : 30;
    this.active = {
      productId,
      period: config.period,
      expiresAt: config.period === 'lifetime' ? null : new Date(this.now().getTime() + days * DAY).toISOString(),
      inTrial: trial,
    };
    this.save();
    return { status: 'success', entitlements: entitlementsFor(this.active, this.now()) };
  }

  async restorePurchases() {
    await this.load();
    await this.wait();
    const entitlements = entitlementsFor(this.active, this.now());
    return { restored: entitlements.isPremium, entitlements };
  }

  async getEntitlements() {
    await this.load();
    return entitlementsFor(this.active, this.now());
  }

  /** Dev tool: simulate the subscription ending. */
  async cancel() {
    await this.load();
    this.active = null;
    this.save();
  }
}
