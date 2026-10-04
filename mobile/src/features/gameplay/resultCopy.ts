import type { GameResult } from '@/game';

export interface ResultCopy {
  title: string;
  line: string;
  /** After a loss, the review is the next step: its button comes first. */
  reviewFirst: boolean;
}

/** What the result sheet says. A loss is "Good game", never "You lost", and points to the review. */
export function resultCopy({
  result,
  opponentName,
  matchOver,
  matchWon,
  isMatch,
  canReview,
}: {
  result: GameResult;
  opponentName: string;
  isMatch: boolean;
  matchOver: boolean;
  matchWon: boolean;
  canReview: boolean;
}): ResultCopy {
  const won = result.winner === 'player1';
  const reason =
    result.reason === 'dropped-double'
      ? won
        ? `${opponentName} dropped your double.`
        : 'You dropped the double.'
      : result.reason === 'resigned'
        ? 'You resigned this game.'
        : won
          ? 'You bore off all your checkers first.'
          : `${opponentName} bore off first.`;
  const reviewFirst = !won && canReview;
  const title = isMatch && matchOver ? (matchWon ? 'Match won!' : 'Good match') : won ? 'You won!' : 'Good game';
  return { title, line: reviewFirst ? `${reason} Let’s see what you can improve.` : reason, reviewFirst };
}
