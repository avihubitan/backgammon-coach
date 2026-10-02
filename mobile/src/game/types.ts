/**
 * Core domain types for the backgammon engine.
 *
 * Coordinates are always "absolute" from player1's point of view:
 * - Points are numbered 1..24.
 * - player1 (the learner) moves from 24 down to 1 and bears off below point 1.
 *   Its home board is points 1..6.
 * - player2 (the opponent) moves from 1 up to 24 and bears off above point 24.
 *   Its home board is points 19..24.
 *
 * Everything in this folder is pure, deterministic TypeScript with no React
 * or platform dependencies so it can be unit tested and shared with a server.
 */

export type Player = 'player1' | 'player2';

export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;

/** A point number in absolute coordinates (1..24). */
export type PointNumber = number;

export type MoveSource = PointNumber | 'bar';
export type MoveTarget = PointNumber | 'off';

export interface PerPlayer<T> {
  player1: T;
  player2: T;
}

export interface BoardState {
  /**
   * Index = point number (1..24). Index 0 is unused and always 0.
   * Positive values are player1 checkers, negative values are player2 checkers.
   */
  points: number[];
  /** Checkers waiting on the bar to re-enter. */
  bar: PerPlayer<number>;
  /** Checkers already borne off. */
  off: PerPlayer<number>;
}

/** A single checker moving by a single die. */
export interface CheckerMove {
  from: MoveSource;
  to: MoveTarget;
  die: DieValue;
  /** True when this move sends an opponent blot to the bar. */
  hit: boolean;
}

/** A complete turn: the ordered checker moves a player made with one roll. */
export type Play = CheckerMove[];

export interface CubeState {
  /** Current stake multiplier (1, 2, 4, 8, ...). */
  value: number;
  /** Who may redouble. `null` means the cube is centered and either player may double. */
  owner: Player | null;
}

export type WinType = 'single' | 'gammon' | 'backgammon';

export interface GameResult {
  winner: Player;
  type: WinType;
  /** Cube value when the game ended. */
  cubeValue: number;
  /** Points awarded to the winner (cube value x win multiplier). */
  points: number;
  /** How the game ended. */
  reason: 'bore-off' | 'dropped-double' | 'resigned';
}

export const PLAYERS: readonly Player[] = ['player1', 'player2'];

export const CHECKERS_PER_PLAYER = 15;
