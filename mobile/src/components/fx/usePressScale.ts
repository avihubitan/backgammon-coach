import { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

/**
 * Tactile press feedback: the element squeezes slightly while pressed and
 * springs back with a little overshoot on release.
 */
export function usePressScale(pressedScale = 0.96) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return {
    style,
    onPressIn: () => {
      if (!reduceMotion) scale.set(withTiming(pressedScale, { duration: 90 }));
    },
    onPressOut: () => {
      if (!reduceMotion) scale.set(withSpring(1, { damping: 9, stiffness: 320, mass: 0.6 }));
    },
  };
}
