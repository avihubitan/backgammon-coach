import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
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
  /** Being dragged: the board draws it under the finger instead. */
  hidden?: boolean;
  /** A new game: the checker settles onto the board after this many ms. */
  enterDelay?: number;
  /** Its stack is closing up for an arriving checker: wait this long before sliding. */
  settleDelay?: number;
}

// How a checker travels (a number, so worklets can read it from a shared value).
/** Picked up, carried in an arc, set down. */
const CARRY = 0;
/** Released by the finger: comes straight down from where it was held. */
const DROP = 1;
/** Knocked off by a hit: shoots away at once and slows onto the bar. */
const KNOCK = 2;
/** Its stack re-spaced: slides along the board, never leaving it. */
const SLIDE = 3;

/** How far along its path a checker is at time `t` (0..1) of its flight. */
function pathAt(t: number, mode: number): number {
  'worklet';
  if (mode === CARRY) return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  return 1 - Math.pow(1 - t, 3);
}

/**
 * How high it is (0..1 of its hop) at time `t`: off the board quickly, carried,
 * then down with weight, accelerating into the landing.
 */
function heightAt(t: number, mode: number): number {
  'worklet';
  if (t >= 1 || mode === SLIDE) return 0;
  if (mode === DROP) return 1 - t * t;
  const riseEnd = mode === KNOCK ? 0.14 : 0.3;
  const fallStart = mode === KNOCK ? 0.5 : 0.6;
  const up = t <= 0 ? 0 : Math.min(1, t / riseEnd);
  const rise = 1 - (1 - up) * (1 - up);
  const down = t <= fallStart ? 0 : (t - fallStart) / (1 - fallStart);
  return rise * (1 - down * down);
}

/** How much a landing presses the checker down (its scale dips by this, then recovers). */
const SETTLE_DEPTH = { normal: 0.035, hit: 0.06, knocked: 0.03 } as const;

/**
 * One checker, moved like a physical piece: picked up (it rises, its shadow
 * separating from it), carried along a gentle arc toward the middle of the
 * board, and set down with a small settle. Borne-off checkers lie down in the
 * tray. Everything runs on the UI thread via shared values.
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
  hidden = false,
  enterDelay,
  settleDelay = 0,
}: AnimatedCheckerProps) {
  const size = m.checker;
  const isOff = checker.location.kind === 'off';
  const slab = slabRectInTray(m, checker.player, checker.index);
  const fromX = useSharedValue(center.x);
  const fromY = useSharedValue(center.y);
  const toX = useSharedValue(center.x);
  const toY = useSharedValue(center.y);
  const arcX = useSharedValue(0);
  const arcY = useSharedValue(0);
  /** Time through the current flight, 0..1 (linear; the path and height ease themselves). */
  const t = useSharedValue(1);
  const mode = useSharedValue(CARRY);
  const hop = useSharedValue(0);
  const settle = useSharedValue(0);
  const settleDepth = useSharedValue<number>(SETTLE_DEPTH.normal);
  /** 0: standing disc, 1: lying in the tray as a slab. */
  const flat = useSharedValue(isOff ? 1 : 0);
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
      cancelAnimation(t);
      fromX.value = center.x;
      fromY.value = center.y;
      toX.value = center.x;
      toY.value = center.y;
      arcX.value = 0;
      arcY.value = 0;
      t.value = 1;
      flat.value = isOff ? 1 : 0;
      return;
    }

    // Start from wherever the checker is on screen right now, even mid-flight,
    // or from where the player let go of it.
    const e = pathAt(t.value, mode.value);
    const s = Math.sin(Math.PI * e);
    const dropped = newFlight ? motion?.from : undefined;
    const currentX = dropped ? dropped.x : fromX.value + (toX.value - fromX.value) * e + arcX.value * s;
    const currentY = dropped ? dropped.y : fromY.value + (toY.value - fromY.value) * e + arcY.value * s;
    fromX.value = currentX;
    fromY.value = currentY;
    toX.value = center.x;
    toY.value = center.y;

    if (newFlight && motion) {
      // A landing still pending from an earlier hop must not fire mid-air.
      cancelAnimation(settle);
      settle.value = 0;
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
      const knocked = motion.kind === 'hit';
      const bend = reduceMotion || motion.from ? 0 : Math.min(size * (knocked ? 1.3 : 0.85), distance * 0.18);
      arcX.value = nx * bend;
      arcY.value = ny * bend;
      mode.value = motion.from ? DROP : knocked ? KNOCK : CARRY;
      hop.value = reduceMotion ? 0 : motion.hop;
      const duration = reduceMotion ? 180 : motion.duration;
      const landing = motion.delay + duration;
      t.value = 0;
      t.value = withDelay(motion.delay, withTiming(1, { duration, easing: Easing.linear }));

      if (motion.kind === 'bearoff') {
        // A disc in the air; it lies down in the tray as it lands.
        cancelAnimation(flat);
        flat.value = 0;
        flat.value = withDelay(landing, withTiming(1, { duration: reduceMotion ? 0 : 170, easing: Easing.inOut(Easing.quad) }));
      } else if (flat.value > 0) {
        // Taken back out of the tray (undo): it stands up as it lifts.
        flat.value = withDelay(motion.delay, withTiming(0, { duration: 120 }));
      }
      if (!reduceMotion && motion.kind !== 'bearoff') {
        settleDepth.value = motion.hits ? SETTLE_DEPTH.hit : knocked ? SETTLE_DEPTH.knocked : SETTLE_DEPTH.normal;
        settle.value = withDelay(
          landing,
          withSequence(
            withTiming(1, { duration: 60, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 170, easing: Easing.inOut(Easing.quad) }),
          ),
        );
      }
    } else {
      // A stack re-spaced around it: slide into place, once the arriving checker is nearly down.
      arcX.value = 0;
      arcY.value = 0;
      mode.value = SLIDE;
      hop.value = 0;
      t.value = 0;
      t.value = withDelay(reduceMotion ? 0 : settleDelay, withTiming(1, { duration: 200, easing: Easing.linear }));
    }
  }, [center.x, center.y, updateId, motion, m.width, m.midY, size, reduceMotion, isOff, settleDelay, t, mode, fromX, fromY, toX, toY, arcX, arcY, hop, settle, settleDepth, flat]);

  useEffect(() => {
    if (reduceMotion) {
      lift.value = lifted ? 1 : 0;
      glow.value = 0;
      return;
    }
    lift.value = withSpring(lifted ? 1 : 0, { damping: 14, stiffness: 320, mass: 0.6 });
    glow.value = lifted
      ? withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true)
      : withTiming(0, { duration: 150 });
  }, [lifted, reduceMotion, lift, glow]);

  const positionStyle = useAnimatedStyle(() => {
    const e = pathAt(t.value, mode.value);
    const s = Math.sin(Math.PI * e);
    const x = fromX.value + (toX.value - fromX.value) * e + arcX.value * s;
    const y = fromY.value + (toY.value - fromY.value) * e + arcY.value * s;
    return { transform: [{ translateX: x - size / 2 }, { translateY: y - size / 2 }] };
  });

  // Picked up (selected) or in the air: whichever is higher.
  const faceStyle = useAnimatedStyle(() => {
    const height = Math.max(hop.value * heightAt(t.value, mode.value), lift.value * 0.11);
    return {
      transform: [{ translateY: -height * size * 0.3 }, { scale: (1 + height) * (1 - settle.value * settleDepth.value) }],
    };
  });

  // The shadow stays on the felt: the higher the checker, the further and softer it falls.
  const shadowStyle = useAnimatedStyle(() => {
    const height = Math.max(hop.value * heightAt(t.value, mode.value), lift.value * 0.11);
    const presence = Math.min(1, height / 0.03);
    return {
      opacity: presence * Math.max(0.2, 0.46 - height * 0.6),
      transform: [{ translateX: height * size * 0.55 }, { translateY: height * size * 1.45 }, { scale: 1 + height * 0.45 }],
    };
  });

  const ringStyle = useAnimatedStyle(() => ({
    opacity: lift.value * (0.7 + 0.3 * glow.value),
    transform: [{ scale: 1.03 + 0.04 * glow.value }],
  }));

  // Lying down: the disc flattens into the slab's shape and hands over to it.
  const discStyle = useAnimatedStyle(() => ({
    opacity: 1 - flat.value,
    transform: [{ scaleX: 1 - flat.value * (1 - slab.width / size) }, { scaleY: 1 - flat.value * (1 - slab.height / size) }],
  }));
  const slabStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, flat.value * 1.6) }));

  // Only checkers in (or coming back out of) the tray need their slab.
  const hasSlab = isOff || checker.from?.kind === 'off';

  return (
    <Animated.View
      style={[styles.abs, { width: size, height: size, zIndex, opacity: hidden ? 0 : 1, pointerEvents: 'none' }, positionStyle]}
    >
      <Animated.View style={[styles.shadow, { width: size, height: size, borderRadius: size / 2 }, shadowStyle]} />
      <Animated.View style={faceStyle}>
        <Animated.View
          style={
            enterDelay !== undefined && !reduceMotion
              ? {
                  animationName: {
                    from: { opacity: 0, transform: [{ translateY: -size * 0.5 }, { scale: 1.08 }] },
                    to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
                  },
                  animationDuration: 320,
                  animationDelay: enterDelay,
                  animationFillMode: 'backwards',
                  animationTimingFunction: 'ease-out',
                }
              : checker.appeared
                ? { animationName: { from: { opacity: 0 }, to: { opacity: 1 } }, animationDuration: 260 }
                : undefined
          }
        >
          {hasSlab ? (
            <Animated.View style={[styles.slab, { width: size, height: size }, slabStyle]}>
              <CheckerSlab player={checker.player} width={slab.width} height={slab.height} />
            </Animated.View>
          ) : null}
          <Animated.View style={discStyle}>
            <CheckerFace player={checker.player} size={size} />
          </Animated.View>
        </Animated.View>
        {isOff ? null : (
          <Animated.View
            style={[
              styles.ring,
              {
                width: size + 6,
                height: size + 6,
                left: -3,
                top: -3,
                borderRadius: size,
                boxShadow: `0px 0px 8px ${boardColors.selected}`,
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
  // A soft, blurred disc: only its opacity and position change while it moves.
  shadow: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    boxShadow: '0px 0px 6px 2px rgba(0, 0, 0, 0.55)',
  },
  slab: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 2, borderColor: boardColors.selected },
});
