import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { colors, radii, spacing } from '@/theme';

import type { CoachWatchVerdict } from '../coachWatch';

/**
 * The coach's question before a clear mistake is confirmed: a clue first, the
 * answer only on request. "Try again" and "Show me" sit in the action row;
 * "Play anyway" keeps the move.
 */
export function CoachWatchPanel({
  verdict,
  lastFree,
  onPlayAnyway,
}: {
  verdict: CoachWatchVerdict;
  /** This was the last free check of the game. */
  lastFree: boolean;
  onPlayAnyway: () => void;
}) {
  return (
    <Animated.View
      testID="coach-watch"
      accessibilityLiveRegion="polite"
      style={[
        styles.panel,
        {
          animationName: { from: { opacity: 0, transform: [{ translateY: 10 }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } },
          animationDuration: 240,
        },
      ]}
    >
      <View style={styles.label}>
        <Icon name="eye-outline" size={16} color={colors.info} />
        <AppText variant="caption" color="info">
          COACH WATCH
        </AppText>
      </View>
      <AppText variant="smallStrong">Are you sure? There’s a stronger move here.</AppText>
      <AppText variant="small" color="textSecondary">
        Clue: {verdict.clue}
      </AppText>
      <View style={styles.anyway}>
        <Button testID="coach-watch-play" label="Play anyway" variant="ghost" size="small" fullWidth={false} onPress={onPlayAnyway} />
      </View>
      {lastFree ? (
        <AppText variant="caption" color="textMuted">
          That was the last Coach Watch check in this game. Premium checks every move.
        </AppText>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 2,
    borderRadius: radii.lg,
    backgroundColor: colors.infoSoft,
    borderWidth: 1,
    borderColor: 'rgba(98, 182, 255, 0.35)',
  },
  label: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  anyway: { alignItems: 'flex-start', marginLeft: -spacing.sm },
});
