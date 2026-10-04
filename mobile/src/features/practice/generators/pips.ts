import type { ChoiceStep } from '@/curriculum';
import { highlightPoint } from '@/curriculum/builders';
import { checkersAt, createBoard, hasContact, pipCount, raceWinProbability, type BoardSpec, type BoardState, type Rng } from '@/game';

import { additions, attempt, int, numberOptions, pipTerms, place, sum, theirPoint, total } from './shared';

/**
 * Pip counting, from "who's closer?" with two checkers to reading a full race,
 * and finally whether the race favours you when you're on roll.
 */

/** A spec as plain maps, for building positions checker by checker. */
interface Sides {
  player1: Record<number, number>;
  player2: Record<number, number>;
}

/** Spreads `count` checkers over points 1..`deepest` (from the owner's side), favouring low points like a real race. */
function scatter(rng: Rng, count: number, deepest: number): Record<number, number> {
  let placement: Record<number, number> = {};
  for (let i = 0; i < count; i++) {
    const distance = Math.min(deepest, 1 + Math.floor(Math.pow(rng(), 1.4) * deepest));
    placement = place(placement, distance);
  }
  return placement;
}

/** A race position with `mine` and `theirs` checkers left; the rest are borne off. */
function smallRace(rng: Rng, mine: number, theirs: number, deepest: number): BoardSpec {
  const player1 = scatter(rng, mine, deepest);
  const theirSide = scatter(rng, theirs, deepest);
  const player2 = Object.fromEntries(Object.entries(theirSide).map(([distance, count]) => [theirPoint(Number(distance)), count]));
  return { player1, player2, off: { player1: 15 - mine, player2: 15 - theirs } };
}

const theirTerms = (spec: BoardSpec) => pipTerms(spec.player2 ?? {}, theirPoint);
const myTerms = (spec: BoardSpec) => pipTerms(spec.player1 ?? {});

export function closer(rng: Rng, index: number): ChoiceStep | null {
  return attempt(30, () => {
    const spec = smallRace(rng, int(rng, 1, 2), int(rng, 1, 2), 12);
    const mine = sum(myTerms(spec));
    const theirs = sum(theirTerms(spec));
    if (Math.abs(mine - theirs) < 2) return null;
    const youLead = mine < theirs;
    const counts = `You need ${additions(myTerms(spec))} = ${mine} pips; they need ${additions(theirTerms(spec))} = ${theirs}.`;
    return {
      id: `closer-${index}`,
      kind: 'choice',
      prompt: 'Who is closer to bearing everything off?',
      board: { position: spec },
      options: [
        { id: 'you', text: 'You', correct: youLead || undefined, explanation: `${youLead ? 'Right.' : 'Not this time.'} ${counts}` },
        {
          id: 'them',
          text: 'Your opponent',
          correct: !youLead || undefined,
          explanation: `${youLead ? 'Count theirs from their side: your 20-point is their 5-point.' : 'Right.'} ${counts}`,
        },
      ],
    };
  });
}

export function smallCount(rng: Rng, index: number): ChoiceStep {
  const spec = smallRace(rng, int(rng, 3, 5), int(rng, 2, 4), 9);
  const terms = myTerms(spec);
  const count = sum(terms);
  const largest = terms[0];
  return {
    id: `small-${index}`,
    kind: 'choice',
    prompt: 'Add up every checker. What’s **your** pip count?',
    board: { position: spec },
    options: numberOptions(
      rng,
      count,
      [count - largest, count + int(rng, 2, 5), count - int(rng, 2, 4)],
      (value) => `${value} pips`,
      (value) =>
        value === count
          ? `Right: ${additions(terms)} = ${count}.`
          : `Count each checker once, stacks included: ${additions(terms)} = ${count}.`,
    ),
  };
}

export function raceOrNot(rng: Rng, index: number): ChoiceStep | null {
  return attempt(30, () => {
    const sides: Sides = { player1: scatter(rng, int(rng, 5, 8), 7), player2: {} };
    for (const [distance, count] of Object.entries(scatter(rng, int(rng, 5, 8), 7))) {
      sides.player2[theirPoint(Number(distance))] = count;
    }
    const contact = rng() < 0.5;
    // One straggler: still among their checkers, or already past them all.
    const straggler = contact ? int(rng, 19, 23) : int(rng, 9, 13);
    if ((sides.player2[straggler] ?? 0) > 0) return null;
    sides.player1 = place(sides.player1, straggler);
    const spec: BoardSpec = { ...sides, off: { player1: 15 - total(sides.player1), player2: 15 - total(sides.player2) } };
    const board = createBoard(spec);
    if (hasContact(board) !== contact) return null;
    const lowest = Math.min(...Object.keys(sides.player2).map(Number));
    return {
      id: `contact-${index}`,
      kind: 'choice',
      prompt: 'Is this a **pure race** yet?',
      board: { position: spec, highlights: [highlightPoint(straggler, 'gold')] },
      options: [
        {
          id: 'yes',
          text: 'Yes: nobody can hit anybody',
          correct: !contact || undefined,
          explanation: contact
            ? `Not yet: your checker on the ${straggler}-point still has to get past their checker on the ${lowest}-point.`
            : 'Right. Every one of your checkers has passed all of theirs, so it’s a pure race.',
        },
        {
          id: 'no',
          text: 'Not yet: there’s still contact',
          correct: contact || undefined,
          explanation: contact
            ? `Right. Your checker on the ${straggler}-point is behind their checker on the ${lowest}-point: it can still hit or be hit.`
            : 'It is a race: your last checker on the ' + straggler + '-point has already passed all of theirs.',
        },
      ],
    };
  });
}

export function compare(rng: Rng, index: number): ChoiceStep | null {
  return attempt(30, () => {
    const spec = smallRace(rng, int(rng, 5, 8), int(rng, 5, 8), 9);
    const mine = sum(myTerms(spec));
    const theirs = sum(theirTerms(spec));
    const gap = Math.abs(mine - theirs);
    if (gap < 3 || gap > 15) return null;
    const youLead = mine < theirs;
    const counts = `You need ${mine} pips, they need ${theirs}: ${youLead ? 'you' : 'they'} lead by ${gap}.`;
    return {
      id: `compare-${index}`,
      kind: 'choice',
      prompt: 'Count both sides: who’s ahead in this race?',
      board: { position: spec },
      options: [
        { id: 'you', text: 'You', correct: youLead || undefined, explanation: counts },
        { id: 'them', text: 'Your opponent', correct: !youLead || undefined, explanation: counts },
      ],
    };
  });
}

/** A random full race: 15 checkers each, player1 in 1..12, player2 in 13..24, no contact. */
export function randomRace(rng: Rng): BoardState {
  const spots = (player: 'player1' | 'player2'): Record<number, number> => {
    let placement: Record<number, number> = {};
    for (let i = 0; i < 15; i++) {
      // Weighted toward the home board, like a real race.
      const distance = Math.min(12, 1 + Math.floor(Math.pow(rng(), 1.6) * 12));
      placement = place(placement, player === 'player1' ? distance : theirPoint(distance));
    }
    return placement;
  };
  return createBoard({ player1: spots('player1'), player2: spots('player2') });
}

/** Converts a board back into the readable spec format lessons use. */
export function specFromBoard(board: BoardState): BoardSpec {
  const player1: Record<number, number> = {};
  const player2: Record<number, number> = {};
  for (let point = 1; point <= 24; point++) {
    const mine = checkersAt(board, point, 'player1');
    const theirs = checkersAt(board, point, 'player2');
    if (mine > 0) player1[point] = mine;
    if (theirs > 0) player2[point] = theirs;
  }
  return { player1, player2, bar: { ...board.bar }, off: { ...board.off } };
}

function unequalRace(rng: Rng): BoardState {
  let board = randomRace(rng);
  for (let tries = 0; tries < 20 && pipCount(board, 'player1') === pipCount(board, 'player2'); tries++) board = randomRace(rng);
  return board;
}

/** Full-board pip questions: who's ahead (even `index`) or your own count (odd). */
export function raceQuestion(rng: Rng, index: number, id = `race-${index}`): ChoiceStep {
  const board = unequalRace(rng);
  const mine = pipCount(board, 'player1');
  const theirs = pipCount(board, 'player2');
  if (index % 2 === 0) {
    const ahead = mine < theirs;
    const gap = Math.abs(mine - theirs);
    return {
      id,
      kind: 'choice',
      prompt: 'Pure race. Count the pips: who is ahead?',
      board: { position: specFromBoard(board) },
      options: [
        {
          id: 'me',
          text: 'You are',
          correct: ahead || undefined,
          explanation: `You need ${mine} pips and your opponent needs ${theirs}. ${ahead ? `You lead by ${gap}.` : `They lead by ${gap}.`}`,
        },
        {
          id: 'them',
          text: 'Your opponent is',
          correct: !ahead || undefined,
          explanation: `Your count is ${mine}, theirs is ${theirs}. ${!ahead ? `They lead by ${gap}.` : `Actually you lead by ${gap}.`}`,
        },
      ],
    };
  }
  return {
    id,
    kind: 'choice',
    prompt: 'What is **your** pip count (the light checkers)?',
    board: { position: specFromBoard(board) },
    options: numberOptions(
      rng,
      mine,
      [mine + (mine % 2 === 0 ? 6 : -6), mine + (mine % 3 === 0 ? -11 : 9)],
      (value) => `${value} pips`,
      (value) =>
        value === mine
          ? `Exactly ${mine}. Count each checker’s distance from home and add them up.`
          : `Not quite: your pip count is ${mine}. Multiply each point by the checkers on it and add them up.`,
    ),
  };
}

export function favourite(rng: Rng, index: number): ChoiceStep | null {
  return attempt(40, () => {
    const board = randomRace(rng);
    const mine = pipCount(board, 'player1');
    const theirs = pipCount(board, 'player2');
    const chance = raceWinProbability(mine, theirs);
    // Clear enough to answer, close enough that being on roll matters.
    if (Math.abs(chance - 0.5) < 0.12 || Math.abs(mine - theirs) > 14) return null;
    const youFavoured = chance > 0.5;
    const lead = theirs - mine;
    const standing = lead > 0 ? `you lead by ${lead}` : lead < 0 ? `they lead by ${-lead}` : 'it’s level';
    const why = `You need ${mine} pips, they need ${theirs}: ${standing}, and rolling first is worth about 4 pips. You win about ${Math.round(chance * 100)}% of the time.`;
    return {
      id: `favourite-${index}`,
      kind: 'choice',
      prompt: 'Pure race, and it’s **your roll**. Who’s the favourite?',
      board: { position: specFromBoard(board) },
      options: [
        { id: 'you', text: 'You', correct: youFavoured || undefined, explanation: why },
        { id: 'them', text: 'Your opponent', correct: !youFavoured || undefined, explanation: why },
      ],
    };
  });
}
