import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { MockSubscriptionService, subscriptionService } from '@/services/purchases';
import { useEntitlementsStore } from '@/state/entitlementsStore';
import { colors, radii, spacing } from '@/theme';

import { productConfig } from './catalog';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

/** Profile entry point: an invitation for free players, plan details for subscribers. */
export function PremiumCard() {
  const entitlements = useEntitlementsStore((state) => state.entitlements);
  const restore = useEntitlementsStore((state) => state.restore);
  const refresh = useEntitlementsStore((state) => state.refresh);
  const [note, setNote] = useState<string | null>(null);
  const store = Platform.OS === 'ios' ? 'App Store' : Platform.OS === 'android' ? 'Google Play' : 'store';

  if (!entitlements.isPremium) {
    return (
      <Card
        testID="premium-card"
        style={styles.card}
        onPress={() => router.push({ pathname: '/paywall', params: { source: 'profile' } })}
        accessibilityLabel="Backgammon Coach Premium"
      >
        <View style={styles.crown}>
          <Icon name="crown" size={24} color="textInverse" />
        </View>
        <View style={styles.flex}>
          <AppText variant="subheading">Go Premium</AppText>
          <AppText variant="small" color="textSecondary">
            Unlimited coach reviews and practice built from your own games.
          </AppText>
        </View>
        <Icon name="chevron-right" size={22} color="textMuted" />
      </Card>
    );
  }

  const period = entitlements.productId ? productConfig(entitlements.productId)?.period : null;
  const plan = period === 'year' ? 'Annual plan' : period === 'month' ? 'Monthly plan' : 'Lifetime';
  return (
    <Card testID="premium-active" style={styles.active}>
      <View style={styles.row}>
        <View style={styles.crown}>
          <Icon name="crown" size={24} color="textInverse" />
        </View>
        <View style={styles.flex}>
          <AppText variant="subheading" color="primary">
            Premium active
          </AppText>
          <AppText variant="small" color="textSecondary">
            {plan}
            {entitlements.expiresAt
              ? entitlements.inTrial
                ? ` · free trial until ${formatDate(entitlements.expiresAt)}`
                : ` · renews ${formatDate(entitlements.expiresAt)}`
              : ''}
          </AppText>
        </View>
      </View>
      <AppText variant="caption" color="textMuted">
        Manage or cancel your subscription in your {store} account settings.
      </AppText>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button
            label="Restore"
            variant="secondary"
            size="small"
            onPress={async () => setNote((await restore()) ? 'Purchases restored.' : 'Nothing to restore.')}
          />
        </View>
        {subscriptionService instanceof MockSubscriptionService ? (
          <View style={styles.flex}>
            <Button
              label="End (dev)"
              variant="ghost"
              size="small"
              onPress={async () => {
                await (subscriptionService as MockSubscriptionService).cancel();
                await refresh();
              }}
            />
          </View>
        ) : null}
      </View>
      {note ? (
        <AppText variant="caption" color="textSecondary">
          {note}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderColor: 'rgba(243, 184, 71, 0.4)' },
  active: { gap: spacing.md, borderColor: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  crown: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
});
