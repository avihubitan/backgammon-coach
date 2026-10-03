import type { Player, PointNumber } from '@/game';
import type { Quadrant } from '@/types/board';

/**
 * Pure layout math for the board. The board is drawn in the standard
 * orientation for the learner (player1): home board bottom-right, bear-off
 * tray on the right.
 *
 *   frame | 13 .. 18 | bar | 19 .. 24 | frame | tray | frame
 *   frame | 12 ..  7 | bar |  6 ..  1 | frame | tray | frame
 */
export interface BoardMetrics {
  width: number;
  height: number;
  frameX: number;
  frameY: number;
  col: number;
  checker: number;
  pointLength: number;
  barWidth: number;
  trayWidth: number;
  leftX: number;
  barX: number;
  rightX: number;
  trayX: number;
  innerTop: number;
  innerBottom: number;
  midY: number;
  dieSize: number;
  slabHeight: number;
}

export function computeMetrics(width: number): BoardMetrics {
  const frameX = Math.max(4, Math.round(width * 0.013));
  const barWidth = Math.round(width * 0.066);
  const trayWidth = Math.round(width * 0.07);
  const col = (width - 3 * frameX - barWidth - trayWidth) / 12;
  const checker = col * 0.95;
  const pointLength = checker * 5;
  const gap = checker * 1.75;
  const frameY = Math.max(14, Math.round(width * 0.042));
  const innerTop = frameY;
  const innerBottom = frameY + 2 * pointLength + gap;
  const leftX = frameX;
  const barX = leftX + 6 * col;
  const rightX = barX + barWidth;
  const trayX = rightX + 6 * col + frameX;
  return {
    width,
    height: innerBottom + frameY,
    frameX,
    frameY,
    col,
    checker,
    pointLength,
    barWidth,
    trayWidth,
    leftX,
    barX,
    rightX,
    trayX,
    innerTop,
    innerBottom,
    midY: (innerTop + innerBottom) / 2,
    dieSize: Math.round(checker * 1.22),
    slabHeight: Math.max(4, checker * 0.24),
  };
}

export const isTopPoint = (point: PointNumber) => point >= 13;

/** Column index 0..11 from left to right for a point. */
export function columnIndex(point: PointNumber): number {
  return isTopPoint(point) ? point - 13 : 12 - point;
}

/** Left edge x of a point's column. */
export function columnX(m: BoardMetrics, point: PointNumber): number {
  const index = columnIndex(point);
  return index < 6 ? m.leftX + index * m.col : m.rightX + (index - 6) * m.col;
}

export function columnCenterX(m: BoardMetrics, point: PointNumber): number {
  return columnX(m, point) + m.col / 2;
}

/** Vertical distance between stacked checkers; stacks over five compress to fit. */
export function stackSpacing(m: BoardMetrics, count: number): number {
  if (count <= 5) return m.checker;
  return (m.pointLength - m.checker) / (count - 1);
}

export interface Point2D {
  x: number;
  y: number;
}

/** Centre of the checker at `index` (0 = against the frame) on a point holding `count` checkers. */
export function checkerCenterOnPoint(
  m: BoardMetrics,
  point: PointNumber,
  index: number,
  count: number,
): Point2D {
  const spacing = stackSpacing(m, Math.max(count, index + 1));
  const offset = m.checker / 2 + index * spacing;
  return {
    x: columnCenterX(m, point),
    y: isTopPoint(point) ? m.innerTop + offset : m.innerBottom - offset,
  };
}

/** player1's checkers wait on the upper half of the bar (next to where they re-enter). */
export function checkerCenterOnBar(m: BoardMetrics, player: Player, index: number, count: number): Point2D {
  const spacing = count <= 3 ? m.checker * 0.92 : (m.checker * 2.2) / (count - 1);
  const start = m.checker * 0.78;
  const offset = start + index * spacing;
  return {
    x: m.barX + m.barWidth / 2,
    y: player === 'player1' ? m.midY - offset : m.midY + offset,
  };
}

/** Borne-off checkers are drawn as slabs: player1 from the bottom of the tray, player2 from the top. */
export function slabRectInTray(m: BoardMetrics, player: Player, index: number) {
  const inset = 3;
  const gap = 1;
  const width = m.trayWidth - inset * 2;
  const y =
    player === 'player1'
      ? m.innerBottom - inset - (index + 1) * (m.slabHeight + gap)
      : m.innerTop + inset + index * (m.slabHeight + gap);
  return { x: m.trayX + inset, y, width, height: m.slabHeight };
}

/** Where the dice sit: on the right half for player1's roll, the left half for player2's. */
export function diceCenter(m: BoardMetrics, player: Player): Point2D {
  const x = player === 'player1' ? m.rightX + 3 * m.col : m.leftX + 3 * m.col;
  return { x, y: m.midY };
}

/** Rectangle covering a point's whole half-board column (used for touch and tinting). */
export function pointRect(m: BoardMetrics, point: PointNumber) {
  const top = isTopPoint(point);
  return {
    x: columnX(m, point),
    y: top ? m.innerTop : m.midY,
    width: m.col,
    height: top ? m.midY - m.innerTop : m.innerBottom - m.midY,
  };
}

export function barRect(m: BoardMetrics) {
  return { x: m.barX, y: m.innerTop, width: m.barWidth, height: m.innerBottom - m.innerTop };
}

export function trayRect(m: BoardMetrics) {
  return { x: m.trayX, y: m.innerTop, width: m.trayWidth, height: m.innerBottom - m.innerTop };
}

export const QUADRANT_POINTS: Record<Quadrant, PointNumber[]> = {
  'player1-home': [1, 2, 3, 4, 5, 6],
  'player1-outer': [7, 8, 9, 10, 11, 12],
  'player2-outer': [13, 14, 15, 16, 17, 18],
  'player2-home': [19, 20, 21, 22, 23, 24],
};

/** A place a checker can be picked up from or dropped on. */
export type BoardPlace = PointNumber | 'bar' | 'off';

/**
 * The place under (x, y), in board coordinates: a point's half-board column,
 * the bar, or the bear-off tray (which also takes the frame next to it, since
 * the tray is narrow). Null outside the playing area.
 */
export function placeAt(m: BoardMetrics, x: number, y: number): BoardPlace | null {
  if (x < 0 || x > m.width || y < m.innerTop || y > m.innerBottom) return null;
  if (x >= m.rightX + 6 * m.col) return 'off';
  if (x >= m.barX && x < m.rightX) return 'bar';
  const column =
    x < m.barX
      ? Math.min(5, Math.max(0, Math.floor((x - m.leftX) / m.col)))
      : 6 + Math.min(5, Math.max(0, Math.floor((x - m.rightX) / m.col)));
  return y < m.midY ? 13 + column : 12 - column;
}
