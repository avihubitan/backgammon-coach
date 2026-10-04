import type { ChoiceStep } from '@/curriculum';
import { highlightPoint } from '@/curriculum/builders';
import { createBoard, exposure, getLegalPlays, type BoardSpec, type DieValue, type Rng } from '@/game';

import { attempt, die, diceText, int, notation, numberOptions, pick, shuffled } from './shared';

/**
 * Counting shots, in the order the lessons build it: can they hit at all,
 * direct or indirect, how many rolls, and which play leaves fewer.
 */

/** Rolls (as "6-2" labels, with how many of the 36 they are) that carry one checker exactly `distance` pips over open points. */
export function rollsReaching(distance: number): { label: string; weight: number; direct: boolean }[] {
  const rolls: { label: string; weight: number; direct: boolean }[] = [];
  for (let low = 1; low <= 6; low++) {
    for (let high = low; high <= 6; high++) {
      const double = low === high;
      const reaches = double ? [low, 2 * low, 3 * low, 4 * low] : [low, high, low + high];
      if (!reaches.includes(distance)) continue;
      rolls.push({ label: `${high}-${low}`, weight: double ? 1 : 2, direct: low === distance || high === distance });
    }
  }
  return rolls;
}

const listText = (labels: string[]) => (labels.length <= 1 ? labels.join('') : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`);

/** How a count of shots adds up, in words. */
export function shotsExplained(distance: number): { count: number; text: string } {
  const rolls = rollsReaching(distance);
  const count = rolls.reduce((total, roll) => total + roll.weight, 0);
  const combos = rolls.filter((roll) => !roll.direct).map((roll) => roll.label);
  if (distance <= 6) {
    return {
      count,
      text: combos.length
        ? `Any roll with a ${distance} hits (11 rolls), plus ${listText(combos)}: ${count} in all.`
        : `Any roll with a ${distance} hits: 11 rolls.`,
    };
  }
  return { count, text: `Only combinations reach ${distance} pips: ${listText(combos)}. That’s ${count} rolls.` };
}

/**
 * Your blot on `blot`, one of their checkers `distance` pips behind it, and
 * everything else safely out of the way: your stacks off the path between
 * them, their other checkers already past the blot.
 */
function singleShooter(rng: Rng, distance: number): { spec: BoardSpec; blot: number; shooter: number } | null {
  const blot = int(rng, Math.max(distance + 1, 4), Math.min(distance + 12, 16));
  const shooter = blot - distance;
  if (shooter < 1) return null;
  const player2: Record<number, number> = { [shooter]: 1 };
  let theirs = 1;
  for (const point of shuffled(rng, [18, 19, 20, 21, 22, 23, 24])) {
    const count = Math.min(int(rng, 2, 4), 15 - theirs);
    if (count < 2) break;
    player2[point] = count;
    theirs += count;
  }
  const player1: Record<number, number> = { [blot]: 1 };
  const free = shuffled(
    rng,
    Array.from({ length: 17 }, (_, i) => i + 1).filter((point) => (point < shooter || point > blot) && !player2[point]),
  );
  let mine = 1;
  for (const point of free.slice(0, 4)) {
    const count = Math.min(int(rng, 2, 4), 15 - mine);
    if (count < 2) break;
    player1[point] = count;
    mine += count;
  }
  return { spec: { player1, player2 }, blot, shooter };
}

export function canHit(rng: Rng, index: number): ChoiceStep | null {
  return attempt(40, () => {
    const reachable = rng() < 0.5;
    let spec: BoardSpec;
    let blot: number;
    let why: string;
    if (reachable) {
      const drawn = singleShooter(rng, int(rng, 1, 6));
      if (!drawn) return null;
      ({ spec, blot } = drawn);
      const distance = drawn.blot - drawn.shooter;
      why = `Yes: their checker on the ${drawn.shooter}-point is ${distance} pips behind it, so any ${distance} hits.`;
    } else {
      // Every one of theirs has already passed it.
      blot = int(rng, 2, 9);
      const player2: Record<number, number> = { 12: int(rng, 3, 4), 17: 3, 19: int(rng, 3, 5), 21: 2 };
      spec = { player1: { [blot]: 1, 13: 4, 24: 2, ...(blot === 6 ? { 8: 3 } : { 6: 4 }) }, player2 };
      why = `No: all their checkers have already passed your ${blot}-point, and checkers only move forward.`;
    }
    const shots = exposure(createBoard(spec), 'player1').hittingRolls;
    if ((shots > 0) !== reachable) return null;
    return {
      id: `can-hit-${index}`,
      kind: 'choice',
      prompt: `Can your opponent hit your blot on the **${blot}-point** with their next roll?`,
      board: { position: spec, highlights: [highlightPoint(blot, 'danger')] },
      options: [
        { id: 'yes', text: 'Yes', correct: reachable || undefined, explanation: why },
        { id: 'no', text: 'No', correct: !reachable || undefined, explanation: why },
      ],
    };
  });
}

export function directOrNot(rng: Rng, index: number): ChoiceStep | null {
  return attempt(40, () => {
    const distance = int(rng, 1, 12);
    const drawn = singleShooter(rng, distance);
    if (!drawn) return null;
    const direct = distance <= 6;
    const why = direct
      ? `It’s ${distance} pips away: within 6, so a single number hits it.`
      : `It’s ${distance} pips away: more than 6, so only both dice together can reach it.`;
    return {
      id: `direct-${index}`,
      kind: 'choice',
      prompt: `Your blot on the **${drawn.blot}-point**, their checker on the **${drawn.shooter}-point**. Direct shot or indirect?`,
      board: { position: drawn.spec, highlights: [highlightPoint(drawn.blot, 'danger'), highlightPoint(drawn.shooter, 'info')] },
      options: [
        { id: 'direct', text: 'Direct: one number hits it', correct: direct || undefined, explanation: why },
        { id: 'indirect', text: 'Indirect: it takes both dice', correct: !direct || undefined, explanation: why },
      ],
    };
  });
}

export function countShots(rng: Rng, index: number): ChoiceStep | null {
  return attempt(40, () => {
    const distance = int(rng, 1, 12);
    const drawn = singleShooter(rng, distance);
    if (!drawn) return null;
    const { count, text } = shotsExplained(distance);
    // The engine has the final say: anything in the way would change the count.
    if (exposure(createBoard(drawn.spec), 'player1').hittingRolls !== count) return null;
    const distractors = distance <= 6 ? [11, count + 4, count - 3] : [count + 3, count + 6, count - 2];
    return {
      id: `count-${index}`,
      kind: 'choice',
      prompt: `Their checker is **${distance}** pips behind your blot. How many of the 36 rolls hit it?`,
      board: { position: drawn.spec, highlights: [highlightPoint(drawn.blot, 'danger'), highlightPoint(drawn.shooter, 'info')] },
      options: numberOptions(
        rng,
        count,
        distractors,
        (value) => `${value} rolls`,
        (value) => (value === count ? `Right. ${text}` : text),
      ),
    };
  });
}

export function fewerShots(rng: Rng, index: number): ChoiceStep | null {
  return attempt(60, () => {
    const player2: Record<number, number> = { 12: int(rng, 3, 4), 17: 3, 19: int(rng, 4, 5) };
    if (rng() < 0.5) player2[1] = 2;
    else Object.assign(player2, { 1: 1, [int(rng, 2, 4)]: 1 });
    const player1: Record<number, number> = { 13: int(rng, 3, 4), 8: int(rng, 2, 3), 6: int(rng, 3, 4) };
    for (let loose = 0; loose < 2; loose++) {
      const point = int(rng, 2, 11);
      if (player1[point] || player2[point]) return null;
      player1[point] = 1;
    }
    const dice: [DieValue, DieValue] = [die(rng), die(rng)];
    if (dice[0] === dice[1]) return null;
    const spec: BoardSpec = { player1, player2 };
    const plays = getLegalPlays(createBoard(spec), 'player1', dice).map((play) => ({
      play,
      shots: exposure(play.board, 'player1').hittingRolls,
    }));
    if (plays.length < 2) return null;
    const fewest = Math.min(...plays.map((entry) => entry.shots));
    const safer = pick(rng, plays.filter((entry) => entry.shots === fewest));
    const riskier = plays.filter((entry) => entry.shots >= fewest + 6);
    if (riskier.length === 0) return null;
    const worse = pick(rng, riskier);
    const a = notation(safer.play.moves);
    const b = notation(worse.play.moves);
    const plural = (shots: number) => (shots === 0 ? 'nothing to hit' : `${shots} shot${shots === 1 ? '' : 's'}`);
    return {
      id: `fewer-${index}`,
      kind: 'choice',
      prompt: `You rolled ${diceText(dice[0], dice[1])}. Which play leaves **fewer shots**? Tap one to see it.`,
      board: { position: spec, dice },
      options: shuffled(rng, [
        {
          id: 'safer',
          text: a,
          play: a,
          correct: true,
          explanation: `Right: ${a} leaves ${plural(safer.shots)}, ${b} leaves ${plural(worse.shots)}.`,
        },
        {
          id: 'riskier',
          text: b,
          play: b,
          explanation: `${b} leaves ${plural(worse.shots)}. ${a} leaves ${safer.shots === 0 ? 'nothing to hit at all' : `only ${plural(safer.shots)}`}.`,
        },
      ]),
    };
  });
}
