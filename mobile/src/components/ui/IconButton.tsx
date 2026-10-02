import { Pressable, StyleSheet } from 'react-native';

import { haptics } from '@/services/haptics';
import { colors, radii } from '@/theme';

import { Icon, type IconName } from './Icon';

interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  color?: string;
  disabled?: boolean;
  testID?: string;
  filled?: boolean;
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 24,
  color = colors.textSecondary,
  disabled,
  testID,
  filled,
}: IconButtonProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={10}
      onPressIn={() => haptics.tap()}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        filled && styles.filled,
        { opacity: disabled ? 0.35 : pressed ? 0.6 : 1 },
      ]}
    >
      <Icon name={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  filled: { backgroundColor: colors.surfaceRaised },
});
