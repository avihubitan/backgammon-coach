import { describePlay, explainDifference, formatPlay, positionKey, rankByEquity, severityFor, type TurnState } from '@/game';

import type { CoachHint } from './coachHint';

/**
 * Coach Watch: before a move is confirmed, the coach checks it. Only clear
 * mistakes (the same "mistake" and "blunder" grades as game reviews) get a
 * second look, and the coach gives a clue rather than the answer, so the
 * player can find the better move.
 */
export interface CoachWatchVerdict {
  severity: 'mistake' | 'blunder';
  /** A nudge toward the better idea that doesn't give the move away. */
  clue: string;
  /** The coach's move, for "Show me". */
  hint: CoachHint;
}

/** Clues by the review's headline for the same mistake. */
const CLUES: Record<string, string> = {
  'You missed a hit': 'There’s a hit you can make.',
  'You could make a point': 'You can make a point with this roll.',
  'An anchor was available': 'You can make an anchor in your opponent’s home board.',
  'You had a safer option': 'There’s a safer way to play this roll.',
  'A slightly safer play existed': 'There’s a safer way to play this roll.',
  'Get your back checkers moving': 'Think about your back checkers.',
  'Keep the pressure on': 'You can keep more pressure on your opponent.',
  'You could bear off more': 'You can take more checkers off.',
  'A smoother bear-off was possible': 'Look for a smoother way to bear off.',
  'Race more efficiently': 'There’s a more efficient way to race home.',
};
const DEFAULT_CLUE = 'Look for a stronger way to place your checkers.';

/** The verdict on the moves made this turn, or null when they are fine (or forced). */
export function watchPlay(turn: TurnState): CoachWatchVerdict | null {
  if (!turn.roll || turn.moves.length === 0) return null;
  const ranked = rankByEquity(turn.startBoard, turn.player, turn.roll);
  if (ranked.length <= 1) return null;
  const played = ranked.findIndex((entry) => entry.play.key === positionKey(turn.board));
  if (played <= 0) return null;
  const severity = severityFor(ranked[0].equity - ranked[played].equity, played + 1);
  if (severity !== 'mistake' && severity !== 'blunder') return null;
  const best = ranked[0].play.moves;
  const { headline } = explainDifference(turn.startBoard, turn.player, turn.moves, best, false);
  return {
    severity,
    clue: CLUES[headline] ?? DEFAULT_CLUE,
    hint: { moves: [...best], notation: formatPlay(turn.player, best), reason: describePlay(turn.startBoard, turn.player, best) },
  };
}

/**
 * Whether the coach looks at this turn's move at all: when switched on, once
 * per turn, not after the player asked for a hint, and within the game's
 * allowance (null: every move).
 */
export function coachWatchApplies(check: {
  enabled: boolean;
  alreadyChecked: boolean;
  askedForHint: boolean;
  used: number;
  limit: number | null;
}): boolean {
  if (!check.enabled || check.alreadyChecked || check.askedForHint) return false;
  return check.limit === null || check.used < check.limit;
}
