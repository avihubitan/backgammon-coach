import { checkersAt, pipDistance, type BoardState, type Player } from '@/game';

/**
 * Gives every checker a stable identity so the UI can animate it from one
 * place to another instead of re-drawing stacks from scratch.
 */
export type CheckerLocation = { kind: 'point'; point: number } | { kind: 'bar' } | { kind: 'off' };

export interface PlacedChecker {
  id: string;
  player: Player;
  location: CheckerLocation;
  /** Position within its stack, 0 being against the frame (or the bar centre). */
  index: number;
  /** True if the checker changed location in the latest update. */
  moved: boolean;
  /** True if the checker did not exist in the previous layout. */
  appeared: boolean;
}

const keyOf = (location: CheckerLocation) =>
  location.kind === 'point' ? `p${location.point}` : location.kind;

function locationFromKey(key: string): CheckerLocation {
  if (key === 'bar') return { kind: 'bar' };
  if (key === 'off') return { kind: 'off' };
  return { kind: 'point', point: Number(key.slice(1)) };
}

/** How far a location is from bearing off, used to pair departures with arrivals sensibly. */
function distanceOf(player: Player, key: string): number {
  if (key === 'bar') return 25;
  if (key === 'off') return 0;
  return pipDistance(player, Number(key.slice(1)));
}

function targetCounts(board: BoardState, player: Player): Map<string, number> {
  const counts = new Map<string, number>();
  for (let point = 1; point <= 24; point++) {
    const n = checkersAt(board, point, player);
    if (n > 0) counts.set(`p${point}`, n);
  }
  if (board.bar[player] > 0) counts.set('bar', board.bar[player]);
  if (board.off[player] > 0) counts.set('off', board.off[player]);
  return counts;
}

function idNumber(id: string): number {
  return Number(id.slice(id.lastIndexOf('-') + 1));
}

export function layoutFromBoard(board: BoardState): PlacedChecker[] {
  return diffLayout([], board).map((checker) => ({ ...checker, appeared: false }));
}

export function diffLayout(previous: readonly PlacedChecker[], board: BoardState): PlacedChecker[] {
  const result: PlacedChecker[] = [];
  for (const player of ['player1', 'player2'] as const) {
    const mine = previous.filter((checker) => checker.player === player);
    let nextId = mine.reduce((max, checker) => Math.max(max, idNumber(checker.id) + 1), 0);

    const byKey = new Map<string, PlacedChecker[]>();
    for (const checker of mine) {
      const key = keyOf(checker.location);
      const list = byKey.get(key) ?? [];
      list.push(checker);
      byKey.set(key, list);
    }
    for (const list of byKey.values()) list.sort((a, b) => a.index - b.index);

    const targets = targetCounts(board, player);
    const kept = new Map<string, PlacedChecker[]>();
    const movers: { checker: PlacedChecker; from: string }[] = [];
    for (const [key, list] of byKey) {
      const keepCount = Math.min(list.length, targets.get(key) ?? 0);
      kept.set(key, list.slice(0, keepCount));
      // The top-most checkers are the ones that leave.
      for (const checker of list.slice(keepCount).reverse()) movers.push({ checker, from: key });
    }

    const vacancies: string[] = [];
    for (const [key, count] of targets) {
      const already = kept.get(key)?.length ?? 0;
      for (let i = already; i < count; i++) vacancies.push(key);
    }

    movers.sort((a, b) => distanceOf(player, b.from) - distanceOf(player, a.from));
    vacancies.sort((a, b) => distanceOf(player, b) - distanceOf(player, a));

    const arrivals = new Map<string, PlacedChecker[]>();
    vacancies.forEach((key, i) => {
      const mover = movers[i];
      const checker: PlacedChecker = mover
        ? { ...mover.checker, location: locationFromKey(key), moved: true, appeared: false }
        : {
            id: `${player}-${nextId++}`,
            player,
            location: locationFromKey(key),
            index: 0,
            moved: false,
            appeared: true,
          };
      const list = arrivals.get(key) ?? [];
      list.push(checker);
      arrivals.set(key, list);
    });

    for (const key of new Set([...kept.keys(), ...arrivals.keys()])) {
      const stack = [
        ...(kept.get(key) ?? []).map((checker) => ({ ...checker, moved: false, appeared: false })),
        ...(arrivals.get(key) ?? []),
      ];
      stack.forEach((checker, index) => result.push({ ...checker, index }));
    }
  }
  return result;
}

/** Counts per location, handy for stack spacing. */
export function stackSizes(layout: readonly PlacedChecker[]): Map<string, number> {
  const sizes = new Map<string, number>();
  for (const checker of layout) {
    const key = `${checker.player}:${keyOf(checker.location)}`;
    sizes.set(key, (sizes.get(key) ?? 0) + 1);
  }
  return sizes;
}

export function stackKey(checker: Pick<PlacedChecker, 'player' | 'location'>): string {
  return `${checker.player}:${keyOf(checker.location)}`;
}
