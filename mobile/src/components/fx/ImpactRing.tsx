import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

interface ImpactRingProps {
  x: number;
  y: number;
  /** Diameter at rest; the ring expands to about twice this. */
  size: number;
  color?: string;
  delay?: number;
  duration?: number;
}

/** A shockwave ring with a bright flash, for hits and other impacts. */
export function ImpactRing({ x, y, size, color = '#FFFFFF', delay = 0, duration = 460 }: ImpactRingProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.quad) }));
  }, [progress, delay, duration]);

  const ringStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p <= 0 ? 0 : 1 - p,
      borderWidth: Math.max(0.5, 4 * (1 - p)),
      transform: [{ scale: 0.45 + 1.6 * p }],
    };
  });
  const flashStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const v = p <= 0 ? 0 : Math.max(0, 1 - p * 2.6);
    return { opacity: v * 0.85, transform: [{ scale: 0.6 + 0.7 * p }] };
  });

  if (reduceMotion) return null;
  return (
    <View style={[styles.origin, { left: x, top: y }, { pointerEvents: 'none' }]}>
      <Animated.View
        style={[
          styles.circle,
          { width: size, height: size, left: -size / 2, top: -size / 2, borderRadius: size, borderColor: color },
          ringStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.circle,
          styles.flash,
          { width: size, height: size, left: -size / 2, top: -size / 2, borderRadius: size },
          flashStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  origin: { position: 'absolute', width: 0, height: 0, overflow: 'visible', zIndex: 96 },
  circle: { position: 'absolute' },
  flash: { backgroundColor: 'rgba(255, 244, 214, 0.9)' },
});
