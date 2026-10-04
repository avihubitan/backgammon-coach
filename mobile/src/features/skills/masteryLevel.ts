/**
 * The mastery levels a skill climbs, as plain data (no imports, so saved
 * progress can check them without pulling in the rules in mastery.ts).
 */
export type MasteryLevel = 'none' | 'introduced' | 'practised' | 'reliable' | 'mastered';

export const MASTERY_LEVELS: readonly MasteryLevel[] = ['none', 'introduced', 'practised', 'reliable', 'mastered'];

export const masteryRank = (level: MasteryLevel): number => MASTERY_LEVELS.indexOf(level);

export const isMasteryLevel = (value: unknown): value is MasteryLevel =>
  typeof value === 'string' && (MASTERY_LEVELS as readonly string[]).includes(value);
