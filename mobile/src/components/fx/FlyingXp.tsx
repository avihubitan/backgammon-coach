import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { colors } from '@/theme';

export interface ScreenPoint {
  x: number;
  y: number;
}

interface FlyingXpProps {
  /** Window coordinates where the token appears. */
  from: ScreenPoint;
  /** Window coordinates of the counter it flies into. */
  to: ScreenPoint;
  amount: number;
  onArrive?: () => void;
}

const POP_MS = 260;
const TRAVEL_MS = 620;
const WIDTH = 78;
const HEIGHT = 30;

/**
 * "+10 XP" pops up where it was earned, then arcs into the XP counter.
 * Place it in an overlay that covers the window.
 */
export function FlyingXp({ from, to, amount, onArrive }: FlyingXpProps) {
  const reduceMotion = useReducedMotion();
  const pop = useSharedValue(0);
  const travel = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      onArrive?.();
      return;
    }
    pop.value = withSpring(1, { damping: 9, stiffness: 240, mass: 0.6 });
    travel.value = withDelay(POP_MS, withTiming(1, { duration: TRAVEL_MS, easing: Easing.inOut(Easing.cubic) }));
    const arrive = setTimeout(() => onArrive?.(), POP_MS + TRAVEL_MS);
    return () => clearTimeout(arrive);
    // One flight per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Arc up and over toward the counter.
  const cx = (from.x + to.x) / 2 + (to.x >= from.x ? -50 : 50);
  const cy = Math.min(from.y, to.y) - 40;

  const style = useAnimatedStyle(() => {
    const p = travel.value;
    const q = 1 - p;
    const x = q * q * from.x + 2 * q * p * cx + p * p * to.x;
    const y = q * q * from.y + 2 * q * p * cy + p * p * to.y;
    return {
      opacity: p > 0.88 ? Math.max(0, (1 - p) / 0.12) : Math.min(1, pop.value * 1.5),
      transform: [
        { translateX: x - WIDTH / 2 },
        { translateY: y - HEIGHT / 2 },
        { scale: Math.max(0.01, pop.value) * (1 - 0.5 * p) },
      ],
    };
  });

  if (reduceMotion) return null;
  return (
    <Animated.View style={[styles.token, style, { pointerEvents: 'none' }]}>
      <Icon name="lightning-bolt" size={16} color={colors.textInverse} />
      <AppText variant="smallStrong" color="textInverse">
        +{amount} XP
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  token: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: WIDTH,
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    backgroundColor: colors.xp,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    boxShadow: `0px 0px 14px rgba(243, 184, 71, 0.8)`,
  },
});
