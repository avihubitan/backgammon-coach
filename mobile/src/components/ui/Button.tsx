import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { haptics } from '@/services/haptics';
import { colors, radii } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'success' | 'danger' | 'secondary' | 'ghost';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'large' | 'medium' | 'small';
  icon?: IconName;
  iconRight?: IconName;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
  testID?: string;
  children?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, { face: string; edge: string; text: string; border?: string }> = {
  primary: { face: colors.primary, edge: colors.primaryShadow, text: colors.textInverse },
  success: { face: colors.success, edge: colors.successShadow, text: colors.textInverse },
  danger: { face: colors.danger, edge: colors.dangerShadow, text: colors.textInverse },
  secondary: { face: colors.surfaceRaised, edge: '#0A0C0F', text: colors.text, border: colors.borderStrong },
  ghost: { face: 'transparent', edge: 'transparent', text: colors.textSecondary },
};

const SIZES = {
  large: { height: 56, paddingHorizontal: 24, edge: 4, icon: 22 },
  medium: { height: 48, paddingHorizontal: 20, edge: 4, icon: 20 },
  small: { height: 38, paddingHorizontal: 14, edge: 3, icon: 18 },
} as const;

/**
 * A tactile, chunky button: the face sits on a darker edge and sinks into it
 * when pressed, which reads clearly as a game control.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'large',
  icon,
  iconRight,
  disabled,
  loading,
  fullWidth = true,
  style,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const palette = disabled
    ? { face: colors.locked, edge: '#1C2027', text: colors.lockedText, border: undefined }
    : VARIANTS[variant];
  const metrics = SIZES[size];
  const hasEdge = variant !== 'ghost';

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPressIn={() => haptics.tap()}
      onPress={onPress}
      style={[fullWidth ? styles.fullWidth : styles.inline, style]}
    >
      {({ pressed }) => {
        const sink = hasEdge && pressed ? metrics.edge - 1 : 0;
        return (
          <View
            style={[
              styles.edge,
              {
                backgroundColor: hasEdge ? palette.edge : 'transparent',
                borderRadius: radii.lg,
                paddingBottom: hasEdge ? metrics.edge - sink : 0,
                marginTop: sink,
              },
            ]}
          >
            <View
              style={[
                styles.face,
                {
                  height: metrics.height,
                  paddingHorizontal: metrics.paddingHorizontal,
                  backgroundColor: palette.face,
                  borderRadius: radii.lg,
                  borderWidth: palette.border ? 1.5 : 0,
                  borderColor: palette.border,
                  opacity: variant === 'ghost' && pressed ? 0.6 : 1,
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator color={palette.text} />
              ) : (
                <>
                  {icon ? <Icon name={icon} size={metrics.icon} color={palette.text} /> : null}
                  <AppText
                    variant="button"
                    color={palette.text}
                    style={size === 'small' ? styles.smallLabel : undefined}
                    numberOfLines={1}
                  >
                    {label.toUpperCase()}
                  </AppText>
                  {iconRight ? <Icon name={iconRight} size={metrics.icon} color={palette.text} /> : null}
                </>
              )}
            </View>
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fullWidth: { alignSelf: 'stretch' },
  inline: { alignSelf: 'flex-start' },
  edge: {},
  face: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  smallLabel: { fontSize: 13, letterSpacing: 0.4 },
});
