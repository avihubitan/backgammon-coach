/**
 * The sound catalogue. Files are synthesized by scripts/generate-sounds.ts.
 *
 * Categories let players switch groups of sounds independently, and keep
 * relative loudness in one place: board sounds play often and sit lower,
 * rewards are rarer and brighter.
 */
export type SoundCategory = 'ui' | 'game' | 'reward' | 'music';

export type SoundId =
  | 'place1'
  | 'place2'
  | 'place3'
  | 'select'
  | 'hit'
  | 'bearoff'
  | 'dice'
  | 'success'
  | 'error'
  | 'xp'
  | 'star1'
  | 'star2'
  | 'star3'
  | 'complete'
  | 'levelup'
  | 'unlock'
  | 'tap'
  | 'whoosh';

export interface SoundDefinition {
  source: number;
  category: SoundCategory;
  /** 0..1, multiplied by the category volume. */
  volume: number;
  /** Players kept for this sound so quick repeats can overlap. */
  voices?: number;
}

export const CATEGORY_VOLUME: Record<SoundCategory, number> = {
  ui: 0.6,
  game: 0.85,
  reward: 0.9,
  music: 0.35,
};

export const SOUNDS: Record<SoundId, SoundDefinition> = {
  place1: { source: require('../../../assets/sounds/place1.wav'), category: 'game', volume: 0.8 },
  place2: { source: require('../../../assets/sounds/place2.wav'), category: 'game', volume: 0.8 },
  place3: { source: require('../../../assets/sounds/place3.wav'), category: 'game', volume: 0.8 },
  select: { source: require('../../../assets/sounds/select.wav'), category: 'game', volume: 0.9 },
  hit: { source: require('../../../assets/sounds/hit.wav'), category: 'game', volume: 1 },
  bearoff: { source: require('../../../assets/sounds/bearoff.wav'), category: 'game', volume: 0.85 },
  dice: { source: require('../../../assets/sounds/dice.wav'), category: 'game', volume: 0.85 },
  success: { source: require('../../../assets/sounds/success.wav'), category: 'reward', volume: 0.8 },
  error: { source: require('../../../assets/sounds/error.wav'), category: 'ui', volume: 0.9 },
  xp: { source: require('../../../assets/sounds/xp.wav'), category: 'reward', volume: 0.8, voices: 3 },
  star1: { source: require('../../../assets/sounds/star1.wav'), category: 'reward', volume: 0.85 },
  star2: { source: require('../../../assets/sounds/star2.wav'), category: 'reward', volume: 0.85 },
  star3: { source: require('../../../assets/sounds/star3.wav'), category: 'reward', volume: 0.85 },
  complete: { source: require('../../../assets/sounds/complete.wav'), category: 'reward', volume: 0.85 },
  levelup: { source: require('../../../assets/sounds/levelup.wav'), category: 'reward', volume: 0.9 },
  unlock: { source: require('../../../assets/sounds/unlock.wav'), category: 'reward', volume: 0.85 },
  tap: { source: require('../../../assets/sounds/tap.wav'), category: 'ui', volume: 0.7 },
  whoosh: { source: require('../../../assets/sounds/whoosh.wav'), category: 'ui', volume: 0.7 },
};
