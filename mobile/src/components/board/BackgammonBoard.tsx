import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
// Gesture-handler's Pressable shares one gesture system with the drag below,
// so a drag cleanly cancels the tap it started as (on web too).
import { Gesture, GestureDetector, Pressable } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Polygon } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import {
  checkersAt,
  countAt,
  ownerAt,
  positionKey,
  type BoardState,
  type MoveSource,
  type MoveTarget,
  type Player,
  type PointNumber,
} from '@/game';
import { ImpactRing } from '@/components/fx/ImpactRing';
import { ParticleBurst } from '@/components/fx/ParticleBurst';
import { feedback } from '@/services/feedback';
import { boardColors, colors, fontFamilies } from '@/theme';

import { AnimatedChecker } from './AnimatedChecker';
import { BoardArt } from './BoardArt';
import { CheckerFace } from './Checker';
import { useBoardPalette } from './palette';
import { RollingDie } from './Die';
import {
  barRect,
  checkerCenterOnBar,
  checkerCenterOnPoint,
  columnCenterX,
  computeMetrics,
  diceCenter,
  isTopPoint,
  placeAt,
  pointRect,
  QUADRANT_POINTS,
  trayRect,
  type BoardMetrics,
  type Point2D,
} from './geometry';
import { diffLayout, layoutFromBoard, stackSizes, type PlacedChecker } from './layout';
import {
  checkerCenter,
  EMPTY_PLAN,
  mergeCues,
  planMotions,
  type DropInfo,
  type MotionPlan,
  type SoundCueKind,
} from './motion';
import type { BoardArrow, BoardCube, BoardDice, BoardHighlight, BoardRegion, HighlightTone } from './types';

export interface BackgammonBoardProps {
  board: BoardState;
  width: number;
  /** Changing this snaps checkers into place instead of animating (e.g. a new exercise). */
  layoutKey?: string | number;
  dice?: BoardDice | null;
  cube?: BoardCube | null;
  showPointNumbers?: boolean;
  selected?: MoveSource | null;
  movable?: MoveSource[];
  targets?: MoveTarget[];
  /** Whose move the targets belong to. */
  movingPlayer?: Player;
  highlights?: BoardHighlight[];
  arrows?: BoardArrow[];
  onPressPoint?: (point: PointNumber, how?: PressInfo) => void;
  onPressBar?: (how?: PressInfo) => void;
  onPressOff?: (how?: PressInfo) => void;
  disabled?: boolean;
  /** Let the player drag movable checkers onto their targets (on by default). */
  draggable?: boolean;
  /** Change to give the board a gentle "no" shake (wrong answers). */
  shakeKey?: string | number | null;
  /** Change to celebrate a good move: the checkers at `spots` glow and sparkle. */
  celebrate?: { key: string | number; spots: MoveTarget[] } | null;
  /** Play move, hit and dice sounds for this board (on by default). */
  sounds?: boolean;
  testID?: string;
}

/** How a place was chosen: dragged moves commit in one go, with no hops. */
export interface PressInfo {
  dragged?: boolean;
}

/** Where a drag can start: a movable source's column (or the bar). */
interface GrabZone {
  x: number;
  y: number;
  w: number;
  h: number;
  source: MoveSource;
}

/** A legal target, for highlighting the one under a dragged checker. */
interface DropZone {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

/** A finger must travel this far before a touch on a checker becomes a drag. */
const DRAG_SLOP = 6;

const inZone = (zone: { x: number; y: number; w: number; h: number }, x: number, y: number) => {
  'worklet';
  return x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h;
};

const TONES: Record<HighlightTone, { fill: string; border: string; text: string }> = {
  info: { fill: 'rgba(98, 182, 255, 0.22)', border: 'rgba(98, 182, 255, 0.9)', text: '#0B1B2B' },
  success: { fill: 'rgba(61, 214, 140, 0.22)', border: 'rgba(61, 214, 140, 0.95)', text: '#06210F' },
  danger: { fill: 'rgba(255, 107, 92, 0.24)', border: 'rgba(255, 107, 92, 0.95)', text: '#2B0905' },
  gold: { fill: 'rgba(243, 184, 71, 0.22)', border: 'rgba(243, 184, 71, 0.95)', text: '#241703' },
};

const LABEL_BG: Record<HighlightTone, string> = {
  info: '#62B6FF',
  success: '#3DD68C',
  danger: '#FF6B5C',
  gold: '#F3B847',
};

const PULSE = {
  animationName: {
    '0%': { opacity: 0.55, transform: [{ scale: 0.9 }] },
    '100%': { opacity: 1, transform: [{ scale: 1.06 }] },
  },
  animationDuration: 750,
  animationIterationCount: 'infinite',
  animationDirection: 'alternate',
  animationTimingFunction: 'ease-in-out',
} as const;

/** Movable checkers breathe gently to invite a tap. */
const MOVABLE_PULSE = {
  animationName: {
    '0%': { opacity: 0.55 },
    '100%': { opacity: 1 },
  },
  animationDuration: 900,
  animationIterationCount: 'infinite',
  animationDirection: 'alternate',
  animationTimingFunction: 'ease-in-out',
} as const;

const toStyle = (rect: { x: number; y: number; width: number; height: number }) => ({
  left: rect.x,
  top: rect.y,
  width: rect.width,
  height: rect.height,
});

const compareIds = (a: PlacedChecker, b: PlacedChecker) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Where the next checker would land on a point for `player` (hits land on the blot). */
function landingCenter(m: BoardMetrics, board: BoardState, player: Player, point: PointNumber): Point2D {
  const own = ownerAt(board, point) === player ? countAt(board, point) : 0;
  return checkerCenterOnPoint(m, point, own, own + 1);
}

function sourceCenter(m: BoardMetrics, board: BoardState, player: Player, from: MoveSource): Point2D {
  if (from === 'bar') {
    const count = Math.max(1, board.bar[player]);
    return checkerCenterOnBar(m, player, count - 1, count);
  }
  const count = Math.max(1, checkersAt(board, from, player));
  return checkerCenterOnPoint(m, from, count - 1, count);
}

function targetCenter(m: BoardMetrics, board: BoardState, player: Player, to: MoveTarget): Point2D {
  if (to === 'off') {
    const rect = trayRect(m);
    return { x: rect.x + rect.width / 2, y: player === 'player1' ? m.innerBottom - m.checker : m.innerTop + m.checker };
  }
  return landingCenter(m, board, player, to);
}

function regionRects(m: BoardMetrics, region: BoardRegion) {
  switch (region.kind) {
    case 'point':
      return [pointRect(m, region.point)];
    case 'points':
      return region.points.map((point) => pointRect(m, point));
    case 'quadrant': {
      const points = QUADRANT_POINTS[region.quadrant];
      const rects = points.map((point) => pointRect(m, point));
      const x = Math.min(...rects.map((r) => r.x));
      const right = Math.max(...rects.map((r) => r.x + r.width));
      return [{ x, y: rects[0].y, width: right - x, height: rects[0].height }];
    }
    case 'bar':
      return [barRect(m)];
    case 'off':
      return [trayRect(m)];
  }
}

function labelAnchor(m: BoardMetrics, region: BoardRegion): Point2D {
  const rects = regionRects(m, region);
  const x = (Math.min(...rects.map((r) => r.x)) + Math.max(...rects.map((r) => r.x + r.width))) / 2;
  if (region.kind === 'bar' || region.kind === 'off') return { x, y: m.midY };
  const point =
    region.kind === 'point'
      ? region.point
      : region.kind === 'points'
        ? region.points[0]
        : QUADRANT_POINTS[region.quadrant][0];
  // Sit just outside the central dice band so labels never cover the dice.
  const clearance = m.dieSize / 2 + 14;
  return { x, y: isTopPoint(point) ? m.midY - clearance : m.midY + clearance };
}

export function BackgammonBoard({
  board,
  width,
  layoutKey = 'default',
  dice,
  cube,
  showPointNumbers = true,
  selected,
  movable = [],
  targets = [],
  movingPlayer = 'player1',
  highlights = [],
  arrows = [],
  onPressPoint,
  onPressBar,
  onPressOff,
  disabled,
  draggable = true,
  shakeKey,
  celebrate,
  sounds = true,
  testID,
}: BackgammonBoardProps) {
  const m = computeMetrics(width);
  const palette = useBoardPalette();
  const boardKey = positionKey(board);
  const reduceMotion = useReducedMotion();

  // Keep checker identities between renders so moves animate (React's
  // "adjust state when a prop changes" pattern), and plan the choreography.
  // A checker the player just dropped: the next update settles it from there.
  const [drop, setDrop] = useState<{ key: number; info: DropInfo } | null>(null);
  const [tracked, setTracked] = useState(() => ({
    layoutKey,
    boardKey,
    layout: layoutFromBoard(board),
    plan: EMPTY_PLAN as MotionPlan,
    updateId: 0,
    dropKey: 0,
  }));
  let { layout, plan, updateId } = tracked;
  if (tracked.layoutKey !== layoutKey || tracked.boardKey !== boardKey) {
    const fresh = tracked.layoutKey !== layoutKey;
    const pendingDrop = drop && drop.key !== tracked.dropKey ? drop.info : undefined;
    layout = fresh ? layoutFromBoard(board) : diffLayout(tracked.layout, board);
    updateId = tracked.updateId + 1;
    plan = fresh ? EMPTY_PLAN : planMotions(tracked.layout, layout, m, updateId, pendingDrop);
    setTracked({ layoutKey, boardKey, layout, plan, updateId, dropKey: drop?.key ?? tracked.dropKey });
  }
  // A drop that didn't lead to a move (it shouldn't happen) must not linger.
  useEffect(() => {
    if (!drop) return;
    const timer = setTimeout(() => setDrop(null), 600);
    return () => clearTimeout(timer);
  }, [drop]);
  const sizes = stackSizes(layout);

  // Landing sounds, timed to the choreography. Pending sounds survive later
  // updates (those checkers are still flying) and are cleared on unmount.
  const soundTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    if (!sounds || plan.cues.length === 0) return;
    for (const cue of mergeCues(plan.cues)) {
      soundTimers.current.push(setTimeout(() => playCue(cue.kind), cue.at));
    }
  }, [plan, sounds]);
  useEffect(() => () => soundTimers.current.forEach(clearTimeout), []);

  // Hits and wrong answers shake the whole board a little.
  const shake = useSharedValue(0);
  const firstImpact = plan.impacts[0]?.delay;
  useEffect(() => {
    if (firstImpact === undefined || reduceMotion) return;
    shake.value = withDelay(
      firstImpact,
      withSequence(
        withTiming(-4, { duration: 40 }),
        withTiming(4, { duration: 60 }),
        withTiming(-2.5, { duration: 60 }),
        withTiming(1.5, { duration: 50 }),
        withTiming(0, { duration: 40 }),
      ),
    );
  }, [plan, firstImpact, reduceMotion, shake]);
  const nudge = useSharedValue(0);
  const lastShakeKey = useRef(shakeKey);
  useEffect(() => {
    if (shakeKey === lastShakeKey.current) return;
    lastShakeKey.current = shakeKey;
    if (shakeKey === null || shakeKey === undefined || reduceMotion) return;
    nudge.value = withSequence(
      withTiming(-7, { duration: 55 }),
      withTiming(7, { duration: 80 }),
      withTiming(-5, { duration: 80 }),
      withTiming(4, { duration: 70 }),
      withTiming(-2, { duration: 60 }),
      withTiming(0, { duration: 50 }),
    );
  }, [shakeKey, reduceMotion, nudge]);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value + nudge.value }] }));

  // The checker the player has picked up.
  const liftedId =
    selected === undefined || selected === null
      ? null
      : (layout
          .filter(
            (checker) =>
              checker.player === movingPlayer &&
              (selected === 'bar'
                ? checker.location.kind === 'bar'
                : checker.location.kind === 'point' && checker.location.point === selected),
          )
          .sort((a, b) => b.index - a.index)[0]?.id ?? null);

  const interactive = !disabled && (onPressPoint || onPressBar || onPressOff);
  const opponent = movingPlayer === 'player1' ? 'player2' : 'player1';

  // ---- Drag and drop -------------------------------------------------------
  // A touch that starts on a movable checker and travels a few pixels picks it
  // up; everything else stays a tap. Dropping on a legal target "taps" that
  // target, so the rules live in one place (the parent's tap handler).
  const [dragging, setDragging] = useState<MoveSource | null>(null);
  const lift = m.checker * 0.35;
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragOn = useSharedValue(false);
  const grabbed = useSharedValue(-1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const grabZones = useSharedValue<GrabZone[]>([]);
  const dropZones = useSharedValue<DropZone[]>([]);
  const canDrag = !!interactive && draggable;
  const sources = selected !== null && selected !== undefined && !movable.includes(selected) ? [...movable, selected] : movable;
  const sourcesKey = sources.map(String).join(',');
  const targetsKey = targets.map(String).join(',');

  useEffect(() => {
    grabZones.value = canDrag
      ? sources.map((source) => {
          const rect = source === 'bar' ? barRect(m) : pointRect(m, source);
          return { x: rect.x, y: rect.y, w: rect.width, h: rect.height, source };
        })
      : [];
    // Recomputed when the sources, board size or drag permission change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourcesKey, m.width, canDrag, grabZones]);

  useEffect(() => {
    dropZones.value = targets.map((to) => {
      const rect =
        to === 'off'
          ? { x: m.rightX + 6 * m.col, y: m.innerTop, width: m.width - (m.rightX + 6 * m.col), height: m.innerBottom - m.innerTop }
          : pointRect(m, to);
      const c = targetCenter(m, board, movingPlayer, to);
      return { x: rect.x, y: rect.y, w: rect.width, h: rect.height, cx: c.x, cy: c.y };
    });
    // Recomputed when the targets or the board change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetsKey, boardKey, m.width, movingPlayer, dropZones]);

  const beginDrag = (source: MoveSource) => {
    setDragging(source);
    if (source === selected) return;
    if (source === 'bar') onPressBar?.();
    else onPressPoint?.(source);
  };

  const endDrag = (x: number, y: number, ok: boolean) => {
    const source = dragging;
    const place = placeAt(m, x, y - lift);
    const legal = place !== null && place !== 'bar' && (targets as (number | 'off')[]).includes(place);
    if (ok && source !== null && legal) {
      setDrop({ key: tracked.dropKey + 1, info: { player: movingPlayer, at: { x, y: y - lift } } });
      setDragging(null);
      dragOn.value = false;
      if (place === 'off') onPressOff?.({ dragged: true });
      else onPressPoint?.(place, { dragged: true });
      return;
    }
    // Not a legal spot: the checker slides back to where it came from.
    const back = source !== null ? sourceCenter(m, board, movingPlayer, source) : { x, y };
    dragX.value = withTiming(back.x, { duration: 160 });
    dragY.value = withTiming(back.y + lift, { duration: 160 });
    setTimeout(() => {
      dragOn.value = false;
      setDragging(null);
    }, 170);
  };

  const pan = Gesture.Pan()
    .enabled(canDrag)
    .manualActivation(true)
    .onTouchesDown((event, manager) => {
      const touch = event.changedTouches[0];
      if (!touch || event.numberOfTouches > 1) {
        manager.fail();
        return;
      }
      const zones = grabZones.value;
      let hit = -1;
      for (let i = 0; i < zones.length; i++) {
        if (inZone(zones[i], touch.x, touch.y)) {
          hit = i;
          break;
        }
      }
      if (hit < 0) {
        manager.fail();
        return;
      }
      grabbed.value = hit;
      startX.value = touch.x;
      startY.value = touch.y;
    })
    .onTouchesMove((event, manager) => {
      const touch = event.allTouches[0];
      if (touch && Math.hypot(touch.x - startX.value, touch.y - startY.value) > DRAG_SLOP) manager.activate();
    })
    .onTouchesUp((_event, manager) => {
      if (!dragOn.value) manager.fail();
    })
    .onStart((event) => {
      const zone = grabZones.value[grabbed.value];
      if (!zone) return;
      dragX.value = event.x;
      dragY.value = event.y;
      dragOn.value = true;
      scheduleOnRN(beginDrag, zone.source);
    })
    .onUpdate((event) => {
      dragX.value = event.x;
      dragY.value = event.y;
    })
    .onEnd((event, success) => {
      if (dragOn.value) scheduleOnRN(endDrag, event.x, event.y, success);
    });

  const ghostStyle = useAnimatedStyle(() => ({
    opacity: dragOn.value ? 1 : 0,
    transform: [
      { translateX: dragX.value - m.checker / 2 },
      { translateY: dragY.value - lift - m.checker / 2 },
      { scale: dragOn.value ? 1.16 : 1 },
    ],
  }));
  const ghostShadowStyle = useAnimatedStyle(() => ({
    opacity: dragOn.value ? 0.35 : 0,
    transform: [{ translateX: dragX.value - m.checker / 2 + 4 }, { translateY: dragY.value - m.checker / 2 + 8 }],
  }));
  const hoverStyle = useAnimatedStyle(() => {
    if (!dragOn.value) return { opacity: 0 };
    const x = dragX.value;
    const y = dragY.value - lift;
    const zones = dropZones.value;
    for (let i = 0; i < zones.length; i++) {
      if (inZone(zones[i], x, y)) {
        return {
          opacity: 1,
          transform: [{ translateX: zones[i].cx - m.checker * 0.7 }, { translateY: zones[i].cy - m.checker * 0.7 }],
        };
      }
    }
    return { opacity: 0 };
  });

  return (
    <GestureDetector gesture={pan}>
    <Animated.View
      testID={testID}
      style={[styles.root, { width: m.width, height: m.height }, shakeStyle]}
      accessibilityLabel="Backgammon board"
    >
      <BoardArt metrics={m} />

      {highlights.map((highlight, index) =>
        regionRects(m, highlight.region).map((rect, rectIndex) => {
          const tone = TONES[highlight.tone ?? 'info'];
          return (
            <Animated.View
              key={`hl-${index}-${rectIndex}`}
              style={[
                styles.abs,
                {
                  left: rect.x + 1,
                  top: rect.y + 1,
                  width: rect.width - 2,
                  height: rect.height - 2,
                  backgroundColor: tone.fill,
                  borderColor: tone.border,
                  borderWidth: 2,
                  borderRadius: 6,
                  animationName: { from: { opacity: 0 }, to: { opacity: 1 } },
                  animationDuration: 350,
                },
                { pointerEvents: 'none' },
              ]}
            />
          );
        }),
      )}

      {showPointNumbers
        ? Array.from({ length: 24 }, (_, i) => i + 1).map((point) => (
            <Text
              key={`n-${point}`}
              style={[
                styles.pointNumber,
                {
                  left: columnCenterX(m, point) - 12,
                  top: isTopPoint(point) ? (m.frameY - 12) / 2 : m.innerBottom + (m.frameY - 12) / 2,
                  fontSize: Math.max(8, Math.min(11, m.col * 0.36)),
                  color: palette.frameNumber,
                },
                { pointerEvents: 'none' },
              ]}
            >
              {point}
            </Text>
          ))
        : null}

      {/* Ghost checkers preview where the picked-up checker can go. */}
      {targets.map((to) => {
        if (to === 'off') return null;
        const isHit = ownerAt(board, to) === opponent && countAt(board, to) === 1;
        if (isHit) return null;
        const c = landingCenter(m, board, movingPlayer, to);
        return (
          <Animated.View
            key={`ghost-${to}`}
            style={[
              styles.abs,
              {
                left: c.x - m.checker / 2,
                top: c.y - m.checker / 2,
                zIndex: 5,
                animationName: { from: { opacity: 0, transform: [{ scale: 0.6 }] }, to: { opacity: 0.42, transform: [{ scale: 1 }] } },
                animationDuration: 220,
                animationFillMode: 'forwards',
              },
              { pointerEvents: 'none' },
            ]}
          >
            <CheckerFace player={movingPlayer} size={m.checker} />
          </Animated.View>
        );
      })}

      {/* Render in a stable id order: re-ordering DOM nodes would cancel animations on web. */}
      {[...layout].sort(compareIds).map((checker) => {
        const lifted = checker.id === liftedId;
        return (
          <AnimatedChecker
            key={`${layoutKey}-${checker.id}`}
            checker={checker}
            center={checkerCenter(m, checker, sizes)}
            motion={plan.motions[checker.id]}
            updateId={updateId}
            lifted={lifted}
            metrics={m}
            reduceMotion={reduceMotion}
            zIndex={lifted ? 75 : checker.moved ? 40 + checker.index : 10 + checker.index}
            hidden={lifted && dragging !== null}
          />
        );
      })}

      {Array.from(sizes.entries()).map(([key, count]) => {
        const [player, where] = key.split(':') as [Player, string];
        if (count <= 5 || !where.startsWith('p')) return null;
        const point = Number(where.slice(1));
        const top = checkerCenterOnPoint(m, point, count - 1, count);
        return (
          <View
            key={`count-${key}`}
            style={[styles.abs, styles.countBadge, { left: top.x - 9, top: top.y - 8 }, { pointerEvents: 'none' }]}
          >
            <Text style={[styles.countText, { color: player === 'player1' ? '#2A2119' : '#F6EFDF' }]}>
              {count}
            </Text>
          </View>
        );
      })}

      {movable
        .filter((source) => source !== selected)
        .map((source) => {
          const c = sourceCenter(m, board, movingPlayer, source);
          const size = m.checker + 6;
          return (
            <Animated.View
              key={`mv-${String(source)}`}
              testID={`movable-${String(source)}`}
              style={[
                styles.abs,
                styles.ring,
                {
                  left: c.x - size / 2,
                  top: c.y - size / 2,
                  width: size,
                  height: size,
                  zIndex: 60,
                  borderColor: boardColors.movable,
                },
                MOVABLE_PULSE,
                { pointerEvents: 'none' },
              ]}
            />
          );
        })}

      {targets.map((to) => {
        if (to === 'off') {
          const rect = trayRect(m);
          return (
            <Animated.View
              key="t-off"
              testID="target-off"
              style={[
                styles.abs,
                {
                  left: rect.x - 1,
                  top: rect.y - 1,
                  width: rect.width + 2,
                  height: rect.height + 2,
                  borderRadius: 6,
                  borderWidth: 2.5,
                  borderColor: boardColors.target,
                  backgroundColor: boardColors.targetFill,
                  zIndex: 65,
                },
                PULSE,
                { pointerEvents: 'none' },
              ]}
            />
          );
        }
        const isHit = ownerAt(board, to) === opponent && countAt(board, to) === 1;
        const c = landingCenter(m, board, movingPlayer, to);
        const size = isHit ? m.checker + 8 : m.checker;
        return (
          <Animated.View
            key={`t-${to}`}
            testID={`target-${to}`}
            style={[
              styles.abs,
              styles.ring,
              {
                left: c.x - size / 2,
                top: c.y - size / 2,
                width: size,
                height: size,
                zIndex: 65,
                borderWidth: isHit ? 3 : 2.5,
                borderColor: isHit ? boardColors.hitTarget : boardColors.target,
                backgroundColor: isHit ? 'rgba(255, 107, 92, 0.18)' : 'transparent',
                boxShadow: `0px 0px 10px ${isHit ? boardColors.hitTarget : boardColors.target}`,
              },
              PULSE,
              { pointerEvents: 'none' },
            ]}
          />
        );
      })}

      {arrows.length > 0 ? (
        <Svg width={m.width} height={m.height} style={[styles.abs, { zIndex: 85 }]} pointerEvents="none">
          {arrows.map((arrow, index) => (
            <ArrowPath key={`a-${index}`} arrow={arrow} board={board} metrics={m} />
          ))}
        </Svg>
      ) : null}

      {highlights
        .filter((highlight) => highlight.label)
        .map((highlight, index) => {
          const anchor = labelAnchor(m, highlight.region);
          const tone = highlight.tone ?? 'info';
          return (
            <View
              key={`lbl-${index}`}
              style={[styles.abs, styles.labelWrap, { left: 0, width: m.width, top: anchor.y - 11 }, { pointerEvents: 'none' }]}
            >
              <View
                style={[
                  styles.label,
                  {
                    backgroundColor: LABEL_BG[tone],
                    transform: [{ translateX: anchor.x - m.width / 2 }],
                  },
                ]}
              >
                <Text style={[styles.labelText, { color: TONES[tone].text }]} numberOfLines={1}>
                  {highlight.label}
                </Text>
              </View>
            </View>
          );
        })}

      {plan.impacts.map((impact) => (
        <View key={impact.id} style={[StyleSheet.absoluteFill, { zIndex: 96 }, { pointerEvents: 'none' }]}>
          <ImpactRing x={impact.at.x} y={impact.at.y} size={m.checker * 1.3} delay={impact.delay} color="#FFE6A8" />
          <ParticleBurst
            x={impact.at.x}
            y={impact.at.y}
            delay={impact.delay}
            count={10}
            radius={m.checker * 1.8}
            size={Math.max(4, m.checker * 0.22)}
            gravity={m.checker * 0.6}
            duration={520}
            shapes={['spark', 'circle']}
            colors={['#FFE6A8', '#FFFFFF', impact.victim === 'player1' ? palette.lightCheckerFace : palette.darkCheckerRing]}
            seed={impact.id.length + updateId}
          />
        </View>
      ))}

      {celebrate ? <Celebration key={String(celebrate.key)} spots={celebrate.spots} board={board} player={movingPlayer} metrics={m} /> : null}

      {canDrag ? (
        <>
          <Animated.View
            style={[
              styles.abs,
              styles.ring,
              styles.hover,
              { width: m.checker * 1.4, height: m.checker * 1.4, pointerEvents: 'none' },
              hoverStyle,
            ]}
          />
          <Animated.View
            style={[
              styles.abs,
              { width: m.checker, height: m.checker, borderRadius: m.checker, backgroundColor: '#000', zIndex: 98, pointerEvents: 'none' },
              ghostShadowStyle,
            ]}
          />
          <Animated.View
            testID="drag-ghost"
            style={[styles.abs, { width: m.checker, height: m.checker, zIndex: 99, pointerEvents: 'none' }, ghostStyle]}
          >
            <CheckerFace player={movingPlayer} size={m.checker} />
          </Animated.View>
        </>
      ) : null}

      {dice ? <DiceRow dice={dice} metrics={m} sounds={sounds} /> : null}
      {cube ? <CubeView cube={cube} metrics={m} /> : null}

      {interactive ? (
        <>
          {Array.from({ length: 24 }, (_, i) => i + 1).map((point) => {
            const rect = pointRect(m, point);
            return (
              <Pressable
                key={`touch-${point}`}
                testID={`point-${point}`}
                accessibilityRole="button"
                accessibilityLabel={`Point ${point}`}
                onPress={onPressPoint ? () => onPressPoint(point) : undefined}
                style={[styles.abs, styles.touch, { left: rect.x, top: rect.y, width: rect.width, height: rect.height }]}
              />
            );
          })}
          <Pressable
            testID="bar"
            accessibilityRole="button"
            accessibilityLabel="Bar"
            onPress={onPressBar ? () => onPressBar() : undefined}
            style={[styles.abs, styles.touch, toStyle(barRect(m))]}
          />
          <Pressable
            testID="bear-off-tray"
            accessibilityRole="button"
            accessibilityLabel="Bear-off tray"
            onPress={onPressOff ? () => onPressOff() : undefined}
            style={[
              styles.abs,
              styles.touch,
              { left: m.trayX - 2, top: m.innerTop, width: m.trayWidth + m.frameX + 2, height: m.innerBottom - m.innerTop },
            ]}
          />
        </>
      ) : null}
    </Animated.View>
    </GestureDetector>
  );
}

function playCue(kind: SoundCueKind) {
  if (kind === 'hit') feedback.hit();
  else if (kind === 'bearoff') feedback.bearOff();
  else feedback.checkerMove();
}

/** A good move: the checkers that just landed glow, with a burst of sparkles. */
function Celebration({
  spots,
  board,
  player,
  metrics: m,
}: {
  spots: MoveTarget[];
  board: BoardState;
  player: Player;
  metrics: BoardMetrics;
}) {
  const centers = spots.map((spot) => {
    if (spot === 'off') {
      const rect = trayRect(m);
      return { x: rect.x + rect.width / 2, y: player === 'player1' ? m.innerBottom - m.checker : m.innerTop + m.checker };
    }
    const count = Math.max(1, checkersAt(board, spot, player));
    return checkerCenterOnPoint(m, spot, count - 1, count);
  });
  const last = centers[centers.length - 1];
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 97 }, { pointerEvents: 'none' }]}>
      {centers.map((c, index) => (
        <Animated.View
          key={index}
          style={[
            styles.abs,
            styles.ring,
            {
              left: c.x - (m.checker + 10) / 2,
              top: c.y - (m.checker + 10) / 2,
              width: m.checker + 10,
              height: m.checker + 10,
              borderWidth: 3,
              borderColor: colors.success,
              boxShadow: `0px 0px 14px ${colors.success}`,
              animationName: {
                '0%': { opacity: 0, transform: [{ scale: 0.6 }] },
                '25%': { opacity: 1, transform: [{ scale: 1.12 }] },
                '70%': { opacity: 0.9, transform: [{ scale: 1 }] },
                '100%': { opacity: 0, transform: [{ scale: 1.25 }] },
              },
              animationDuration: 1100,
              animationDelay: index * 70,
              animationFillMode: 'both',
            },
          ]}
        />
      ))}
      {last ? (
        <ParticleBurst
          x={last.x}
          y={last.y}
          count={16}
          radius={m.checker * 2.6}
          size={Math.max(5, m.checker * 0.26)}
          gravity={m.checker * 0.8}
          duration={850}
          shapes={['star', 'circle', 'confetti']}
          colors={[colors.success, '#B9FFE0', colors.star, '#FFFFFF']}
          seed={spots.length * 31 + (typeof spots[0] === 'number' ? spots[0] : 0)}
        />
      ) : null}
    </View>
  );
}

function ArrowPath({ arrow, board, metrics: m }: { arrow: BoardArrow; board: BoardState; metrics: BoardMetrics }) {
  const player = arrow.player ?? 'player1';
  const start = sourceCenter(m, board, player, arrow.from);
  const end = targetCenter(m, board, player, arrow.to);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  // Bend the arrow toward the middle of the board so it reads as an arc.
  const bend = Math.min(60, length * 0.35);
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  let nx = -dy / length;
  let ny = dx / length;
  if ((m.midY - midY) * ny + (m.width / 2 - midX) * nx < 0) {
    nx = -nx;
    ny = -ny;
  }
  const cx = midX + nx * bend;
  const cy = midY + ny * bend;
  // Stop short of the landing spot so the head sits on the checker's edge.
  const tx = end.x - cx;
  const ty = end.y - cy;
  const tl = Math.max(1, Math.hypot(tx, ty));
  const ux = tx / tl;
  const uy = ty / tl;
  const tipX = end.x - ux * m.checker * 0.25;
  const tipY = end.y - uy * m.checker * 0.25;
  const head = Math.max(8, m.checker * 0.42);
  const baseX = tipX - ux * head;
  const baseY = tipY - uy * head;
  const leftX = baseX + -uy * head * 0.6;
  const leftY = baseY + ux * head * 0.6;
  const rightX = baseX - -uy * head * 0.6;
  const rightY = baseY - ux * head * 0.6;
  const color =
    arrow.tone === 'wrong' ? boardColors.wrongArrow : arrow.tone === 'info' ? colors.info : boardColors.hintArrow;
  const d = `M ${start.x} ${start.y} Q ${cx} ${cy} ${baseX} ${baseY}`;
  return (
    <>
      <Path d={d} stroke="rgba(0,0,0,0.55)" strokeWidth={6.5} fill="none" strokeLinecap="round" />
      <Path d={d} stroke={color} strokeWidth={3.5} fill="none" strokeLinecap="round" />
      <Polygon
        points={`${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`}
        fill={color}
        stroke="rgba(0,0,0,0.55)"
        strokeWidth={1.2}
      />
    </>
  );
}

function DiceRow({ dice, metrics: m, sounds }: { dice: BoardDice; metrics: BoardMetrics; sounds: boolean }) {
  const center = diceCenter(m, dice.player);
  const many = dice.values.length > 2;
  const size = many ? Math.round(m.dieSize * 0.78) : m.dieSize;
  const gap = size * 0.28;
  const total = dice.values.length * size + (dice.values.length - 1) * gap;
  const rollKey = dice.animate ? `${dice.rollId ?? 'd'}` : null;
  useEffect(() => {
    if (rollKey !== null && sounds) feedback.diceRoll();
  }, [rollKey, sounds]);
  return (
    <View
      style={[styles.abs, styles.diceRow, { left: center.x - total / 2, top: center.y - size / 2, gap }, { pointerEvents: 'none' }]}
    >
      {dice.values.map((value, index) => (
        <RollingDie
          key={`${dice.rollId ?? 'd'}-${index}`}
          value={value}
          size={size}
          player={dice.player}
          used={dice.used?.[index] ?? false}
          animate={dice.animate ?? false}
          index={index}
          delay={index * 50}
          onSettle={index === 0 && sounds ? feedback.diceLand : undefined}
        />
      ))}
    </View>
  );
}

function CubeView({ cube, metrics: m }: { cube: BoardCube; metrics: BoardMetrics }) {
  const size = Math.min(m.trayWidth - 4, m.checker * 1.05);
  const offset = m.checker * 1.6;
  const y = cube.owner === 'player1' ? m.midY + offset : cube.owner === 'player2' ? m.midY - offset : m.midY;
  return (
    <View
      accessibilityLabel={`Doubling cube at ${cube.value}`}
      style={[
        styles.abs,
        styles.cube,
        {
          left: m.trayX + (m.trayWidth - size) / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: size * 0.18,
          transitionProperty: 'top',
          transitionDuration: 300,
        } as object,
        { pointerEvents: 'none' },
      ]}
    >
      <Text style={[styles.cubeText, { fontSize: size * 0.48 }]}>{cube.value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative' },
  abs: { position: 'absolute' },
  pointNumber: {
    position: 'absolute',
    width: 24,
    textAlign: 'center',
    color: boardColors.frameNumber,
    fontFamily: fontFamilies.bold,
    lineHeight: 12,
  },
  ring: { borderRadius: 999, borderWidth: 2 },
  hover: {
    left: 0,
    top: 0,
    zIndex: 97,
    borderWidth: 3,
    borderColor: boardColors.target,
    backgroundColor: boardColors.targetFill,
    boxShadow: `0px 0px 16px ${boardColors.target}`,
  },
  touch: { zIndex: 100 },
  countBadge: {
    width: 18,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 80,
  },
  countText: { fontFamily: fontFamilies.extrabold, fontSize: 11 },
  labelWrap: { alignItems: 'center', zIndex: 90 },
  label: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    boxShadow: '0px 2px 6px rgba(0,0,0,0.4)',
  },
  labelText: { fontFamily: fontFamilies.extrabold, fontSize: 11, letterSpacing: 0.3 },
  diceRow: { flexDirection: 'row', zIndex: 70 },
  cube: {
    backgroundColor: '#F6EFDF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 2px 4px rgba(0,0,0,0.5)',
    zIndex: 60,
  },
  cubeText: { fontFamily: fontFamilies.extrabold, color: '#1D1A16' },
});
