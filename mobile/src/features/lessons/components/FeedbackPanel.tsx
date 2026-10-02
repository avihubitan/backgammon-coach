import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ParticleBurst } from '@/components/fx/ParticleBurst';
import type { ScreenPoint } from '@/components/fx/FlyingXp';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { RichText } from '@/components/ui/RichText';
import { colors, radii, spacing } from '@/theme';

export interface Feedback {
  tone: 'correct' | 'wrong';
  title: string;
  message: string;
  /** XP earned by this answer (shown as a chip that flies to the counter). */
  xp?: number;
}

interface FeedbackPanelProps {
  feedback: Feedback;
  onContinue: () => void;
  onRetry?: () => void;
  onShowMe?: () => void;
  continueLabel?: string;
  /** Called once the XP chip has appeared, with its centre in window coordinates. */
  onXpLaunch?: (origin: ScreenPoint) => void;
}

const CORRECT_TITLES = ['Great move!', 'Nice!', 'Exactly!', 'Spot on!', 'Well played!'];

export function praise(seed: number): string {
  return CORRECT_TITLES[Math.abs(seed) % CORRECT_TITLES.length];
}

const PANEL_IN_MS = 260;

/**
 * Slides up from the bottom after an answer. Mistakes always explain why and
 * offer another try; nothing here is punishing.
 */
export function FeedbackPanel({ feedback, onContinue, onRetry, onShowMe, continueLabel, onXpLaunch }: FeedbackPanelProps) {
  const insets = useSafeAreaInsets();
  const correct = feedback.tone === 'correct';
  const accent = correct ? colors.success : colors.danger;
  const chipRef = useRef<View>(null);
  const xp = feedback.xp ?? 0;

  useEffect(() => {
    if (!correct || xp <= 0 || !onXpLaunch) return;
    // Launch once the panel has slid in and the chip has popped.
    const timer = setTimeout(() => {
      chipRef.current?.measureInWindow((x, y, width, height) => {
        if (width > 0) onXpLaunch({ x: x + width / 2, y: y + height / 2 });
      });
    }, PANEL_IN_MS + 220);
    return () => clearTimeout(timer);
    // One launch per answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          animationDuration: PANEL_IN_MS,
          animationTimingFunction: 'ease-out',
        },
      ]}
    >
      <View style={styles.header}>
        <View>
          <Animated.View
            style={[
              styles.badge,
              {
                backgroundColor: accent,
                animationName: correct
                  ? {
                      '0%': { transform: [{ scale: 0.3 }, { rotate: '-30deg' }] },
                      '60%': { transform: [{ scale: 1.25 }, { rotate: '8deg' }] },
                      '100%': { transform: [{ scale: 1 }, { rotate: '0deg' }] },
                    }
                  : {
                      '0%': { transform: [{ translateX: 0 }] },
                      '25%': { transform: [{ translateX: -4 }] },
                      '50%': { transform: [{ translateX: 4 }] },
                      '75%': { transform: [{ translateX: -2 }] },
                      '100%': { transform: [{ translateX: 0 }] },
                    },
                animationDuration: correct ? 420 : 360,
                animationDelay: PANEL_IN_MS - 60,
                animationFillMode: 'backwards',
              },
            ]}
          >
            <Icon name={correct ? 'check-bold' : 'lightbulb-on-outline'} size={18} color={colors.textInverse} />
          </Animated.View>
          {correct ? (
            <ParticleBurst
              x={14}
              y={14}
              delay={PANEL_IN_MS}
              count={10}
              radius={42}
              size={6}
              gravity={14}
              duration={650}
              shapes={['star', 'circle']}
              colors={[colors.success, '#B9FFE0', colors.star]}
              seed={feedback.title.length}
            />
          ) : null}
        </View>
        <AppText variant="heading" color={accent} style={styles.title}>
          {feedback.title}
        </AppText>
        {correct && xp > 0 ? (
          <Animated.View
            ref={chipRef}
            testID="feedback-xp"
            style={[
              styles.xpChip,
              {
                animationName: {
                  '0%': { opacity: 0, transform: [{ scale: 0.4 }] },
                  '70%': { opacity: 1, transform: [{ scale: 1.15 }] },
                  '100%': { opacity: 1, transform: [{ scale: 1 }] },
                },
                animationDuration: 320,
                animationDelay: PANEL_IN_MS,
                animationFillMode: 'backwards',
              },
            ]}
          >
            <Icon name="lightning-bolt" size={14} color={colors.xp} />
            <AppText variant="smallStrong" color={colors.xp}>
              +{xp} XP
            </AppText>
          </Animated.View>
        ) : null}
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
  title: { flex: 1 },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(243, 184, 71, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(243, 184, 71, 0.5)',
  },
  message: { marginBottom: spacing.xs },
  actions: { gap: spacing.xs, marginTop: spacing.xs },
});
