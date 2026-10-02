import type { BoardSpec } from '@/game';
import type { BoardArrow, BoardHighlight, HighlightTone, Quadrant } from '@/types/board';

import type { TapTarget } from './types';

/** The standard starting position. */
export const START: BoardSpec = {
  player1: { 24: 2, 13: 5, 8: 3, 6: 5 },
  player2: { 1: 2, 12: 5, 17: 3, 19: 5 },
};

export const EMPTY: BoardSpec = {};

export const pointTarget = (point: number): TapTarget => ({ kind: 'point', point });

export const pointTargets = (...points: number[]): TapTarget[] => points.map(pointTarget);

export const range = (from: number, to: number): number[] => {
  const result: number[] = [];
  const step = from <= to ? 1 : -1;
  for (let n = from; n !== to + step; n += step) result.push(n);
  return result;
};

export const quadrant = (q: Quadrant, tone: HighlightTone = 'info', label?: string): BoardHighlight => ({
  region: { kind: 'quadrant', quadrant: q },
  tone,
  label,
});

export const highlightPoints = (points: number[], tone: HighlightTone = 'info', label?: string): BoardHighlight => ({
  region: { kind: 'points', points },
  tone,
  label,
});

export const highlightPoint = (point: number, tone: HighlightTone = 'info', label?: string): BoardHighlight => ({
  region: { kind: 'point', point },
  tone,
  label,
});

export const arrow = (from: BoardArrow['from'], to: BoardArrow['to'], tone: BoardArrow['tone'] = 'hint'): BoardArrow => ({
  from,
  to,
  tone,
});
