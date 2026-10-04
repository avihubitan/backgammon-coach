import { computeMetrics } from '@/components/board/geometry';
import { MAX_CONTENT_WIDTH } from '@/theme';

/**
 * How the game screen shares the phone's height. From the top: the bar, the
 * opponent's seat, the board, your seat, the coach's panel (status, hints and
 * Coach Watch) and the buttons. The board comes first: it keeps the full width
 * whenever the rest still fits, and the space left over is shared above and
 * below so the board sits in the middle of the screen.
 */
export interface GameLayout {
  /** Short screens (iPhone SE and smaller): tighter bar and seats, smaller coach text. */
  compact: boolean;
  topBar: number;
  seat: number;
  /** Fixed room under the board for the coach's messages, so the board never moves. */
  panel: number;
  actions: number;
  bottomInset: number;
  boardWidth: number;
  boardHeight: number;
  /** Left over, split above and below the board. */
  spare: number;
}

export interface Insets {
  top: number;
  bottom: number;
}

export const LAYOUT = {
  topBar: { regular: 52, compact: 44 },
  seat: { regular: 52, compact: 44 },
  /** Room for the longest coach message at full size, and the least it may get. */
  panel: { max: 116, min: 84 },
  /** The button row with its top padding (buttons are 56 high plus a 4 pt edge). */
  actions: 68,
  minBottomInset: 12,
  minBoardWidth: 280,
  /** Below this usable height the screen is laid out compact. */
  compactBelow: 700,
} as const;

const boardHeightFor = (width: number) => computeMetrics(width).height;

export function gameLayout(width: number, height: number, insets: Insets): GameLayout {
  const bottomInset = Math.max(insets.bottom, LAYOUT.minBottomInset);
  const usable = height - insets.top - bottomInset;
  const compact = usable < LAYOUT.compactBelow;
  const topBar = compact ? LAYOUT.topBar.compact : LAYOUT.topBar.regular;
  const seat = compact ? LAYOUT.seat.compact : LAYOUT.seat.regular;
  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH);
  const room = usable - topBar - 2 * seat - LAYOUT.actions;

  const fullHeight = boardHeightFor(contentWidth);
  let boardWidth = contentWidth;
  let panel: number;
  if (room >= fullHeight + LAYOUT.panel.max) {
    panel = LAYOUT.panel.max;
  } else if (room >= fullHeight + LAYOUT.panel.min) {
    panel = Math.floor(room - fullHeight);
  } else {
    // Not enough height for a full-width board: the board gives up width, the panel keeps its minimum.
    panel = LAYOUT.panel.min;
    const forBoard = room - panel;
    let low: number = LAYOUT.minBoardWidth;
    let high = contentWidth;
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if (boardHeightFor(mid) <= forBoard) low = mid;
      else high = mid;
    }
    boardWidth = low;
  }
  const boardHeight = boardHeightFor(boardWidth);
  return {
    compact,
    topBar,
    seat,
    panel,
    actions: LAYOUT.actions,
    bottomInset,
    boardWidth,
    boardHeight,
    spare: Math.floor(room - boardHeight - panel),
  };
}
