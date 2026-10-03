import { router, type ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { analytics } from '@/services/analytics';
import { colors, spacing } from '@/theme';

/**
 * Shown instead of a blank screen when a screen fails to render. Progress is
 * stored separately, so trying again or going home loses nothing.
 */
export function CrashScreen({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    // The error's type only: messages could contain anything.
    analytics.track('app_error', { name: error.name || 'Error' });
  }, [error]);

  return (
    <View style={styles.root} testID="crash-screen">
      <Icon name="emoticon-confused-outline" size={56} color={colors.textMuted} />
      <AppText variant="title" align="center">
        Something went wrong
      </AppText>
      <AppText variant="body" color="textSecondary" align="center">
        Your progress is safe. Try again, or head back to the start.
      </AppText>
      <View style={styles.actions}>
        <Button testID="crash-retry" label="Try again" icon="restart" onPress={() => void retry()} />
        <Button
          testID="crash-home"
          label="Go to Home"
          variant="ghost"
          size="medium"
          onPress={() => {
            void retry().finally(() => router.replace('/'));
          }}
        />
      </View>
      {__DEV__ ? (
        <AppText variant="caption" color="textMuted" align="center" selectable>
          {error.message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },
  actions: { alignSelf: 'stretch', gap: spacing.xs, marginTop: spacing.md, maxWidth: 420, width: '100%' },
});
