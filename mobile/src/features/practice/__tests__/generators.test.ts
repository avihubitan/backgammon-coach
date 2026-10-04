import { isSkillId, type ChoiceStep, type LessonStep, type MoveStep, type TapStep } from '@/curriculum';
import { DRILL_CATEGORIES, type DrillCategory } from '@/curriculum/drills';
import {
  boardFromSetup,
  challengeGoalReached,
  challengeOutcomes,
  expandDice,
  goalMet,
  sameTarget,
  solutionMoves,
  usesRealRoll,
} from '@/features/lessons/engine/evaluate';
import {
  applyMove,
  applyNotation,
  checkersAt,
  createBoard,
  createRng,
  exposure,
  findPlayForDice,
  getLegalPlaysForDice,
  hasContact,
  isMadePoint,
  pipCount,
  raceWinProbability,
  validateBoard,
  type BoardState,
} from '@/game';

import { GENERATORS, type DrillGenerator } from '../generators';
import { longestWall } from '../generators/primes';
import { rollsReaching, shotsExplained } from '../generators/shots';
import { buildDrillSession } from '../practiceModel';

const SEEDS = Array.from({ length: 50 }, (_, i) => i * 7919 + 13);

const generated = Object.entries(GENERATORS).flatMap(([category, levels]) =>
  Object.entries(levels!).map(([level, generate]) => [`${category}/${level}`, category as DrillCategory, level, generate] as const),
);

/** Each generated step, for every seed (null when that draw found nothing). */
function draws(generate: DrillGenerator): (LessonStep | null)[] {
  return SEEDS.map((seed, index) => generate(createRng(seed), index));
}

const correctOption = (step: ChoiceStep) => step.options.find((option) => option.correct)!;
const board = (step: { board?: { position: Parameters<typeof createBoard>[0] } }): BoardState => boardFromSetup(step.board as never);

function checkMove(step: MoveStep) {
  const start = boardFromSetup(step.board);
  const moves = solutionMoves(step, start);
  const end = moves.reduce((current, move) => applyMove(current, 'player1', move), start);
  expect(goalMet(step.goal, start, end, moves)).toBe(true);
  const plays = getLegalPlaysForDice(start, 'player1', expandDice(step.board.dice), { largerDieRule: usesRealRoll(step) });
  // A real decision: some legal play misses the goal.
  expect(plays.some((play) => !goalMet(step.goal, start, play.board, play.moves))).toBe(true);
}

function checkChoice(step: ChoiceStep) {
  expect(step.options.length).toBeGreaterThanOrEqual(2);
  expect(step.options.filter((option) => option.correct)).toHaveLength(1);
  expect(new Set(step.options.map((option) => option.id)).size).toBe(step.options.length);
  expect(new Set(step.options.map((option) => option.text)).size).toBe(step.options.length);
  for (const option of step.options) expect(option.explanation.length).toBeGreaterThan(0);
  for (const option of step.options) {
    if (!option.play) continue;
    const dice = expandDice(step.board!.dice!);
    expect(findPlayForDice(board(step), 'player1', dice, option.play, { largerDieRule: true })).not.toBeNull();
  }
}

function checkTap(step: TapStep) {
  expect(step.answers.length).toBeGreaterThan(0);
  for (const wrong of step.wrongCases ?? []) {
    for (const target of wrong.targets) expect(step.answers.some((answer) => sameTarget(answer, target))).toBe(false);
  }
}

describe.each(generated)('generator %s', (_name, category, level, generate) => {
  const steps = draws(generate);
  const found = steps.filter((step): step is LessonStep => step !== null);

  it('almost always finds a position', () => {
    expect(found.length).toBeGreaterThanOrEqual(SEEDS.length * 0.9);
  });

  it('makes valid, answerable exercises', () => {
    for (const step of found) {
      if ('board' in step && step.board) expect(validateBoard(board(step))).toEqual([]);
      if (step.kind === 'move') checkMove(step);
      if (step.kind === 'choice') checkChoice(step);
      if (step.kind === 'tap') checkTap(step);
      if (step.kind === 'challenge') {
        const start = boardFromSetup(step.board);
        expect(challengeGoalReached(step.goal, start)).toBe(false);
        expect(challengeOutcomes(start, step.rolls, step.goal)).toEqual({ solvable: true, failable: true });
      }
      if ('prompt' in step) expect(step.prompt.length).toBeLessThanOrEqual(150);
    }
  });

  it('is deterministic for a seed', () => {
    expect(JSON.stringify(draws(generate))).toBe(JSON.stringify(steps));
  });

  it('gives answers the engine agrees with', () => {
    for (const step of found) checkSemantics(category, level, step);
  });
});

/** The specific claim each kind of question makes, recomputed from the board. */
function checkSemantics(category: DrillCategory, level: string, step: LessonStep) {
  const key = `${category}/${level}`;
  if (step.kind === 'choice') {
    const position = board(step);
    const right = correctOption(step);
    const mine = pipCount(position, 'player1');
    const theirs = pipCount(position, 'player2');
    switch (key) {
      case 'race/closer':
      case 'race/compare':
      case 'race/quick':
        expect(['you', 'me'].includes(right.id)).toBe(mine < theirs);
        break;
      case 'race/small':
      case 'race/full':
        expect(Number(right.id)).toBe(mine);
        expect(hasContact(position)).toBe(false);
        break;
      case 'race/contact':
        expect(right.id === 'no').toBe(hasContact(position));
        break;
      case 'race/favourite':
        expect(right.id === 'you').toBe(raceWinProbability(mine, theirs) > 0.5);
        break;
      case 'shots/can-hit':
        expect(right.id === 'yes').toBe(exposure(position, 'player1').hittingRolls > 0);
        break;
      case 'shots/count':
        expect(Number(right.id)).toBe(exposure(position, 'player1').hittingRolls);
        break;
      case 'shots/direct': {
        const blot = Array.from({ length: 24 }, (_, i) => i + 1).find((point) => checkersAt(position, point, 'player1') === 1)!;
        const shooter = Array.from({ length: 24 }, (_, i) => i + 1).filter((point) => point < blot && checkersAt(position, point, 'player2') > 0);
        expect(shooter).toHaveLength(1);
        expect(right.id === 'direct').toBe(blot - shooter[0] <= 6);
        break;
      }
      case 'shots/fewer': {
        const shotsAfter = (play: string) => exposure(applyNotation(position, 'player1', play), 'player1').hittingRolls;
        const other = step.options.find((option) => !option.correct)!;
        expect(shotsAfter(right.play!)).toBeLessThan(shotsAfter(other.play!));
        break;
      }
      case 'primes/length':
      case 'read/wall':
        expect(Number(right.id)).toBe(longestWall(position).length);
        break;
      case 'read/can-hit': {
        const hits = getLegalPlaysForDice(position, 'player1', expandDice(step.board!.dice!), { largerDieRule: true }).some((play) =>
          play.moves.some((move) => move.hit),
        );
        expect(right.id === 'yes').toBe(hits);
        break;
      }
      case 'read/shots': {
        const count = exposure(position, 'player1').hittingRolls;
        expect(right.id).toBe(count === 0 ? 'none' : count < 12 ? 'some' : 'many');
        break;
      }
      case 'read/bear-off':
        expect(right.id === 'yes').toBe(challengeGoalReached({ type: 'all-home' }, position) && position.bar.player1 === 0);
        break;
      case 'read/race':
        expect(right.id === 'fight').toBe(hasContact(position));
        break;
      case 'read/leader':
        expect(right.id === 'you').toBe(mine < theirs);
        break;
      default:
        break;
    }
  }
  if (step.kind === 'tap') {
    const answer = step.answers[0];
    const position = board(step);
    if (key === 'board/numbers' || key === 'board/hidden') {
      expect(step.prompt).toContain(`**${answer.kind === 'point' ? answer.point : -1}-point**`);
    }
    if (key === 'primes/gap' && answer.kind === 'point') {
      const filled = createBoard({ ...step.board.position, player1: { ...step.board.position.player1, [answer.point]: 2 } });
      expect(longestWall(position).length).toBeLessThan(6);
      expect(longestWall(filled).length).toBeGreaterThanOrEqual(6);
    }
    if (key === 'read/blots') {
      for (const target of step.answers) expect(target.kind === 'point' && checkersAt(position, target.point, 'player1')).toBe(1);
    }
    if (key === 'anchors/spot') {
      const anchors = [19, 20, 21, 22, 23, 24].filter((point) => isMadePoint(position, point, 'player1'));
      expect(anchors).toEqual([answer.kind === 'point' ? answer.point : -1]);
    }
  }
}

describe('shot counts', () => {
  it('match the standard table for a single shooter', () => {
    const table = [11, 12, 14, 15, 15, 17, 6, 6, 5, 3, 2, 3];
    table.forEach((count, index) => expect(shotsExplained(index + 1).count).toBe(count));
    expect(rollsReaching(4).map((roll) => roll.label)).toEqual(expect.arrayContaining(['4-1', '3-1', '2-2', '1-1']));
  });
});

describe('drill sessions', () => {
  it.each(DRILL_CATEGORIES.map((info) => [info.id, info] as const))('%s always fills a session, at every level', (_id, info) => {
    for (const seed of SEEDS.slice(0, 15)) {
      // A learner who has just unlocked the drill, and one who has cleared every level.
      const fresh = buildDrillSession(info.id, seed, 5, (lessonId) => lessonId === info.requiresLesson);
      const cleared = Object.fromEntries(info.levels.map((level) => [level.id, { attempted: 10, firstTry: 10 }]));
      const expert = buildDrillSession(info.id, seed, 5, () => true, cleared);
      for (const session of [fresh, expert]) {
        expect(session.steps).toHaveLength(5);
        expect(new Set(session.steps.map((step) => step.id)).size).toBe(5);
        for (const step of session.steps) {
          expect(isSkillId(step.skill)).toBe(true);
          expect(session.levelOf[step.id]).toBeDefined();
        }
      }
    }
  });

  it('builds sessions fast enough to open instantly', () => {
    const started = Date.now();
    let built = 0;
    for (const info of DRILL_CATEGORIES) {
      for (const seed of SEEDS.slice(0, 10)) {
        buildDrillSession(info.id, seed);
        built++;
      }
    }
    expect((Date.now() - started) / built).toBeLessThan(40);
  });
});
