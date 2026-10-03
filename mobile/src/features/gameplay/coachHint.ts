import { describePlay, formatPlay, rankByEquity, type CheckerMove, type TurnState } from '@/game';

/** The coach's suggestion for the roll being played: the whole play from the start of the turn. */
export interface CoachHint {
  moves: CheckerMove[];
  notation: string;
  /** Why, in one sentence. */
  reason: string;
}

export function coachHint(turn: TurnState): CoachHint | null {
  if (!turn.roll) return null;
  const ranked = rankByEquity(turn.startBoard, turn.player, turn.roll);
  const best = ranked[0]?.play.moves;
  if (!best || best.length === 0) return null;
  return {
    moves: [...best],
    notation: formatPlay(turn.player, best),
    reason: ranked.length === 1 ? 'It’s the only legal way to play this roll.' : describePlay(turn.startBoard, turn.player, best),
  };
}

/**
 * The part of the coach's play still to make, given what has been played this
 * turn, or null once the player has moved something else.
 */
export function remainingHintMoves(hint: CoachHint, played: readonly CheckerMove[]): CheckerMove[] | null {
  const left = [...hint.moves];
  for (const move of played) {
    const index = left.findIndex((candidate) => candidate.from === move.from && candidate.to === move.to);
    if (index < 0) return null;
    left.splice(index, 1);
  }
  return left;
}
