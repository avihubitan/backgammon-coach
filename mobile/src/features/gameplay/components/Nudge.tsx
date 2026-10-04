import { useEffect, useRef, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

/**
 * Answers a tap that came too early with one small pulse, each time `nudgeKey`
 * changes. Never on mount, and without remounting what it wraps.
 */
export function Nudge({
  nudgeKey,
  amount = 1.06,
  style,
  children,
}: {
  nudgeKey: number | undefined;
  amount?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const seen = useRef(nudgeKey);
  useEffect(() => {
    if (nudgeKey === seen.current) return;
    seen.current = nudgeKey;
    if (nudgeKey === undefined || reduceMotion) return;
    scale.value = withSequence(withTiming(amount, { duration: 100 }), withTiming(1, { duration: 170 }));
  }, [nudgeKey, amount, reduceMotion, scale]);
  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[style, pulse]}>{children}</Animated.View>;
}
