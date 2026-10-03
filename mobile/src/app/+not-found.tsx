import { router, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { colors, SCREEN_GUTTER, spacing } from '@/theme';

/**
 * A link to a page the app doesn't have (an old or mistyped link). Replaces
 * the router's developer screen, which offered a sitemap of internal routes.
 */
export default function NotFoundRoute() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.huge }]} testID="not-found">
      <Stack.Screen options={{ headerShown: false }} />
      <Icon name="map-marker-question-outline" size={48} color="textMuted" />
      <AppText variant="title" align="center">
        Page not found
      </AppText>
      <AppText variant="body" color="textSecondary" align="center">
        This link doesn’t lead anywhere in the app. Your progress is safe.
      </AppText>
      <Button testID="not-found-home" label="Go to Home" icon="home" onPress={() => router.replace('/')} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: SCREEN_GUTTER,
  },
});
