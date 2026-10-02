import type { CubeState, Player } from '../types';

export const MAX_CUBE_VALUE = 64;

export function initialCube(): CubeState {
  return { value: 1, owner: null };
}

/**
 * A player may offer a double when the cube is centered or they own it.
 * Doubling is never allowed during the Crawford game of a match.
 */
export function canOfferDouble(
  cube: CubeState,
  player: Player,
  options: { crawford?: boolean } = {},
): boolean {
  if (options.crawford) return false;
  if (cube.value >= MAX_CUBE_VALUE) return false;
  return cube.owner === null || cube.owner === player;
}

/** The taker doubles the stakes and gains ownership of the cube. */
export function acceptDouble(cube: CubeState, taker: Player): CubeState {
  return { value: cube.value * 2, owner: taker };
}
