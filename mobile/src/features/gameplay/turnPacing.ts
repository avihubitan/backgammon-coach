import { isTurnComplete, type AiLevel, type GameState } from '@/game';

/**
 * How long the computer waits before each step of its turn. Every pause has a
 * job (hand the turn over, let its dice be read, let a checker land before the
 * next one takes off); nothing is slowed down just to look busy.
 */
export const AI_PACE = {
  /** After the player's turn, before the computer rolls: the turn changes hands. */
  roll: 380,
  /**
   * From the throw to the first move: the dice land (about 450 ms) and can be
   * read. The stronger the computer, the calmer it plays.
   */
  think: { beginner: 640, intermediate: 720, advanced: 800 } satisfies Record<AiLevel, number>,
  /** Between moves: the previous checker has just landed. */
  move: 440,
  /** After a hit: the hit checker has reached the bar. */
  afterHit: 620,
  /** After the last move, before the turn passes back. */
  end: 380,
  /** No legal move: long enough to see the dice that blocked it. */
  pass: 1000,
  /** Answering the player's double. */
  cube: 1000,
  /**
   * The first move of the game: the opening dice are shown on both halves,
   * then slide together (OPENING_REVEAL_MS + 380 ms) before the computer moves.
   */
  opening: 1250,
} as const;

/** How long the opening dice stay on their owners' halves before sliding together. */
export const OPENING_REVEAL_MS = 750;

/** The player has no legal move: the message shows this long before the turn passes. */
export const PLAYER_PASS_MS = 1500;

/** When the end banner appears after the last move: the last checker has landed. */
export const END_BANNER_DELAY_MS = 450;
/** The opponent's goodbye comes just after the banner, before the result sheet. */
export const FAREWELL_DELAY_MS = END_BANNER_DELAY_MS + 200;
/** When the result sheet follows: long enough to take in the end, short enough not to wait. */
export const RESULT_SHEET_DELAY_MS = { won: 1700, lost: 1300 } as const;

/** The wait before the computer's next step in `state`. */
export function aiStepDelay(state: GameState, { planned, level }: { planned: boolean; level: AiLevel }): number {
  if (state.phase === 'doubling') return AI_PACE.cube;
  if (state.phase === 'rolling') return AI_PACE.roll;
  const turn = state.turn;
  if (!turn) return AI_PACE.move;
  if (turn.moves.length === 0 && !planned) {
    if (turn.requiredMoves === 0) return AI_PACE.pass;
    return state.history.length === 0 ? AI_PACE.opening : AI_PACE.think[level];
  }
  const last = turn.moves[turn.moves.length - 1];
  if (last?.hit) return AI_PACE.afterHit;
  return isTurnComplete(turn) ? AI_PACE.end : AI_PACE.move;
}
