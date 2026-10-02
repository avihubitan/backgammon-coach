import { haptics, setHapticsEnabled } from '@/services/haptics';

import { SoundBank } from './audio';
import type { SoundId } from './sounds';

export type { SoundCategory, SoundId } from './sounds';

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
  checkerMove(): void;
  checkerSelect(): void;
  /** A blot is hit and sent to the bar. */
  hit(): void;
  bearOff(): void;
  diceRoll(): void;
  /** The dice settle after a roll. */
  diceLand(): void;
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

export const feedback: GameFeedback = {
  success: () => {
    soundBank.play('success');
    haptics.success();
  },
  error: () => {
    soundBank.play('error');
    haptics.warning();
  },
  checkerMove: () => {
    placeIndex = (placeIndex + 1) % PLACE_SOUNDS.length;
    soundBank.play(PLACE_SOUNDS[placeIndex]);
    haptics.light();
  },
  checkerSelect: () => {
    soundBank.play('select');
    haptics.tap();
  },
  hit: () => {
    soundBank.play('hit');
    haptics.heavy();
  },
  bearOff: () => {
    soundBank.play('bearoff');
    haptics.medium();
  },
  diceRoll: () => {
    soundBank.play('dice');
    haptics.light();
  },
  diceLand: () => haptics.medium(),
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
