import {
  checkersAt,
  isTurnComplete,
  legalMovesNow,
  opponentOf,
  playMove,
  type CheckerMove,
  type MoveSource,
  type MoveTarget,
  type TurnState,
} from '@/game';

/**
 * Pure logic behind tap-to-move. Kept free of React so every rule about what
 * a tap does can be unit tested.
 */
export type TapPlace = number | 'bar' | 'off';

/** Every destination a checker on `from` can reach this turn, with the moves to get there. */
export function destinationsFrom(turn: TurnState, from: MoveSource): Map<MoveTarget, CheckerMove[]> {
  const result = new Map<MoveTarget, CheckerMove[]>();
  const queue: { turn: TurnState; at: MoveSource; path: CheckerMove[] }[] = [{ turn, at: from, path: [] }];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const moves = legalMovesNow(current.turn)
      .filter((move) => move.from === current.at)
      // Prefer the exact die when several dice reach the same place (bearing off).
      .sort((a, b) => a.die - b.die);
    for (const move of moves) {
      const path = [...current.path, move];
      if (!result.has(move.to)) result.set(move.to, path);
      if (move.to !== 'off') {
        queue.push({ turn: playMove(current.turn, move), at: move.to, path });
      }
    }
  }
  return result;
}

export function movableSources(turn: TurnState): MoveSource[] {
  return Array.from(new Set(legalMovesNow(turn).map((move) => move.from)));
}

export type TapResult =
  | { kind: 'select'; source: MoveSource }
  | { kind: 'deselect' }
  | { kind: 'move'; moves: CheckerMove[] }
  | { kind: 'ignore' }
  | { kind: 'invalid'; reason: string };

export function resolveTap(turn: TurnState, selected: MoveSource | null, place: TapPlace): TapResult {
  if (isTurnComplete(turn)) return { kind: 'ignore' };
  const sources = movableSources(turn);

  if (selected !== null) {
    if (place === selected) return { kind: 'deselect' };
    const path = destinationsFrom(turn, selected).get(place as MoveTarget);
    if (path) return { kind: 'move', moves: path };
    if (place !== 'off' && sources.includes(place)) return { kind: 'select', source: place };
  } else {
    if (place !== 'off' && sources.includes(place)) return { kind: 'select', source: place };
    // Tapping a destination directly works when only one checker can get there in one move.
    const direct = legalMovesNow(turn).filter((move) => move.to === place);
    const fromSources = new Set(direct.map((move) => move.from));
    if (direct.length > 0 && fromSources.size === 1) {
      const sorted = direct.sort((a, b) => a.die - b.die);
      return { kind: 'move', moves: [sorted[0]] };
    }
  }
  return { kind: 'invalid', reason: explainInvalid(turn, selected, place) };
}

function explainInvalid(turn: TurnState, selected: MoveSource | null, place: TapPlace): string {
  const player = turn.player;
  if (turn.board.bar[player] > 0 && place !== 'bar') {
    return 'You have a checker on the bar. It must come back in before anything else can move.';
  }
  if (selected !== null) {
    if (place === 'off') return 'That checker can’t bear off with these dice.';
    return 'That checker can’t land there. Tap a highlighted spot.';
  }
  if (place === 'off') return 'Tap one of your checkers first.';
  if (place === 'bar') return 'You have no checkers on the bar.';
  if (checkersAt(turn.board, place, opponentOf(player)) > 0) return 'That’s your opponent’s checker. Yours are the light ones.';
  if (checkersAt(turn.board, place, player) > 0) return 'That checker can’t move with these dice.';
  return 'Tap one of your checkers first.';
}

/** Applies a list of moves to a turn. */
export function playMoves(turn: TurnState, moves: CheckerMove[]): TurnState {
  return moves.reduce((current, move) => playMove(current, move), turn);
}

/** Which dice have been used, parallel to the dice shown on the board. */
export function usedDice(turn: TurnState): boolean[] {
  const remaining = turn.remaining.slice();
  return turn.dice.map((die) => {
    const index = remaining.indexOf(die);
    if (index >= 0) {
      remaining.splice(index, 1);
      return false;
    }
    return true;
  });
}
