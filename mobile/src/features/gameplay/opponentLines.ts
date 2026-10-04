import type { AiLevel } from '@/game';

/**
 * What the opponent says, and when. A light personality layer: a handful of
 * lines per temperament, said at the moments that matter, never often enough
 * to turn the game into a chat. Pure, so the rules are testable.
 */
export type Moment =
  | 'greeting'
  | 'youHit'
  | 'theyHit'
  | 'youDoubles'
  | 'theyDoubles'
  | 'youWin'
  | 'theyWin'
  | 'youGammon'
  | 'theyGammon';

const LINES: Record<AiLevel, Record<Moment, string[]>> = {
  // Niko: friendly and relaxed.
  beginner: {
    greeting: ['Hi! Good luck, and have fun.', 'Let’s play! No pressure.', 'Ready when you are.'],
    youHit: ['Ouch! Nice shot.', 'Hey, I needed that one!', 'Oof. Well hit.'],
    theyHit: ['Oops, sorry about that!', 'Gotcha! You’ll be back.', 'Sorry, I had to.'],
    youDoubles: ['Doubles! Lucky you.', 'Ooh, doubles.'],
    theyDoubles: ['Doubles for me!', 'Ha, doubles!'],
    youWin: ['Well played! That was fun.', 'You got me. Good game!'],
    theyWin: ['Good game! Rematch?', 'Phew, that was close. Good game!'],
    youGammon: ['A gammon! You flattened me.', 'Wow. I didn’t stand a chance.'],
    theyGammon: ['The dice liked me today. Good game!', 'Lucky day for me. Good game!'],
  },
  // Leyla: confident.
  intermediate: {
    greeting: ['Let’s see what you’ve got.', 'Good luck. I’m feeling sharp today.', 'Ready? I am.'],
    youHit: ['Hm. Not bad.', 'Okay, I felt that.', 'Lucky shot. Maybe.'],
    theyHit: ['That’s how it’s done.', 'Back you go.', 'Gotcha.'],
    youDoubles: ['Doubles? Don’t get used to it.', 'Nice roll.'],
    theyDoubles: ['Doubles. Of course.', 'Thank you, dice.'],
    youWin: ['Well played. I’ll get you next time.', 'Okay, you earned that one.'],
    theyWin: ['Good game. Want another try?', 'Close one. Good game.'],
    youGammon: ['A gammon. Respect.', 'You were on fire. Well played.'],
    theyGammon: ['A gammon for me. Good game, though.', 'My day today. Good game.'],
  },
  // Viktor: calm and serious.
  advanced: {
    greeting: ['Good luck.', 'Let us begin.', 'May the dice be fair.'],
    youHit: ['Well timed.', 'Good shot.', 'Noted.'],
    theyHit: ['Pressure.', 'Timing matters.', 'A necessary hit.'],
    youDoubles: ['A strong roll.', 'Fortunate.'],
    theyDoubles: ['Useful.', 'Fortunate.'],
    youWin: ['Well played. Impressive.', 'A deserved win.'],
    theyWin: ['Good game. Thank you.', 'Good game.'],
    youGammon: ['A gammon. Remarkable play.', 'Decisive. Well played.'],
    theyGammon: ['A gammon. Good game, nonetheless.', 'Good game. Thank you.'],
  },
};

export const linesFor = (level: AiLevel, moment: Moment): readonly string[] => LINES[level][moment];

/** One line for the moment; `seed` varies it from game to game and turn to turn. */
export function pickLine(level: AiLevel, moment: Moment, seed: number): string {
  const lines = LINES[level][moment];
  return lines[Math.abs(Math.floor(seed)) % lines.length];
}

/** The start and the end always get a line; hits and doubles only when the opponent has been quiet for a while. */
const QUIET_TURNS: Record<Moment, number> = {
  greeting: 0,
  youWin: 0,
  theyWin: 0,
  youGammon: 0,
  theyGammon: 0,
  youHit: 5,
  theyHit: 5,
  youDoubles: 8,
  theyDoubles: 8,
};

/**
 * Whether the opponent speaks now. `turnsPlayed` counts finished turns in the
 * game; `lastSpoke` is when it last said something (null: not yet).
 */
export function shouldSpeak(moment: Moment, turnsPlayed: number, lastSpoke: number | null): boolean {
  const quiet = QUIET_TURNS[moment];
  return quiet === 0 || lastSpoke === null || turnsPlayed - lastSpoke >= quiet;
}

/** A small stable number from a game id, to vary lines between games. */
export function seedFrom(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash);
}
