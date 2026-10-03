import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Icon, type IconName } from '@/components/ui/Icon';
import { analytics, canSendFeedback } from '@/services/analytics';
import { haptics } from '@/services/haptics';
import { useFeedbackStore } from '@/state/feedbackStore';
import { todayKey } from '@/state/progressStore';
import { useSettingsStore } from '@/state/settingsStore';
import { colors, radii, spacing } from '@/theme';

import { FeedbackDialog } from './FeedbackDialog';
import { shouldAskFeedback, type FeedbackContext, type FeedbackRating } from './feedbackPolicy';

const CHOICES: { rating: FeedbackRating; icon: IconName; label: string }[] = [
  { rating: 'good', icon: 'thumb-up-outline', label: 'Good' },
  { rating: 'okay', icon: 'emoticon-neutral-outline', label: 'Okay' },
  { rating: 'bad', icon: 'thumb-down-outline', label: 'Not good' },
];

/**
 * "How was this?" after a lesson or a game, at most once a day. A rating is
 * one tap; "okay" and "not good" offer a box to say what went wrong.
 */
export function QuickFeedback({ context, subject }: { context: FeedbackContext; subject?: string }) {
  // Decided once when shown, so answering doesn't make it vanish mid-screen.
  const [ask] = useState(() =>
    shouldAskFeedback({
      canSend: canSendFeedback(useSettingsStore.getState().analytics),
      today: todayKey(),
      lastAskedDay: useFeedbackStore.getState().lastAskedDay,
    }),
  );
  const [rated, setRated] = useState<FeedbackRating | null>(null);
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    if (ask) useFeedbackStore.getState().markAsked(todayKey());
  }, [ask]);

  if (!ask) return null;

  const rate = (rating: FeedbackRating) => {
    if (rated) return;
    haptics.tap();
    setRated(rating);
    analytics.track('feedback_rated', { context, rating, subject });
    if (rating !== 'good') setWriting(true);
  };

  return (
    <View style={styles.row} testID="quick-feedback">
      {rated ? (
        <AppText variant="small" color="textSecondary" style={styles.flex} testID="quick-feedback-thanks">
          Thanks for telling us!
        </AppText>
      ) : (
        <>
          <AppText variant="smallStrong" color="textSecondary" style={styles.flex}>
            How was this {context}?
          </AppText>
          {CHOICES.map((choice) => (
            <Pressable
              key={choice.rating}
              testID={`feedback-${choice.rating}`}
              accessibilityRole="button"
              accessibilityLabel={choice.label}
              hitSlop={4}
              onPress={() => rate(choice.rating)}
              style={({ pressed }) => [styles.choice, pressed && styles.pressed]}
            >
              <Icon name={choice.icon} size={22} color={colors.textSecondary} />
            </Pressable>
          ))}
        </>
      )}
      <FeedbackDialog
        visible={writing}
        context={context}
        rating={rated ?? undefined}
        subject={subject}
        title="What could be better?"
        placeholder={context === 'lesson' ? 'What was confusing or too hard?' : 'What felt wrong in the game?'}
        onClose={() => setWriting(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    minHeight: 52,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    alignSelf: 'stretch',
  },
  flex: { flex: 1 },
  choice: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.surface },
});
