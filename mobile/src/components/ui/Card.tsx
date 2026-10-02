import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { haptics } from '@/services/haptics';
import { colors, radii, spacing } from '@/theme';

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
  tone?: 'default' | 'raised' | 'accent';
}

export function Card({ children, style, onPress, accessibilityLabel, testID, tone = 'default' }: CardProps) {
  const toneStyle =
    tone === 'raised' ? styles.raised : tone === 'accent' ? styles.accent : styles.default;
  if (!onPress) {
    return (
      <View testID={testID} style={[styles.base, toneStyle, style]}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => haptics.tap()}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        toneStyle,
        pressed && styles.pressed,
        style,
      ]}
    >
      {children}
    </Pressable>
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
  pressed: { transform: [{ scale: 0.985 }], backgroundColor: colors.surfacePressed },
});
