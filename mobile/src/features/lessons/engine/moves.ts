import type { CheckerMove, MoveSource, MoveTarget } from '@/game';

/** Where the checkers of a turn ended up (intermediate stops of a chained move don't count). */
export function finalSpots(moves: readonly CheckerMove[]): MoveTarget[] {
  const spots: MoveTarget[] = [];
  moves.forEach((move, index) => {
    const movedOnLater = moves.slice(index + 1).some((later) => later.from === move.to);
    if (!movedOnLater && !spots.includes(move.to)) spots.push(move.to);
  });
  return spots;
}

/** Joins the hops of one checker (13/10 10/5) into a single trip (13/5) for drawing arrows. */
export function chainMoves(moves: readonly CheckerMove[]): { from: MoveSource; to: MoveTarget }[] {
  const trips: { from: MoveSource; to: MoveTarget }[] = [];
  for (const move of moves) {
    const continued = trips.find((trip) => trip.to === move.from);
    if (continued) continued.to = move.to;
    else trips.push({ from: move.from, to: move.to });
  }
  return trips;
}
