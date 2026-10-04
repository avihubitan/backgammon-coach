import type { GameResult, GameReview } from '@/game';

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

const TYPE_LABEL = { single: 'Single game', gammon: 'Gammon', backgammon: 'Backgammon' } as const;

/** "Gammon!" is a cheer: only a gammon the player won gets one. */
export function resultTypeLabel(result: GameResult): string {
  const label = TYPE_LABEL[result.type];
  return result.type !== 'single' && result.winner === 'player1' ? `${label}!` : label;
}

/**
 * After a loss, what the coach's review holds, in one line: a reason to open
 * it, or the reassurance that the dice decided. Null until the review is ready.
 */
export function reviewTeaser(review: GameReview | undefined): string | null {
  if (!review) return null;
  const { mistakes, blunders, inaccuracies } = review.summary;
  const big = mistakes + blunders + review.cube.filter((decision) => !decision.correct).length;
  // A long list would discourage: the review opens on the biggest lesson anyway.
  if (big > 3) return 'Your coach has this game’s biggest lesson ready.';
  if (big > 0) return `Your coach found ${big} move${big === 1 ? '' : 's'} to look at.`;
  if (inaccuracies > 0) return 'No big mistakes, just a few small ones to look at.';
  return 'No real mistakes: the dice won this one.';
}
