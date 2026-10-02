import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { RichText } from '@/components/ui/RichText';
import { colors, radii, spacing } from '@/theme';

export interface Feedback {
  tone: 'correct' | 'wrong';
  title: string;
  message: string;
}

interface FeedbackPanelProps {
  feedback: Feedback;
  onContinue: () => void;
  onRetry?: () => void;
  onShowMe?: () => void;
  continueLabel?: string;
}

const CORRECT_TITLES = ['Great move!', 'Nice!', 'Exactly!', 'Spot on!', 'Well played!'];

export function praise(seed: number): string {
  return CORRECT_TITLES[Math.abs(seed) % CORRECT_TITLES.length];
}

/**
 * Slides up from the bottom after an answer. Mistakes always explain why and
 * offer another try; nothing here is punishing.
 */
export function FeedbackPanel({ feedback, onContinue, onRetry, onShowMe, continueLabel }: FeedbackPanelProps) {
  const insets = useSafeAreaInsets();
  const correct = feedback.tone === 'correct';
  const accent = correct ? colors.success : colors.danger;
  return (
    <Animated.View
      testID={correct ? 'feedback-correct' : 'feedback-wrong'}
      accessibilityLiveRegion="polite"
      style={[
        styles.panel,
        {
          paddingBottom: Math.max(insets.bottom, spacing.lg),
          backgroundColor: correct ? '#10231A' : '#2A1513',
          borderTopColor: accent,
          animationName: {
            from: { transform: [{ translateY: 80 }], opacity: 0 },
            to: { transform: [{ translateY: 0 }], opacity: 1 },
          },
          animationDuration: 260,
          animationTimingFunction: 'ease-out',
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: accent }]}>
          <Icon name={correct ? 'check-bold' : 'lightbulb-on-outline'} size={18} color={colors.textInverse} />
        </View>
        <AppText variant="heading" color={accent}>
          {feedback.title}
        </AppText>
      </View>
      <RichText variant="body" color="text" style={styles.message}>
        {feedback.message}
      </RichText>
      <View style={styles.actions}>
        {correct || !onRetry ? (
          <Button
            testID="feedback-continue"
            label={continueLabel ?? 'Continue'}
            variant={correct ? 'success' : 'primary'}
            onPress={onContinue}
          />
        ) : (
          <>
            <Button testID="feedback-retry" label="Try again" variant="primary" onPress={onRetry} />
            {onShowMe ? (
              <Button testID="feedback-show-me" label="Show me" variant="ghost" size="medium" onPress={onShowMe} />
            ) : null}
          </>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderTopWidth: 2,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    gap: spacing.sm,
    zIndex: 100,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { marginBottom: spacing.xs },
  actions: { gap: spacing.xs, marginTop: spacing.xs },
});
