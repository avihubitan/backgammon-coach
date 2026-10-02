import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ParticleBurst } from '@/components/fx/ParticleBurst';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { analytics } from '@/services/analytics';
import { feedback } from '@/services/feedback';
import { subscriptionService, type StoreProduct } from '@/services/purchases';
import { useEntitlementsStore } from '@/state/entitlementsStore';
import { colors, MAX_CONTENT_WIDTH, radii, SCREEN_GUTTER, spacing } from '@/theme';

import { FREE_FOREVER, PREMIUM_BENEFITS, type ProductId } from './catalog';

const HEADLINES: Record<string, string> = {
  coach_review: 'Get a full coach review of every game.',
  mistakes: 'Turn your mistakes into strengths.',
  analysis: 'See the numbers behind every tip.',
  lesson: 'Unlock every advanced course.',
  lesson_complete: 'Unlock every advanced course.',
  home: 'Keep learning with every advanced course.',
};

const PERIOD_WORD = { month: 'month', year: 'year', lifetime: 'one-time purchase' } as const;

/** Premium offer: what you get, what stays free, the exact price and terms. */
export function PaywallScreen({ source }: { source: string }) {
  const insets = useSafeAreaInsets();
  const products = useEntitlementsStore((state) => state.products);
  const loadProducts = useEntitlementsStore((state) => state.loadProducts);
  const purchase = useEntitlementsStore((state) => state.purchase);
  const restore = useEntitlementsStore((state) => state.restore);
  const isPremium = useEntitlementsStore((state) => state.entitlements.isPremium);
  const [selectedId, setSelectedId] = useState<ProductId | null>(null);
  const [busy, setBusy] = useState<'purchase' | 'restore' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [welcome, setWelcome] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    analytics.track('paywall_viewed', { source });
    if (subscriptionService.available) loadProducts().catch(() => setLoadFailed(true));
    // Once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const selected: StoreProduct | undefined =
    products?.find((product) => product.id === selectedId) ?? products?.[0];

  const buy = async () => {
    if (!selected) return;
    setBusy('purchase');
    setMessage(null);
    const result = await purchase(selected.id);
    setBusy(null);
    if (result.status === 'success') {
      feedback.levelUp();
      setWelcome(true);
    } else if (result.status === 'failed') {
      setMessage(result.reason);
    } else if (result.status === 'pending') {
      setMessage('Your purchase is pending approval. Premium unlocks as soon as it goes through.');
    }
  };

  const restorePurchases = async () => {
    setBusy('restore');
    setMessage(null);
    const restored = await restore().catch(() => false);
    setBusy(null);
    setMessage(restored ? 'Welcome back! Premium is active again.' : 'No previous purchases were found for this account.');
    if (restored) setWelcome(true);
  };

  if (welcome || (isPremium && !busy && !message)) {
    return <PremiumWelcome onDone={close} />;
  }

  const store = Platform.OS === 'ios' ? 'App Store' : Platform.OS === 'android' ? 'Google Play' : 'store';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="paywall">
      <View style={styles.glow} pointerEvents="none" />
      <View style={styles.topBar}>
        <IconButton testID="paywall-close" icon="close" accessibilityLabel="Close" onPress={close} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 220 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Animated.View
            style={[
              styles.crown,
              {
                animationName: {
                  '0%': { opacity: 0, transform: [{ scale: 0.3 }, { rotate: '-25deg' }] },
                  '65%': { opacity: 1, transform: [{ scale: 1.12 }, { rotate: '6deg' }] },
                  '100%': { opacity: 1, transform: [{ scale: 1 }, { rotate: '0deg' }] },
                },
                animationDuration: 600,
              },
            ]}
          >
            <Icon name="crown" size={44} color="textInverse" />
          </Animated.View>
          <AppText variant="label" color="primary">
            Backgammon Coach Premium
          </AppText>
          <AppText variant="display" align="center">
            {HEADLINES[source] ?? 'Learn faster with a coach that knows your game.'}
          </AppText>
        </View>

        <View style={styles.benefits}>
          {PREMIUM_BENEFITS.map((benefit, index) => (
            <Animated.View
              key={benefit.title}
              style={[
                styles.benefit,
                {
                  animationName: {
                    from: { opacity: 0, transform: [{ translateX: -14 }] },
                    to: { opacity: 1, transform: [{ translateX: 0 }] },
                  },
                  animationDuration: 320,
                  animationDelay: 150 + index * 90,
                  animationFillMode: 'backwards',
                },
              ]}
            >
              <View style={styles.benefitIcon}>
                <Icon name={benefit.icon as IconName} size={20} color={colors.primary} />
              </View>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{benefit.title}</AppText>
                <AppText variant="small" color="textSecondary">
                  {benefit.text}
                </AppText>
              </View>
            </Animated.View>
          ))}
        </View>

        <View style={styles.free}>
          <AppText variant="label" color="success">
            Always free
          </AppText>
          {FREE_FOREVER.map((item) => (
            <View key={item} style={styles.freeRow}>
              <Icon name="check" size={16} color={colors.success} />
              <AppText variant="small" color="textSecondary" style={styles.flex}>
                {item}
              </AppText>
            </View>
          ))}
        </View>

        {!subscriptionService.available ? (
          <View style={styles.notice} testID="paywall-unavailable">
            <Icon name="information-outline" size={20} color={colors.info} />
            <AppText variant="small" color="textSecondary" style={styles.flex}>
              Premium isn’t on sale in this version yet. Everything above that’s free stays free.
            </AppText>
          </View>
        ) : loadFailed ? (
          <View style={styles.notice}>
            <Icon name="wifi-off" size={20} color={colors.danger} />
            <AppText variant="small" color="textSecondary" style={styles.flex}>
              Couldn’t reach the {store}. Check your connection and try again.
            </AppText>
          </View>
        ) : !products ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : (
          <View style={styles.plans}>
            {products.map((product) => {
              const active = product.id === selected?.id;
              return (
                <Pressable
                  key={product.id}
                  testID={`plan-${product.id}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  onPress={() => setSelectedId(product.id)}
                  style={[styles.plan, active && styles.planActive]}
                >
                  <View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioDot} /> : null}</View>
                  <View style={styles.flex}>
                    <View style={styles.planTitleRow}>
                      <AppText variant="bodyStrong">{product.title}</AppText>
                      {product.trialDays ? (
                        <View style={styles.badge}>
                          <AppText variant="caption" color="textInverse">
                            {product.trialDays}-DAY FREE TRIAL
                          </AppText>
                        </View>
                      ) : null}
                    </View>
                    <AppText variant="small" color="textSecondary">
                      {product.price.formatted} / {PERIOD_WORD[product.period]}
                      {product.monthlyEquivalent ? ` · ${product.monthlyEquivalent} per month` : ''}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {selected ? (
          <AppText variant="caption" color="textMuted" style={styles.terms} testID="paywall-terms">
            {selected.trialDays
              ? `Free for ${selected.trialDays} days, then ${selected.price.formatted} per ${PERIOD_WORD[selected.period]}. Cancel any time before the trial ends and you won’t be charged. `
              : `${selected.price.formatted} per ${PERIOD_WORD[selected.period]}. `}
            Payment is charged to your {store} account. The subscription renews automatically at the same price unless
            you cancel at least 24 hours before the end of the current period, which you can do any time in your {store}{' '}
            account settings.
          </AppText>
        ) : null}

        {message ? (
          <AppText variant="small" color="textSecondary" align="center" testID="paywall-message">
            {message}
          </AppText>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        {selected ? (
          <AppText variant="smallStrong" color="textSecondary" align="center" testID="paywall-summary">
            {selected.trialDays
              ? `${selected.trialDays} days free, then ${selected.price.formatted} / ${PERIOD_WORD[selected.period]}`
              : `${selected.price.formatted} / ${PERIOD_WORD[selected.period]}`}
            {selected.period === 'lifetime' ? '' : ' · cancel anytime'}
          </AppText>
        ) : null}
        {subscriptionService.available ? (
          <Button
            testID="paywall-subscribe"
            label={selected?.trialDays ? 'Start free trial' : 'Subscribe'}
            icon="crown"
            loading={busy === 'purchase'}
            disabled={!selected || busy !== null}
            onPress={buy}
          />
        ) : null}
        <View style={styles.footerLinks}>
          {subscriptionService.available ? (
            <Pressable testID="paywall-restore" onPress={restorePurchases} disabled={busy !== null} accessibilityRole="button">
              <AppText variant="smallStrong" color="textSecondary">
                {busy === 'restore' ? 'Restoring…' : 'Restore purchases'}
              </AppText>
            </Pressable>
          ) : null}
          <Pressable onPress={close} accessibilityRole="button">
            <AppText variant="smallStrong" color="textSecondary">
              Not now
            </AppText>
          </Pressable>
        </View>
        {subscriptionService.name === 'mock' ? (
          <AppText variant="caption" color="textMuted" align="center">
            Development build: purchases are simulated and free.
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

function PremiumWelcome({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, styles.welcome, { paddingTop: insets.top }]} testID="premium-welcome">
      <View>
        <Animated.View
          style={[
            styles.crown,
            styles.crownLarge,
            {
              animationName: {
                '0%': { opacity: 0, transform: [{ scale: 0.2 }, { rotate: '-60deg' }] },
                '60%': { opacity: 1, transform: [{ scale: 1.2 }, { rotate: '8deg' }] },
                '100%': { opacity: 1, transform: [{ scale: 1 }, { rotate: '0deg' }] },
              },
              animationDuration: 700,
            },
          ]}
        >
          <Icon name="crown" size={64} color="textInverse" />
        </Animated.View>
        <ParticleBurst
          x={60}
          y={60}
          delay={250}
          count={26}
          radius={180}
          size={9}
          gravity={140}
          duration={1300}
          shapes={['confetti', 'star', 'circle']}
          colors={[colors.primary, colors.star, colors.success, '#FFFFFF']}
          seed={42}
        />
      </View>
      <AppText variant="display" align="center">
        Welcome to Premium!
      </AppText>
      <AppText variant="body" color="textSecondary" align="center">
        Every advanced course, unlimited coach reviews, practice built from your own games and advanced analysis
        are now unlocked.
      </AppText>
      <View style={styles.welcomeButton}>
        <Button testID="premium-continue" label="Let’s play" onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  glow: {
    position: 'absolute',
    top: -160,
    alignSelf: 'center',
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(243, 184, 71, 0.10)',
    boxShadow: '0px 0px 120px rgba(243, 184, 71, 0.25)',
  },
  topBar: { height: 52, paddingHorizontal: spacing.sm, justifyContent: 'center' },
  content: {
    paddingHorizontal: SCREEN_GUTTER,
    gap: spacing.xl,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  hero: { alignItems: 'center', gap: spacing.sm },
  crown: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 0px 30px rgba(243, 184, 71, 0.6)',
    marginBottom: spacing.sm,
  },
  crownLarge: { width: 120, height: 120, borderRadius: 60 },
  benefits: { gap: spacing.md },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  free: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(61, 214, 140, 0.3)',
    backgroundColor: colors.successSoft,
  },
  freeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loading: { marginVertical: spacing.xl },
  plans: { gap: spacing.sm },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  planActive: { borderColor: colors.primary, backgroundColor: 'rgba(243, 184, 71, 0.08)' },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.pill, backgroundColor: colors.success },
  terms: { lineHeight: 17 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SCREEN_GUTTER,
    paddingTop: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerLinks: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xxl },
  welcome: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingHorizontal: SCREEN_GUTTER },
  welcomeButton: { alignSelf: 'stretch', marginTop: spacing.lg },
});
