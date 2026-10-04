import { haptics, setHapticsEnabled } from '@/services/haptics';

import { SoundBank } from './audio';
import type { SoundId } from './sounds';

export type { SoundCategory, SoundId } from './sounds';

/**
 * Whose board event it is. The player's own moves get sound and a touch; the
 * opponent's only a softer sound, so the phone doesn't buzz through its turn.
 */
export type Whose = 'own' | 'theirs';

/**
 * Every "juicy" moment in the game goes through here, so sound and haptics
 * stay consistent and can be switched off in one place.
 */
export interface GameFeedback {
  /** A correct answer or good move. */
  success(): void;
  /** A wrong answer: gentle, never harsh. */
  error(): void;
  /** A checker lands on a point. */
  checkerMove(whose?: Whose): void;
  checkerSelect(): void;
  /** A blot is hit and sent to the bar: the player's hit ('own'), or the player being hit ('theirs'). */
  hit(whose?: Whose): void;
  bearOff(whose?: Whose): void;
  diceRoll(whose?: Whose): void;
  /** The dice settle after a roll. */
  diceLand(whose?: Whose): void;
  /** The dice settle showing doubles: four moves. Only the player's own get a chime. */
  doubles(whose?: Whose): void;
  /** A game against the computer ends: a celebration for a win, only a soft touch for a loss. */
  gameEnd(won: boolean): void;
  /** XP arriving at a counter. */
  xp(): void;
  /** Stars pop one by one (1, 2, 3). */
  star(index: number): void;
  lessonComplete(): void;
  levelUp(): void;
  unlock(): void;
  tap(): void;
  whoosh(): void;
}

export const soundBank = new SoundBank();

const PLACE_SOUNDS: SoundId[] = ['place1', 'place2', 'place3'];
let placeIndex = 0;
/** The opponent's moves sound a little further away. */
const THEIRS = { volume: 0.75 };
const volumeFor = (whose: Whose) => (whose === 'own' ? undefined : THEIRS);

export const feedback: GameFeedback = {
  success: () => {
    soundBank.play('success');
    haptics.success();
  },
  error: () => {
    soundBank.play('error');
    haptics.warning();
  },
  checkerMove: (whose = 'own') => {
    placeIndex = (placeIndex + 1) % PLACE_SOUNDS.length;
    soundBank.play(PLACE_SOUNDS[placeIndex], volumeFor(whose));
    if (whose === 'own') haptics.light();
  },
  checkerSelect: () => {
    soundBank.play('select');
    haptics.tap();
  },
  hit: (whose = 'own') => {
    soundBank.play('hit');
    // Being hit is felt too, a little less than landing a hit.
    if (whose === 'own') haptics.heavy();
    else haptics.medium();
  },
  bearOff: (whose = 'own') => {
    soundBank.play('bearoff', volumeFor(whose));
    if (whose === 'own') haptics.medium();
  },
  diceRoll: (whose = 'own') => {
    soundBank.play('dice', whose === 'own' ? undefined : { volume: 0.7 });
    if (whose === 'own') haptics.light();
  },
  diceLand: (whose = 'own') => {
    if (whose === 'own') haptics.medium();
  },
  doubles: (whose = 'own') => {
    if (whose !== 'own') return;
    soundBank.play('star1', { volume: 0.55 });
    haptics.success();
  },
  gameEnd: (won) => {
    if (won) {
      soundBank.play('complete');
      haptics.success();
    } else {
      haptics.light();
    }
  },
  xp: () => {
    soundBank.play('xp');
    haptics.tap();
  },
  star: (index) => {
    const clamped = Math.max(1, Math.min(3, Math.round(index)));
    soundBank.play(`star${clamped}` as SoundId);
    if (clamped === 3) haptics.medium();
    else haptics.light();
  },
  lessonComplete: () => {
    soundBank.play('complete');
    haptics.success();
  },
  levelUp: () => {
    soundBank.play('levelup');
    haptics.success();
  },
  unlock: () => {
    soundBank.play('unlock');
    haptics.medium();
  },
  tap: () => {
    soundBank.play('tap');
    haptics.tap();
  },
  whoosh: () => soundBank.play('whoosh'),
};

export interface FeedbackSettings {
  sound: boolean;
  music: boolean;
  haptics: boolean;
}

/** Applies the player's settings; called on startup and whenever they change. */
export function configureFeedback(settings: FeedbackSettings) {
  soundBank.setEnabled({ ui: settings.sound, game: settings.sound, reward: settings.sound, music: settings.music });
  setHapticsEnabled(settings.haptics);
}
