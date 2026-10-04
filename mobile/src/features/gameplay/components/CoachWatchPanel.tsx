import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { colors, radii, spacing } from '@/theme';

import type { CoachWatchVerdict } from '../coachWatch';

/**
 * The coach's question before a clear mistake is confirmed: a clue first, the
 * answer only on request. "Try again" and "Show me" sit in the action row;
 * "Play anyway" keeps the move. Compact, under the board, so the position
 * stays in view while the player thinks again.
 */
export function CoachWatchPanel({
  verdict,
  lastFree,
  practised,
  onPlayAnyway,
  compact = false,
}: {
  verdict: CoachWatchVerdict;
  /** This was the last free check of the game. */
  lastFree: boolean;
  /** "You practised this in “Making Points”.", when a finished lesson taught the idea. */
  practised?: string | null;
  onPlayAnyway: () => void;
  compact?: boolean;
}) {
  return (
    <Animated.View
      testID="coach-watch"
      accessibilityLiveRegion="polite"
      style={[
        styles.panel,
        {
          animationName: { from: { opacity: 0, transform: [{ translateY: 8 }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } },
          animationDuration: 200,
        },
      ]}
    >
      <View style={styles.title}>
        <Icon name="eye-outline" size={16} color={colors.info} />
        <AppText variant="smallStrong" style={styles.flex}>
          Are you sure?
        </AppText>
        <Pressable
          testID="coach-watch-play"
          accessibilityRole="button"
          hitSlop={10}
          onPress={onPlayAnyway}
          style={({ pressed }) => [styles.anyway, pressed && styles.pressed]}
        >
          <AppText variant="caption" color="textSecondary">
            Play anyway
          </AppText>
          <Icon name="chevron-right" size={14} color={colors.textSecondary} />
        </Pressable>
      </View>
      <AppText variant={compact ? 'caption' : 'small'} color="textSecondary">
        There’s a stronger move here. Clue: {verdict.clue}
      </AppText>
      {practised ? (
        <View style={styles.practised}>
          <Icon name="school-outline" size={13} color={colors.info} />
          <AppText testID="coach-watch-practised" variant="caption" color="info" style={styles.flex}>
            {practised}
          </AppText>
        </View>
      ) : null}
      {lastFree ? (
        <AppText variant="caption" color="textMuted">
          Last free check this game. Premium checks every move.
        </AppText>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.infoSoft,
    borderWidth: 1,
    borderColor: 'rgba(98, 182, 255, 0.3)',
  },
  title: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  practised: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flex: { flex: 1 },
  anyway: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.sm,
    paddingVertical: 2,
  },
  pressed: { opacity: 0.6 },
});
