import type { TapStep } from '@/curriculum';
import { highlightPoint, pointTargets, START } from '@/curriculum/builders';
import type { Rng } from '@/game';

import { die, int, pick, whereIs } from './shared';

/** "Find the point": reading the board at a glance, then by name, then counting moves. */

export function findPoint(rng: Rng, index: number, hidden: boolean): TapStep {
  const point = int(rng, 1, 24);
  return {
    id: `${hidden ? 'hidden' : 'numbers'}-${index}`,
    kind: 'tap',
    prompt: hidden ? `No numbers this time: tap the **${point}-point**.` : `Tap the **${point}-point**.`,
    board: hidden ? { position: {}, showPointNumbers: false } : { position: {} },
    answers: pointTargets(point),
    correct: `That’s the ${point}-point.`,
    wrong: `That’s the {point}-point. The ${point}-point is ${whereIs(point)}.`,
  };
}

/** Points with names the lessons teach. */
const NAMED = [
  { point: 13, name: 'your **mid-point**', why: 'five of your checkers start there, halfway home' },
  { point: 7, name: 'your **bar point**', why: 'it sits right next to the bar, on your side' },
  { point: 5, name: 'your **golden point**', why: 'the 5-point, the best point in your home board' },
  { point: 24, name: 'the point where your **back checkers** start', why: 'the far corner, deep in their home board' },
];

export function namedPoint(rng: Rng, index: number): TapStep {
  const { point, name, why } = pick(rng, NAMED);
  return {
    id: `names-${index}`,
    kind: 'tap',
    prompt: `No numbers: tap ${name}.`,
    board: { position: START, showPointNumbers: false },
    answers: pointTargets(point),
    correct: `Yes: the ${point}-point, ${why}.`,
    wrong: `That’s the {point}-point. Look for the ${point}-point: ${why}.`,
  };
}

export function landing(rng: Rng, index: number): TapStep {
  const first = die(rng);
  const second = rng() < 0.35 ? die(rng) : null;
  const distance = first + (second ?? 0);
  const from = int(rng, distance + 1, 24);
  const to = from - distance;
  const moves = second ? `**${first}** and **${second}**` : `**${first}**`;
  const path = Array.from({ length: Math.min(distance, 4) }, (_, step) => from - step - 1).join(', ');
  return {
    id: `landing-${index}`,
    kind: 'tap',
    prompt: `A checker on the **${from}-point** moves ${moves}. Tap where it lands.`,
    board: {
      position: { player1: { [from]: 1 } },
      highlights: [highlightPoint(from, 'gold')],
      dice: second ? [first, second] : [first],
    },
    answers: pointTargets(to),
    correct: `${from} − ${distance} = ${to}: the ${to}-point.`,
    wrong: `Count ${distance} toward home from the ${from}-point: ${path}${distance > 4 ? '…' : ''}`,
  };
}
