import { reviewGame } from '@/game';
import { useGameStore } from '@/state/gameStore';
import { useMistakesStore } from '@/state/mistakesStore';

/**
 * Reviews finished games in the background, one at a time, so every game
 * feeds the coach (move quality, positions to practise) even when the player
 * never opens its review. The review screen then finds the work done.
 */
let running = false;
/** A request that came in while a run was going: run once more at the end so no game is missed. */
let rerun = false;
/** Games whose review failed this session: skipped instead of retried forever. */
const failed = new Set<string>();

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Reviews up to `max` games, newest first. Returns how many it reviewed. */
export async function reviewPendingGames({ max = 10, gapMs = 40 } = {}): Promise<number> {
  if (running) {
    rerun = true;
    return 0;
  }
  running = true;
  rerun = false;
  let reviewed = 0;
  try {
    for (let i = 0; i < max; i++) {
      // Yield first so the UI stays responsive between games.
      await pause(gapMs);
      const next = useGameStore
        .getState()
        .finished.find((game) => !game.review && game.history.length > 0 && !failed.has(game.id));
      if (!next) break;
      try {
        const review = reviewGame(next.history, 'player1');
        useGameStore.getState().saveReview(next.id, review);
        useMistakesStore.getState().addFromReview(next.id, review);
        reviewed++;
      } catch {
        failed.add(next.id);
      }
    }
  } finally {
    running = false;
  }
  return rerun ? reviewed + (await reviewPendingGames({ max, gapMs })) : reviewed;
}

/** After a game ends: let the result screen settle, then review it. */
export function scheduleReviews(delayMs = 1200) {
  setTimeout(() => void reviewPendingGames(), delayMs);
}
