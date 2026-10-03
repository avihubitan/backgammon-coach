/**
 * When to ask "How was this?" after a lesson or a game. For the closed beta:
 * at most once a day, so it never becomes a chore. Turn it off for the public
 * release (Profile keeps "Send feedback").
 */
export const QUICK_FEEDBACK_ENABLED = true;

export type FeedbackRating = 'good' | 'okay' | 'bad';
export type FeedbackContext = 'lesson' | 'game';

export function shouldAskFeedback({
  enabled = QUICK_FEEDBACK_ENABLED,
  canSend,
  today,
  lastAskedDay,
}: {
  enabled?: boolean;
  /** Feedback can reach us (usage data on, and somewhere to send it). */
  canSend: boolean;
  today: string;
  lastAskedDay: string | null;
}): boolean {
  return enabled && canSend && lastAskedDay !== today;
}
