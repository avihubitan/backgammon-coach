import type { AiLevel, GameState } from '@/game';

/**
 * What the opponent says, and when. A light personality layer: a handful of
 * lines per temperament, said at the moments that matter, never often enough
 * to turn the game into a chat. Pure, so the rules are testable.
 */
export type Moment =
  | 'greeting'
  /** Sitting down again straight after a game against the same opponent. */
  | 'rematch'
  | 'youHit'
  | 'theyHit'
  | 'youWin'
  /** The player won, and the opponent nearly got there first. */
  | 'youWinClose'
  | 'theyWin'
  | 'theyWinClose'
  | 'youGammon'
  | 'theyGammon';

const LINES: Record<AiLevel, Record<Moment, string[]>> = {
  // Niko: friendly and relaxed.
  beginner: {
    greeting: ['Hi! Good luck, and have fun.', 'Let’s play! No pressure.', 'Ready when you are.'],
    rematch: ['Again? Let’s go!', 'Round two!', 'One more? I’m in.'],
    youHit: ['Ouch! Nice shot.', 'Hey, I needed that one!', 'Oof. Well hit.'],
    theyHit: ['Oops, sorry about that!', 'Gotcha! You’ll be back.', 'Sorry, I had to.'],
    youWin: ['Well played! That was fun.', 'You got me. Well played!'],
    youWinClose: ['So close! Well played.', 'One more roll and I had it!'],
    theyWin: ['Good game! Rematch?', 'That was fun. Good game!'],
    theyWinClose: ['Phew, that was close. Good game!', 'You nearly had me. Good game!'],
    youGammon: ['A gammon! You flattened me.', 'Wow. I didn’t stand a chance.'],
    theyGammon: ['The dice liked me today. Good game!', 'Lucky day for me. Good game!'],
  },
  // Leyla: confident, never smug.
  intermediate: {
    greeting: ['Let’s see what you’ve got.', 'Good luck. I’m feeling sharp today.', 'Ready? I am.'],
    rematch: ['Again? Good. I’m ready.', 'Rematch. Let’s go.'],
    youHit: ['Hm. Not bad.', 'Okay, I felt that.', 'Good shot.'],
    theyHit: ['Back you go.', 'Gotcha.', 'Had to take that one.'],
    youWin: ['Well played. I’ll get you next time.', 'Okay, you earned that one.'],
    youWinClose: ['So close. Well played.', 'You held your nerve. Nice.'],
    theyWin: ['Good game. Want another try?', 'Good game. You made me work.'],
    theyWinClose: ['Close one. Good game.', 'That was tight. Good game.'],
    youGammon: ['A gammon. Respect.', 'You were on fire. Well played.'],
    theyGammon: ['My day today. Good game.', 'Good game. Next one’s yours?'],
  },
  // Viktor: calm and courteous.
  advanced: {
    greeting: ['Good luck.', 'Let us begin.', 'May the dice be fair.'],
    rematch: ['Again. Good luck.', 'Once more, then.'],
    youHit: ['Well timed.', 'Good shot.', 'Noted.'],
    theyHit: ['A necessary hit.', 'Forgive me.', 'Pressure.'],
    youWin: ['Well played. Impressive.', 'A deserved win.'],
    youWinClose: ['A fine finish. Well played.', 'Narrowly done. Well played.'],
    theyWin: ['Good game. Thank you.', 'Good game.'],
    theyWinClose: ['A close race. Good game.', 'Very close. Good game.'],
    youGammon: ['A gammon. Remarkable play.', 'Decisive. Well played.'],
    theyGammon: ['Good game. Thank you.', 'The dice favoured me. Good game.'],
  },
};

export const linesFor = (level: AiLevel, moment: Moment): readonly string[] => LINES[level][moment];

/**
 * One line for the moment; `seed` varies it from game to game and turn to turn.
 * `avoid` (the line said last time) is skipped, so the same words don't come twice in a row.
 */
export function pickLine(level: AiLevel, moment: Moment, seed: number, avoid?: string | null): string {
  const lines = LINES[level][moment];
  const index = Math.abs(Math.floor(seed)) % lines.length;
  return lines[index] === avoid && lines.length > 1 ? lines[(index + 1) % lines.length] : lines[index];
}

/** Hits get a line only when the opponent has been quiet for a while; the start and the end always do. */
const QUIET_TURNS: Record<Moment, number> = {
  greeting: 0,
  rematch: 0,
  youWin: 0,
  youWinClose: 0,
  theyWin: 0,
  theyWinClose: 0,
  youGammon: 0,
  theyGammon: 0,
  youHit: 5,
  theyHit: 5,
};

/**
 * Whether the opponent speaks now. `turnsPlayed` counts finished turns in the
 * game; `lastSpoke` is when it last said something (null: not yet).
 */
export function shouldSpeak(moment: Moment, turnsPlayed: number, lastSpoke: number | null): boolean {
  const quiet = QUIET_TURNS[moment];
  return quiet === 0 || lastSpoke === null || turnsPlayed - lastSpoke >= quiet;
}

/** A game the loser was this close to winning: three checkers or fewer left to bear off. */
export const CLOSE_FINISH_LEFT = 3;

/** What the opponent says when the game ends: who won, how big, and whether it was close. */
export function farewellMoment(state: GameState): Moment | null {
  const result = state.result;
  if (!result) return null;
  const won = result.winner === 'player1';
  if (result.type !== 'single') return won ? 'youGammon' : 'theyGammon';
  const loser = won ? 'player2' : 'player1';
  const close = result.reason === 'bore-off' && 15 - state.board.off[loser] <= CLOSE_FINISH_LEFT;
  if (won) return close ? 'youWinClose' : 'youWin';
  return close ? 'theyWinClose' : 'theyWin';
}

/** How soon after a game against the same opponent a new one counts as a rematch. */
export const REMATCH_WITHIN_MS = 15 * 60 * 1000;

/** A new game opens with a greeting, or, straight after one against the same opponent, a rematch line. */
export function openingMoment(level: AiLevel, previous: { level: AiLevel; finishedAt: string } | undefined, now: number): Moment {
  if (!previous || previous.level !== level) return 'greeting';
  const ago = now - new Date(previous.finishedAt).getTime();
  return ago >= 0 && ago <= REMATCH_WITHIN_MS ? 'rematch' : 'greeting';
}

/** A small stable number from a game id, to vary lines between games. */
export function seedFrom(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash);
}
