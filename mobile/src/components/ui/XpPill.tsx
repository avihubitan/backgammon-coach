import { useEffect, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors, radii, spacing } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

interface XpPillProps {
  value: number;
  /** Change to make the pill bump (XP just arrived). */
  bumpKey?: number;
  ref?: Ref<View>;
  testID?: string;
}

/** The XP counter that flying XP lands in; it bumps and flashes on arrival. */
export function XpPill({ value, bumpKey = 0, ref, testID }: XpPillProps) {
  const scale = useSharedValue(1);
  const flash = useSharedValue(0);

  useEffect(() => {
    if (bumpKey === 0) return;
    scale.value = withSequence(withTiming(1.28, { duration: 90 }), withSpring(1, { damping: 6, stiffness: 260 }));
    flash.value = withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 520 }));
  }, [bumpKey, scale, flash]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  return (
    <Animated.View
      ref={ref}
      testID={testID}
      accessibilityLabel={`${value} XP earned`}
      style={[styles.pill, style]}
    >
      <Animated.View style={[styles.flash, flashStyle, { pointerEvents: 'none' }]} />
      <Icon name="lightning-bolt" size={16} color={colors.xp} />
      <AppText variant="smallStrong" color={colors.xp} style={styles.value}>
        {value}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  flash: {
    position: 'absolute',
    left: -1.5,
    right: -1.5,
    top: -1.5,
    bottom: -1.5,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.xp,
    boxShadow: '0px 0px 14px rgba(243, 184, 71, 0.85)',
  },
  value: { minWidth: 18, textAlign: 'center' },
});
