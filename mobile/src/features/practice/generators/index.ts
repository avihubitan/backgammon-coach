import type { LessonStep } from '@/curriculum';
import type { DrillCategory } from '@/curriculum/drills';
import type { Rng } from '@/game';

import { makeAnchor, spotAnchor } from './anchors';
import { clearBoard, mostOff } from './bearOff';
import { findPoint, landing, namedPoint } from './board';
import { bothDice, fromBar, oneNumber } from './hitting';
import { escapeRun, huntBlots, raceHome, wallRace } from './miniGames';
import { closer, compare, favourite, raceOrNot, raceQuestion, smallCount } from './pips';
import { buildPrime, findGap, wallLength } from './primes';
import { READ_QUESTIONS } from './read';
import { canHit, countShots, directOrNot, fewerShots } from './shots';
import { makePoint, noBlots } from './structure';

/** Makes one exercise for a level, or null when no fitting position turned up (rare: callers fall back). */
export type DrillGenerator = (rng: Rng, index: number) => LessonStep | null;

/**
 * Generated levels by drill. Levels missing here are hand-picked ('classics',
 * the opening book). Every generator is deterministic for a given random source.
 */
export const GENERATORS: Partial<Record<DrillCategory, Record<string, DrillGenerator>>> = {
  board: {
    numbers: (rng, index) => findPoint(rng, index, false),
    hidden: (rng, index) => findPoint(rng, index, true),
    landing,
    names: namedPoint,
  },
  read: READ_QUESTIONS,
  hitting: { 'one-number': oneNumber, 'both-dice': bothDice, 'from-bar': fromBar, hunt: huntBlots },
  shots: { 'can-hit': canHit, direct: directOrNot, count: countShots, fewer: fewerShots },
  safety: { 'no-blots': noBlots },
  points: { make: makePoint },
  primes: { length: wallLength, gap: findGap, build: buildPrime, 'wall-race': wallRace },
  escape: { run: escapeRun },
  anchors: { spot: spotAnchor, make: makeAnchor },
  race: {
    closer,
    small: smallCount,
    contact: raceOrNot,
    home: raceHome,
    compare,
    full: (rng, index) => raceQuestion(rng, 1, `full-${index}`),
    quick: (rng, index) => raceQuestion(rng, 0, `quick-${index}`),
    favourite,
  },
  'bear-off': { most: mostOff, clear: clearBoard },
};

export function generatorFor(category: DrillCategory, level: string): DrillGenerator | undefined {
  return GENERATORS[category]?.[level];
}
