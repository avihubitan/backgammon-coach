import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { boardColors } from '@/theme';

import { CheckerFace, CheckerSlab } from './Checker';
import { slabRectInTray, type BoardMetrics, type Point2D } from './geometry';
import type { PlacedChecker } from './layout';
import type { Motion } from './motion';

interface AnimatedCheckerProps {
  checker: PlacedChecker;
  center: Point2D;
  /** This checker's flight in the latest update, if it moved. */
  motion: Motion | undefined;
  /** Increments on every layout update. */
  updateId: number;
  /** Picked up: the player selected it and is choosing a destination. */
  lifted: boolean;
  metrics: BoardMetrics;
  reduceMotion: boolean;
  zIndex: number;
}

const FLIGHT_EASING = Easing.inOut(Easing.cubic);

/**
 * One checker. Moves fly along a gentle arc toward the middle of the board,
 * rising (scale + separating shadow) at the top of the arc and landing with
 * a small squash. Everything runs on the UI thread via shared values.
 */
export function AnimatedChecker({
  checker,
  center,
  motion,
  updateId,
  lifted,
  metrics: m,
  reduceMotion,
  zIndex,
}: AnimatedCheckerProps) {
  const size = m.checker;
  const fromX = useSharedValue(center.x);
  const fromY = useSharedValue(center.y);
  const toX = useSharedValue(center.x);
  const toY = useSharedValue(center.y);
  const arcX = useSharedValue(0);
  const arcY = useSharedValue(0);
  const progress = useSharedValue(1);
  const hop = useSharedValue(0);
  const squash = useSharedValue(1);
  const lift = useSharedValue(lifted ? 1 : 0);
  const glow = useSharedValue(0);

  const applied = useRef({ x: center.x, y: center.y, updateId, width: m.width });

  useEffect(() => {
    const last = applied.current;
    const newFlight = !!motion && last.updateId !== updateId;
    const targetChanged = last.x !== center.x || last.y !== center.y;
    applied.current = { x: center.x, y: center.y, updateId, width: m.width };
    if (!newFlight && !targetChanged) return;

    if (last.width !== m.width) {
      // The board was resized: jump straight to the new spot.
      cancelAnimation(progress);
      fromX.value = center.x;
      fromY.value = center.y;
      toX.value = center.x;
      toY.value = center.y;
      arcX.value = 0;
      arcY.value = 0;
      progress.value = 1;
      return;
    }

    // Start from wherever the checker is on screen right now, even mid-flight.
    const p = progress.value;
    const s = Math.sin(Math.PI * p);
    const currentX = fromX.value + (toX.value - fromX.value) * p + arcX.value * s;
    const currentY = fromY.value + (toY.value - fromY.value) * p + arcY.value * s;
    fromX.value = currentX;
    fromY.value = currentY;
    toX.value = center.x;
    toY.value = center.y;

    if (newFlight && motion) {
      // A landing squash still pending from an earlier hop must not fire mid-air.
      cancelAnimation(squash);
      squash.value = 1;
      const dx = center.x - currentX;
      const dy = center.y - currentY;
      const distance = Math.hypot(dx, dy);
      let nx = distance > 0 ? -dy / distance : 0;
      let ny = distance > 0 ? dx / distance : 0;
      // Bend toward the middle of the board so flights never leave the playing area.
      const midX = (currentX + center.x) / 2;
      const midY = (currentY + center.y) / 2;
      if ((m.width / 2 - midX) * nx + (m.midY - midY) * ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      const bend = reduceMotion ? 0 : Math.min(size * (motion.kind === 'hit' ? 1.3 : 0.85), distance * 0.18);
      arcX.value = nx * bend;
      arcY.value = ny * bend;
      hop.value = reduceMotion ? 0 : motion.hop;
      progress.value = 0;
      progress.value = withDelay(
        motion.delay,
        withTiming(1, { duration: reduceMotion ? 180 : motion.duration, easing: FLIGHT_EASING }),
      );
      if (!reduceMotion) {
        squash.value = withDelay(
          motion.delay + motion.duration,
          withSequence(
            withTiming(motion.kind === 'hit' ? 0.9 : 0.84, { duration: 70, easing: Easing.out(Easing.quad) }),
            withSpring(1, { damping: 7, stiffness: 320, mass: 0.5 }),
          ),
        );
      }
    } else {
      // A stack re-spaced around it: slide into place.
      arcX.value = 0;
      arcY.value = 0;
      hop.value = 0;
      progress.value = 0;
      progress.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
    }
  }, [center.x, center.y, updateId, motion, m.width, m.midY, size, reduceMotion, progress, fromX, fromY, toX, toY, arcX, arcY, hop, squash]);

  useEffect(() => {
    if (reduceMotion) {
      lift.value = lifted ? 1 : 0;
      glow.value = lifted ? 1 : 0;
      return;
    }
    lift.value = withSpring(lifted ? 1 : 0, { damping: 9, stiffness: 260, mass: 0.6 });
    glow.value = lifted ? withRepeat(withTiming(1, { duration: 650, easing: Easing.inOut(Easing.sin) }), -1, true) : withTiming(0, { duration: 150 });
  }, [lifted, reduceMotion, lift, glow]);

  const positionStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const s = Math.sin(Math.PI * p);
    const x = fromX.value + (toX.value - fromX.value) * p + arcX.value * s;
    const y = fromY.value + (toY.value - fromY.value) * p + arcY.value * s;
    return { transform: [{ translateX: x - size / 2 }, { translateY: y - size / 2 }] };
  });

  const faceStyle = useAnimatedStyle(() => {
    const height = Math.max(hop.value * Math.sin(Math.PI * progress.value), lift.value * 0.13);
    return {
      transform: [{ translateY: -height * size * 0.45 }, { scale: (1 + height) * squash.value }],
    };
  });

  const shadowStyle = useAnimatedStyle(() => {
    const height = Math.max(hop.value * Math.sin(Math.PI * progress.value), lift.value * 0.13);
    return {
      opacity: Math.min(0.42, height * 2.4),
      transform: [{ translateX: height * size * 0.18 }, { translateY: height * size * 0.32 }, { scale: 1 + height * 0.35 }],
    };
  });

  const ringStyle = useAnimatedStyle(() => ({
    opacity: lift.value * (0.65 + 0.35 * glow.value),
    transform: [{ scale: 1.04 + 0.08 * glow.value }],
  }));

  // Borne-off checkers fly into the tray as discs, then lie down as slabs.
  const isOff = checker.location.kind === 'off';
  const flyingOff = isOff && motion?.kind === 'bearoff';
  const landAfter = motion ? motion.delay + motion.duration : 0;
  const [landedUpdate, setLandedUpdate] = useState<number | null>(null);
  useEffect(() => {
    if (!flyingOff) return;
    const timer = setTimeout(() => setLandedUpdate(updateId), landAfter + 30);
    return () => clearTimeout(timer);
  }, [flyingOff, updateId, landAfter]);
  const showSlab = isOff && (!flyingOff || landedUpdate === updateId);
  const slab = slabRectInTray(m, checker.player, checker.index);

  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { width: size, height: size, zIndex }, positionStyle]}>
      {showSlab ? null : (
        <Animated.View style={[styles.shadow, { width: size, height: size, borderRadius: size / 2 }, shadowStyle]} />
      )}
      <Animated.View style={faceStyle}>
        <Animated.View
          style={
            checker.appeared
              ? { animationName: { from: { opacity: 0 }, to: { opacity: 1 } }, animationDuration: 260 }
              : undefined
          }
        >
          {showSlab ? (
            <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
              <CheckerSlab player={checker.player} width={slab.width} height={slab.height} />
            </View>
          ) : (
            <CheckerFace player={checker.player} size={size} />
          )}
        </Animated.View>
        {showSlab ? null : (
          <Animated.View
            style={[
              styles.ring,
              {
                width: size + 8,
                height: size + 8,
                left: -4,
                top: -4,
                borderRadius: size,
                boxShadow: `0px 0px 12px ${boardColors.selected}`,
              },
              ringStyle,
            ]}
          />
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
  shadow: { position: 'absolute', left: 0, top: 0, backgroundColor: '#000' },
  ring: { position: 'absolute', borderWidth: 3, borderColor: boardColors.selected },
});
