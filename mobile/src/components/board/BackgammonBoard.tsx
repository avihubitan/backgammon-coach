import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Path, Polygon } from 'react-native-svg';

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
import { boardColors, colors, fontFamilies } from '@/theme';

import { BoardArt } from './BoardArt';
import { CheckerFace, CheckerSlab } from './Checker';
import { RollingDie } from './Die';
import {
  barRect,
  checkerCenterOnBar,
  checkerCenterOnPoint,
  columnCenterX,
  computeMetrics,
  diceCenter,
  isTopPoint,
  pointRect,
  QUADRANT_POINTS,
  slabRectInTray,
  trayRect,
  type BoardMetrics,
  type Point2D,
} from './geometry';
import { diffLayout, layoutFromBoard, stackKey, stackSizes, type PlacedChecker } from './layout';
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
  onPressPoint?: (point: PointNumber) => void;
  onPressBar?: () => void;
  onPressOff?: () => void;
  disabled?: boolean;
  testID?: string;
}

const MOVE_DURATION = 300;

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

const toStyle = (rect: { x: number; y: number; width: number; height: number }) => ({
  left: rect.x,
  top: rect.y,
  width: rect.width,
  height: rect.height,
});

const compareIds = (a: PlacedChecker, b: PlacedChecker) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function checkerCenter(m: BoardMetrics, checker: PlacedChecker, sizes: Map<string, number>): Point2D {
  const count = sizes.get(stackKey(checker)) ?? 1;
  if (checker.location.kind === 'point') {
    return checkerCenterOnPoint(m, checker.location.point, checker.index, count);
  }
  if (checker.location.kind === 'bar') return checkerCenterOnBar(m, checker.player, checker.index, count);
  const slab = slabRectInTray(m, checker.player, checker.index);
  return { x: slab.x + slab.width / 2, y: slab.y + slab.height / 2 };
}

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
  testID,
}: BackgammonBoardProps) {
  const m = computeMetrics(width);
  const boardKey = positionKey(board);

  // Keep checker identities between renders so moves animate (React's
  // "adjust state when a prop changes" pattern).
  const [tracked, setTracked] = useState(() => ({
    layoutKey,
    boardKey,
    layout: layoutFromBoard(board),
  }));
  let layout = tracked.layout;
  if (tracked.layoutKey !== layoutKey || tracked.boardKey !== boardKey) {
    layout = tracked.layoutKey !== layoutKey ? layoutFromBoard(board) : diffLayout(tracked.layout, board);
    setTracked({ layoutKey, boardKey, layout });
  }
  const sizes = stackSizes(layout);

  const interactive = !disabled && (onPressPoint || onPressBar || onPressOff);

  return (
    <View
      testID={testID}
      style={[styles.root, { width: m.width, height: m.height }]}
      accessibilityLabel="Backgammon board"
    >
      <BoardArt metrics={m} />

      {highlights.map((highlight, index) =>
        regionRects(m, highlight.region).map((rect, rectIndex) => {
          const tone = TONES[highlight.tone ?? 'info'];
          return (
            <Animated.View
              key={`hl-${index}-${rectIndex}`}
              pointerEvents="none"
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
              ]}
            />
          );
        }),
      )}

      {showPointNumbers
        ? Array.from({ length: 24 }, (_, i) => i + 1).map((point) => (
            <Text
              key={`n-${point}`}
              pointerEvents="none"
              style={[
                styles.pointNumber,
                {
                  left: columnCenterX(m, point) - 12,
                  top: isTopPoint(point) ? (m.frameY - 12) / 2 : m.innerBottom + (m.frameY - 12) / 2,
                  fontSize: Math.max(8, Math.min(11, m.col * 0.36)),
                },
              ]}
            >
              {point}
            </Text>
          ))
        : null}

      {/* Render in a stable id order: re-ordering DOM nodes would cancel CSS transitions on web. */}
      {[...layout].sort(compareIds).map((checker) => {
        const center = checkerCenter(m, checker, sizes);
        return (
          <AnimatedChecker
            key={`${layoutKey}-${checker.id}`}
            checker={checker}
            center={center}
            metrics={m}
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
            pointerEvents="none"
            style={[styles.abs, styles.countBadge, { left: top.x - 9, top: top.y - 8 }]}
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
            <View
              key={`mv-${String(source)}`}
              testID={`movable-${String(source)}`}
              pointerEvents="none"
              style={[
                styles.abs,
                styles.ring,
                {
                  left: c.x - size / 2,
                  top: c.y - size / 2,
                  width: size,
                  height: size,
                  borderColor: boardColors.movable,
                },
              ]}
            />
          );
        })}

      {selected !== undefined && selected !== null ? (
        (() => {
          const c = sourceCenter(m, board, movingPlayer, selected);
          const size = m.checker + 8;
          return (
            <Animated.View
              key={`sel-${String(selected)}`}
              pointerEvents="none"
              style={[
                styles.abs,
                styles.ring,
                {
                  left: c.x - size / 2,
                  top: c.y - size / 2,
                  width: size,
                  height: size,
                  borderWidth: 3,
                  borderColor: boardColors.selected,
                  boxShadow: `0px 0px 10px ${boardColors.selected}`,
                },
              ]}
            />
          );
        })()
      ) : null}

      {targets.map((to) => {
        if (to === 'off') {
          const rect = trayRect(m);
          return (
            <Animated.View
              key="t-off"
              testID="target-off"
              pointerEvents="none"
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
                },
                PULSE,
              ]}
            />
          );
        }
        const c = landingCenter(m, board, movingPlayer, to);
        const size = m.checker;
        return (
          <Animated.View
            key={`t-${to}`}
            testID={`target-${to}`}
            pointerEvents="none"
            style={[
              styles.abs,
              styles.ring,
              {
                left: c.x - size / 2,
                top: c.y - size / 2,
                width: size,
                height: size,
                borderWidth: 2.5,
                borderColor: boardColors.target,
                backgroundColor: boardColors.targetFill,
              },
              PULSE,
            ]}
          />
        );
      })}

      {arrows.length > 0 ? (
        <Svg width={m.width} height={m.height} style={styles.abs} pointerEvents="none">
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
              pointerEvents="none"
              style={[styles.abs, styles.labelWrap, { left: 0, width: m.width, top: anchor.y - 11 }]}
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

      {dice ? <DiceRow dice={dice} metrics={m} /> : null}
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
                style={[styles.abs, { left: rect.x, top: rect.y, width: rect.width, height: rect.height }]}
              />
            );
          })}
          <Pressable
            testID="bar"
            accessibilityRole="button"
            accessibilityLabel="Bar"
            onPress={onPressBar}
            style={[styles.abs, toStyle(barRect(m))]}
          />
          <Pressable
            testID="bear-off-tray"
            accessibilityRole="button"
            accessibilityLabel="Bear-off tray"
            onPress={onPressOff}
            style={[
              styles.abs,
              { left: m.trayX - 2, top: m.innerTop, width: m.trayWidth + m.frameX + 2, height: m.innerBottom - m.innerTop },
            ]}
          />
        </>
      ) : null}
    </View>
  );
}

function AnimatedChecker({
  checker,
  center,
  metrics: m,
}: {
  checker: PlacedChecker;
  center: Point2D;
  metrics: BoardMetrics;
}) {
  const isOff = checker.location.kind === 'off';
  // Borne-off checkers slide into the tray as discs and then turn into slabs.
  const offToken = isOff ? `${checker.index}:${checker.moved}` : null;
  const [settledToken, setSettledToken] = useState<string | null>(null);
  useEffect(() => {
    if (!offToken || !checker.moved) return;
    const timer = setTimeout(() => setSettledToken(offToken), MOVE_DURATION);
    return () => clearTimeout(timer);
  }, [offToken, checker.moved]);

  const size = m.checker;
  const slabRect = slabRectInTray(m, checker.player, checker.index);
  const showSlab = isOff && (!checker.moved || settledToken === offToken);
  const w = showSlab ? slabRect.width : size;
  const h = showSlab ? slabRect.height : size;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.abs,
        {
          left: 0,
          top: 0,
          width: w,
          height: h,
          zIndex: checker.moved ? 40 + checker.index : 10 + checker.index,
          transform: [{ translateX: center.x - w / 2 }, { translateY: center.y - h / 2 }],
          transitionProperty: 'transform',
          transitionDuration: MOVE_DURATION,
          transitionTimingFunction: 'ease-in-out',
        },
        checker.appeared
          ? {
              animationName: { from: { opacity: 0 }, to: { opacity: 1 } },
              animationDuration: 260,
            }
          : null,
      ]}
    >
      {showSlab ? (
        <CheckerSlab player={checker.player} width={w} height={h} />
      ) : (
        <CheckerFace player={checker.player} size={size} />
      )}
    </Animated.View>
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

function DiceRow({ dice, metrics: m }: { dice: BoardDice; metrics: BoardMetrics }) {
  const center = diceCenter(m, dice.player);
  const many = dice.values.length > 2;
  const size = many ? Math.round(m.dieSize * 0.78) : m.dieSize;
  const gap = size * 0.28;
  const total = dice.values.length * size + (dice.values.length - 1) * gap;
  return (
    <View
      pointerEvents="none"
      style={[styles.abs, styles.diceRow, { left: center.x - total / 2, top: center.y - size / 2, gap }]}
    >
      {dice.values.map((value, index) => (
        <RollingDie
          key={`${dice.rollId ?? 'd'}-${index}`}
          value={value}
          size={size}
          player={dice.player}
          used={dice.used?.[index] ?? false}
          animate={dice.animate ?? false}
          delay={index * 60}
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
      pointerEvents="none"
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
