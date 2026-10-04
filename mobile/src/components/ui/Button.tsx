import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { usePressScale } from '@/components/fx/usePressScale';
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
  /** A square button showing only the icon; the label is still read out by screen readers. */
  iconOnly?: boolean;
  /** A small count in the corner (e.g. uses left). */
  badge?: string | number | null;
  /** Tighter side padding and smaller type, for rows of buttons on narrow phones. */
  dense?: boolean;
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
  iconOnly,
  badge,
  dense,
}: ButtonProps) {
  const palette = disabled
    ? { face: colors.locked, edge: '#1C2027', text: colors.lockedText, border: undefined }
    : VARIANTS[variant];
  const metrics = SIZES[size];
  const hasEdge = variant !== 'ghost';
  const press = usePressScale(0.97);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPressIn={() => {
        haptics.tap();
        press.onPressIn();
      }}
      onPressOut={press.onPressOut}
      onPress={onPress}
      style={[fullWidth ? styles.fullWidth : styles.inline, style]}
    >
      {({ pressed }) => {
        const sink = hasEdge && pressed ? metrics.edge - 1 : 0;
        return (
          <Animated.View
            style={[
              press.style,
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
                  paddingHorizontal: iconOnly ? 0 : dense ? 10 : metrics.paddingHorizontal,
                  width: iconOnly ? metrics.height : undefined,
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
                  {icon ? <Icon name={icon} size={iconOnly ? metrics.icon + 4 : metrics.icon} color={palette.text} /> : null}
                  {iconOnly ? null : (
                    <AppText
                      variant="button"
                      color={palette.text}
                      style={size === 'small' || dense ? styles.smallLabel : undefined}
                      numberOfLines={1}
                      // Larger system text: the label shrinks a little rather than being cut off.
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                    >
                      {label.toUpperCase()}
                    </AppText>
                  )}
                  {iconRight ? <Icon name={iconRight} size={metrics.icon} color={palette.text} /> : null}
                </>
              )}
            </View>
            {badge !== undefined && badge !== null ? (
              <View style={styles.badge} testID={testID ? `${testID}-badge` : undefined}>
                <AppText variant="caption" color="textInverse">
                  {badge}
                </AppText>
              </View>
            ) : null}
          </Animated.View>
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
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.bg,
  },
});
