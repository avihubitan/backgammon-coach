import type { ChoiceOption, ChoiceStep, LessonStep, TapStep } from '@/curriculum';
import { pointTargets } from '@/curriculum/builders';
import { POSITION_BANK, type BankPosition } from '@/curriculum/positionBank';
import {
  allCheckersHome,
  blotPoints,
  checkersAt,
  createBoard,
  exposure,
  getLegalPlays,
  hasContact,
  isMadePoint,
  madePoints,
  pipCount,
  type BoardState,
  type DiceRoll,
  type Rng,
} from '@/game';

import { longestWall } from './primes';
import { notation, numberOptions, shuffled } from './shared';

/**
 * "Position check": the questions a strong player asks before every move,
 * about real positions from games. Each question joins the routine once its
 * lesson is done, so the check grows with the learner.
 */

interface Seen {
  entry: BankPosition;
  board: BoardState;
}

/** A bank position that suits the question, chosen by the random source. */
function pickPosition(rng: Rng, fits: (seen: Seen) => boolean): Seen | null {
  for (const entry of shuffled(rng, POSITION_BANK)) {
    const seen = { entry, board: createBoard(entry.position) };
    if (fits(seen)) return seen;
  }
  return null;
}

const yesNo = (yes: boolean, why: string, labels: [string, string] = ['Yes', 'No']): ChoiceOption[] => [
  { id: 'yes', text: labels[0], correct: yes || undefined, explanation: why },
  { id: 'no', text: labels[1], correct: !yes || undefined, explanation: why },
];

const choice = (id: string, prompt: string, seen: Seen, options: ChoiceOption[], withDice = false): ChoiceStep => ({
  id,
  kind: 'choice',
  prompt,
  board: withDice ? { position: seen.entry.position, dice: seen.entry.dice } : { position: seen.entry.position },
  options,
});

export function blots(rng: Rng, index: number): TapStep | null {
  const seen = pickPosition(rng, ({ board }) => blotPoints(board, 'player1').length > 0);
  if (!seen) return null;
  const theirs = blotPoints(seen.board, 'player2');
  return {
    id: `blots-${index}`,
    kind: 'tap',
    prompt: 'Position check: tap one of **your** blots.',
    board: { position: seen.entry.position },
    answers: pointTargets(...blotPoints(seen.board, 'player1')),
    correct: 'Yes: a lone checker there can be hit. Know where your blots are before every move.',
    wrong: 'That point has {count} checkers. Look for one of your light checkers on its own.',
    ...(theirs.length > 0 ? { wrongCases: [{ targets: pointTargets(...theirs), text: 'That’s one of their blots. Find one of yours.' }] } : {}),
  };
}

export function canHit(rng: Rng, index: number): ChoiceStep | null {
  const seen = pickPosition(rng, ({ board }) => blotPoints(board, 'player2').length > 0);
  if (!seen) return null;
  const hitting = getLegalPlays(seen.board, 'player1', seen.entry.dice as DiceRoll).find((play) => play.moves.some((move) => move.hit));
  const why = hitting
    ? `Yes: ${notation(hitting.moves)} hits. Whether to hit is the next question, but always look.`
    : 'No: none of your numbers lands on one of their blots this time.';
  return choice(`can-hit-${index}`, 'Position check: with this roll, **can you hit**?', seen, yesNo(!!hitting, why), true);
}

export function shots(rng: Rng, index: number): ChoiceStep | null {
  const seen = pickPosition(rng, () => true);
  if (!seen) return null;
  const count = exposure(seen.board, 'player1').hittingRolls;
  const band = count === 0 ? 'none' : count < 12 ? 'some' : 'many';
  const why = count === 0 ? 'Nothing to hit: none of your blots is in their reach.' : `${count} of their 36 rolls would hit one of your blots.`;
  return choice(`shots-${index}`, 'Position check: right now, how many of their rolls would hit you?', seen, [
    { id: 'none', text: 'None', correct: band === 'none' || undefined, explanation: why },
    { id: 'some', text: '1 to 11: less than a third', correct: band === 'some' || undefined, explanation: why },
    { id: 'many', text: '12 or more: a third or more', correct: band === 'many' || undefined, explanation: why },
  ]);
}

export function makePoint(rng: Rng, index: number): ChoiceStep | null {
  const seen = pickPosition(rng, () => true);
  if (!seen) return null;
  const before = new Set(madePoints(seen.board, 'player1'));
  const making = getLegalPlays(seen.board, 'player1', seen.entry.dice as DiceRoll)
    .map((play) => ({ play, made: madePoints(play.board, 'player1').filter((point) => !before.has(point)) }))
    .find((candidate) => candidate.made.length > 0);
  const why = making
    ? `Yes: ${notation(making.play.moves)} makes the ${making.made[0]}-point.`
    : 'No: no two of your checkers can land together on a new point with this roll.';
  return choice(`make-point-${index}`, 'Position check: can you **make a new point** with this roll?', seen, yesNo(!!making, why), true);
}

export function wall(rng: Rng, index: number): ChoiceStep | null {
  const seen = pickPosition(rng, ({ board }) => longestWall(board).length >= 2);
  if (!seen) return null;
  const { length, top } = longestWall(seen.board);
  const explain = `${length} points in a row, from the ${top}-point down to the ${top - length + 1}-point.`;
  return choice(
    `wall-${index}`,
    'Position check: how long is your **longest wall**?',
    seen,
    numberOptions(rng, length, [length - 1, length + 1, length + 2], (value) => `${value} points`, (value) =>
      value === length ? `Right: ${explain}` : `Count your made points side by side: ${explain}`,
    ),
  );
}

export function anchor(rng: Rng, index: number): ChoiceStep | null {
  const seen = pickPosition(rng, ({ board }) => [19, 20, 21, 22, 23, 24].some((point) => checkersAt(board, point, 'player1') > 0));
  if (!seen) return null;
  const anchors = [19, 20, 21, 22, 23, 24].filter((point) => isMadePoint(seen.board, point, 'player1'));
  const why = anchors.length
    ? `Yes: you hold the ${anchors[0]}-point in their home board. Your back checkers have a safe base.`
    : 'No: your back checkers are on their own. Each one is a blot they can attack.';
  return choice(`anchor-${index}`, 'Position check: do you have an **anchor**?', seen, yesNo(anchors.length > 0, why));
}

/** Their longest run of made points in front of your rearmost checker. */
function wallInFront(board: BoardState): { length: number; low: number; high: number; back: number } | null {
  let back = board.bar.player1 > 0 ? 25 : 0;
  if (back === 0) for (let point = 24; point >= 13 && back === 0; point--) if (checkersAt(board, point, 'player1') > 0) back = point;
  if (back === 0) return null;
  let best = { length: 0, low: 0, high: 0 };
  let run = 0;
  for (let point = back - 1; point >= Math.max(1, back - 12); point--) {
    run = isMadePoint(board, point, 'player2') ? run + 1 : 0;
    if (run > best.length) best = { length: run, low: point, high: point + run - 1 };
  }
  return { ...best, back };
}

export function trapped(rng: Rng, index: number): ChoiceStep | null {
  const seen = pickPosition(rng, ({ board }) => wallInFront(board) !== null);
  if (!seen) return null;
  const front = wallInFront(seen.board)!;
  const danger = front.length >= 4;
  const where = front.back === 25 ? 'your checker on the bar' : `your checker on the ${front.back}-point`;
  const why = danger
    ? `Yes: their wall from the ${front.high}-point to the ${front.low}-point is ${front.length} points long, right in front of ${where}.`
    : `No: their longest wall in front of ${where} is ${front.length || 'not even'} ${front.length === 1 ? 'point' : 'points'} long. It can still get out.`;
  return choice(`trapped-${index}`, 'Position check: are your back checkers getting **trapped**?', seen, yesNo(danger, why));
}

export function bearOff(rng: Rng, index: number): ChoiceStep | null {
  const seen = pickPosition(rng, () => true);
  if (!seen) return null;
  const home = allCheckersHome(seen.board, 'player1') && seen.board.bar.player1 === 0;
  const why = home
    ? 'Yes: all your checkers are in your home board, so each number can take one off.'
    : 'No: some of your checkers are still outside your home board. Everyone comes home first.';
  return choice(`bear-off-${index}`, 'Position check: can you **start bearing off**?', seen, yesNo(home, why));
}

export function raceOrFight(rng: Rng, index: number): ChoiceStep | null {
  const seen = pickPosition(rng, () => true);
  if (!seen) return null;
  const contact = hasContact(seen.board);
  const why = contact
    ? 'Fighting: your checkers and theirs still have to pass each other, so hits are possible.'
    : 'Racing: everyone has passed everyone. Nobody can be hit, so only speed matters.';
  return choice(
    `race-${index}`,
    'Position check: is this a **race** or a **fight**?',
    seen,
    [
      { id: 'race', text: 'A race: nobody can be hit', correct: !contact || undefined, explanation: why },
      { id: 'fight', text: 'A fight: there’s still contact', correct: contact || undefined, explanation: why },
    ],
  );
}

export function leader(rng: Rng, index: number): ChoiceStep | null {
  const seen = pickPosition(rng, ({ board }) => Math.abs(pipCount(board, 'player1') - pipCount(board, 'player2')) >= 6);
  if (!seen) return null;
  const mine = pipCount(seen.board, 'player1');
  const theirs = pipCount(seen.board, 'player2');
  const why = `You need ${mine} pips, they need ${theirs}: ${mine < theirs ? 'you' : 'they'} lead by ${Math.abs(mine - theirs)}.`;
  return choice('leader-' + index, 'Position check: who **leads the race**?', seen, [
    { id: 'you', text: 'You', correct: mine < theirs || undefined, explanation: why },
    { id: 'them', text: 'Your opponent', correct: mine > theirs || undefined, explanation: why },
  ]);
}

/** The questions in the order the lessons introduce them. */
export const READ_QUESTIONS: Record<string, (rng: Rng, index: number) => LessonStep | null> = {
  blots,
  'can-hit': canHit,
  shots,
  'make-point': makePoint,
  wall,
  anchor,
  trapped,
  'bear-off': bearOff,
  race: raceOrFight,
  leader,
};
