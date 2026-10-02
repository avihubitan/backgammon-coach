import { checkersAt, cloneBoard, opponentOf, positionKey, signOf } from '../board/board';
import type { DiceRoll } from '../dice/dice';
import { getLegalPlays, getLegalPlaysForDice, type LegalPlay } from '../rules/plays';
import type { BoardState, CheckerMove, DieValue, MoveSource, MoveTarget, Player, PointNumber } from '../types';

/**
 * Standard backgammon notation numbers points from the mover's own point of
 * view (their home board is 1..6). For player1 that matches absolute numbers.
 */
export function pointLabel(player: Player, point: PointNumber): number {
  return player === 'player1' ? point : 25 - point;
}

function absoluteFromLabel(player: Player, label: number): PointNumber {
  return player === 'player1' ? label : 25 - label;
}

function sourceLabel(player: Player, from: MoveSource): string {
  return from === 'bar' ? 'bar' : String(pointLabel(player, from));
}

function targetLabel(player: Player, to: MoveTarget): string {
  return to === 'off' ? 'off' : String(pointLabel(player, to));
}

export function formatMove(player: Player, move: CheckerMove): string {
  return `${sourceLabel(player, move.from)}/${targetLabel(player, move.to)}${move.hit ? '*' : ''}`;
}

// Formats a whole play, joining moves of the same checker ("13/10 10/5"
// becomes "13/5", or "13/10*/5" when it hit on the way) and grouping repeated
// moves ("8/5 8/5" becomes "8/5(2)").
export function formatPlay(player: Player, moves: readonly CheckerMove[]): string {
  if (moves.length === 0) return 'No move';
  const chains: { from: MoveSource; stops: { to: MoveTarget; hit: boolean }[] }[] = [];
  for (const move of moves) {
    const chain = chains.find((candidate) => {
      const last = candidate.stops[candidate.stops.length - 1];
      return last.to !== 'off' && last.to === move.from;
    });
    if (chain) chain.stops.push({ to: move.to, hit: move.hit });
    else chains.push({ from: move.from, stops: [{ to: move.to, hit: move.hit }] });
  }

  const counts = new Map<string, { count: number; sortKey: number }>();
  for (const chain of chains) {
    const parts = [sourceLabel(player, chain.from)];
    chain.stops.forEach((stop, index) => {
      const isLast = index === chain.stops.length - 1;
      if (isLast || stop.hit) parts.push(`${targetLabel(player, stop.to)}${stop.hit ? '*' : ''}`);
    });
    const text = parts.join('/');
    const existing = counts.get(text);
    if (existing) existing.count += 1;
    else counts.set(text, { count: 1, sortKey: chain.from === 'bar' ? 25 : pointLabel(player, chain.from) });
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1].sortKey - a[1].sortKey)
    .map(([text, { count }]) => (count > 1 ? `${text}(${count})` : text))
    .join(' ');
}

export interface NotationSegment {
  /** Points along one checker's path in the mover's labels ('bar' / 'off' allowed). */
  path: (number | 'bar' | 'off')[];
  /** Indices into `path` (excluding 0) where a hit is explicitly marked. */
  hits: number[];
}

// Parses notation such as "8/5 6/5", "bar/22*", "13/10*/5" or "6/off(2)".
export function parsePlayNotation(text: string): NotationSegment[] {
  const segments: NotationSegment[] = [];
  for (const raw of text.trim().toLowerCase().split(/\s+/).filter(Boolean)) {
    const repeat = /\((\d)\)$/.exec(raw);
    const token = repeat ? raw.slice(0, repeat.index) : raw;
    const parts = token.split('/');
    if (parts.length < 2) throw new Error(`Invalid move "${raw}"`);
    const path: NotationSegment['path'] = [];
    const hits: number[] = [];
    parts.forEach((part, index) => {
      const hit = part.endsWith('*');
      const value = hit ? part.slice(0, -1) : part;
      if (value === 'bar' || value === 'off') path.push(value);
      else {
        const label = Number(value);
        if (!Number.isInteger(label) || label < 1 || label > 24) throw new Error(`Invalid point "${part}"`);
        path.push(label);
      }
      if (hit && index > 0) hits.push(index);
    });
    for (let i = 0; i < (repeat ? Number(repeat[1]) : 1); i++) segments.push({ path, hits });
  }
  return segments;
}

/**
 * Applies notation to a board by net checker movement. Landing on a single
 * opponent checker at the end of a path always hits; mid-path hits must be
 * marked with "*".
 */
export function applyNotation(board: BoardState, player: Player, notation: string): BoardState {
  const next = cloneBoard(board);
  const sign = signOf(player);
  const opponent = opponentOf(player);
  const hitAt = (point: PointNumber) => {
    if (checkersAt(next, point, opponent) === 1) {
      next.points[point] = 0;
      next.bar[opponent] += 1;
    }
  };
  for (const segment of parsePlayNotation(notation)) {
    const [start, ...rest] = segment.path;
    if (start === 'off') throw new Error('A move cannot start from off');
    if (start === 'bar') {
      if (next.bar[player] === 0) throw new Error('No checker on the bar');
      next.bar[player] -= 1;
    } else {
      const from = absoluteFromLabel(player, start);
      if (checkersAt(next, from, player) === 0) throw new Error(`No checker on ${start}`);
      next.points[from] -= sign;
    }
    rest.forEach((stop, i) => {
      const index = i + 1;
      const isLast = index === segment.path.length - 1;
      if (stop === 'bar') throw new Error('A move cannot end on the bar');
      if (stop === 'off') {
        if (!isLast) throw new Error('"off" must end a move');
        next.off[player] += 1;
        return;
      }
      const point = absoluteFromLabel(player, stop);
      if (isLast || segment.hits.includes(index)) hitAt(point);
      if (isLast) next.points[point] += sign;
    });
  }
  return next;
}

/** Finds the legal play that matches written notation, or null if none does. */
export function findPlayByNotation(
  board: BoardState,
  player: Player,
  roll: DiceRoll,
  notation: string,
): LegalPlay | null {
  const target = positionKey(applyNotation(board, player, notation));
  return getLegalPlays(board, player, roll).find((play) => play.key === target) ?? null;
}

/** Like `findPlayByNotation` but for an arbitrary list of dice (used by lessons). */
export function findPlayForDice(
  board: BoardState,
  player: Player,
  dice: readonly DieValue[],
  notation: string,
  options: { largerDieRule?: boolean } = {},
): LegalPlay | null {
  const target = positionKey(applyNotation(board, player, notation));
  return getLegalPlaysForDice(board, player, dice, options).find((play) => play.key === target) ?? null;
}
