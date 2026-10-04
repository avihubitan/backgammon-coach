import type { CubeState, DieValue, MoveSource, MoveTarget, Player, PointNumber } from '@/game';

/**
 * Visual annotations for the board. These are plain data so lessons can
 * describe them declaratively.
 */
export type Quadrant = 'player1-home' | 'player1-outer' | 'player2-home' | 'player2-outer';

export type HighlightTone = 'info' | 'success' | 'danger' | 'gold';

export type BoardRegion =
  | { kind: 'point'; point: PointNumber }
  | { kind: 'points'; points: PointNumber[] }
  | { kind: 'quadrant'; quadrant: Quadrant }
  | { kind: 'bar' }
  | { kind: 'off' };

export interface BoardHighlight {
  region: BoardRegion;
  tone?: HighlightTone;
  label?: string;
}

export interface BoardArrow {
  from: MoveSource;
  to: MoveTarget;
  /** Whose checker is moving (defaults to player1). */
  player?: Player;
  tone?: 'hint' | 'wrong' | 'info';
}

export interface BoardDice {
  values: DieValue[];
  /** Parallel to `values`: which dice have been played. */
  used?: boolean[];
  player: Player;
  /** Change this to replay the roll animation. */
  rollId?: string | number;
  animate?: boolean;
  /** Parallel to `values`: whose die each one is (its colour). Defaults to `player` for all. */
  owners?: Player[];
  /**
   * The opening roll: each die sits on its owner's half of the board. Turning
   * this off slides them together onto `player`'s side, without a new throw.
   */
  split?: boolean;
  /** Index of the die that won the opening roll, to set it apart. */
  winner?: number | null;
}

export type BoardCube = CubeState;
