import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { colors, radii, spacing } from '@/theme';

import type { CoachHint } from '../coachHint';

/** The coach's suggestion, shown where the turn status usually is. */
export function CoachHintBubble({ hint, following, compact = false }: { hint: CoachHint; following: boolean; compact?: boolean }) {
  return (
    <Animated.View
      testID="coach-hint"
      style={[
        styles.bubble,
        {
          animationName: { from: { opacity: 0, transform: [{ translateY: 8 }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } },
          animationDuration: 220,
        },
      ]}
    >
      <View style={styles.title}>
        <Icon name="lightbulb-on" size={18} color={colors.primary} />
        <AppText variant="smallStrong">
          Coach’s move:{' '}
          <AppText variant="smallStrong" color="primary">
            {hint.notation}
          </AppText>
        </AppText>
      </View>
      <AppText variant={compact ? 'caption' : 'small'} color="textSecondary">
        {following ? hint.reason : 'You played something else. Tap Hint again to take it back and follow the arrows.'}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(243, 184, 71, 0.35)',
  },
  title: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
