import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { usePressScale } from '@/components/fx/usePressScale';
import { haptics } from '@/services/haptics';
import { colors, radii, spacing } from '@/theme';

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
  tone?: 'default' | 'raised' | 'accent';
  /** Rise in when first shown, after this many ms (stagger cards on a screen). */
  enterDelay?: number;
}

const enter = (delay: number) => ({
  animationName: {
    from: { opacity: 0, transform: [{ translateY: 18 }] },
    to: { opacity: 1, transform: [{ translateY: 0 }] },
  },
  animationDuration: 420,
  animationDelay: delay,
  animationFillMode: 'backwards' as const,
  animationTimingFunction: 'ease-out' as const,
});

/** A surface for grouped content; tappable cards squeeze slightly when pressed. */
export function Card({ children, style, onPress, accessibilityLabel, testID, tone = 'default', enterDelay }: CardProps) {
  const toneStyle = tone === 'raised' ? styles.raised : tone === 'accent' ? styles.accent : styles.default;
  const press = usePressScale(0.975);
  const entrance = enterDelay !== undefined ? enter(enterDelay) : null;
  if (!onPress) {
    return (
      <Animated.View testID={testID} style={[styles.base, toneStyle, entrance, style]}>
        {children}
      </Animated.View>
    );
  }
  return (
    <Animated.View style={[entrance, press.style]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPressIn={() => {
          haptics.tap();
          press.onPressIn();
        }}
        onPressOut={press.onPressOut}
        onPress={onPress}
        style={({ pressed }) => [styles.base, toneStyle, pressed && styles.pressed, style]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
  },
  default: { backgroundColor: colors.surface, borderColor: colors.border },
  raised: { backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong },
  accent: { backgroundColor: colors.primarySoft, borderColor: 'rgba(243, 184, 71, 0.35)' },
  pressed: { backgroundColor: colors.surfacePressed },
});
