import { boardFromSetup } from '@/features/lessons/engine/evaluate';
import { applyMove, createBoard, exposure, hasContact, pipCount, type BoardSpec, type BoardState } from '@/game';

import { getLesson, type ChoiceStep, type LessonStep, type TapStep } from '../index';

/**
 * The numbers lessons state are checked against the engine, so a lesson
 * never teaches a count the game itself disagrees with.
 */
const step = <T extends LessonStep>(lessonId: string, stepId: string) =>
  getLesson(lessonId)!.steps.find((candidate) => candidate.id === stepId) as T;
const board = (s: { board?: { position: BoardSpec } }) => boardFromSetup(s.board as never);
/** The board with one of the player's checkers moved to `to`, leaving a blot there. */
const blotOn = (start: BoardState, from: number, to: number): BoardState =>
  applyMove(start, 'player1', { from, to, die: 1, hit: false });
const correct = (choice: ChoiceStep) => choice.options.find((option) => option.correct)!.id;

describe('How Risky Is a Blot? (hitting-4)', () => {
  it('a blot behind every enemy checker cannot be hit', () => {
    const behind = step<ChoiceStep>('hitting-4', 'behind');
    expect(exposure(board(behind), 'player1').hittingRolls).toBe(0);
    expect(correct(behind)).toBe('no');
  });

  it('a blot 4 pips in front of their checkers is hit by 15 rolls', () => {
    const combos = step<LessonStep & { board: { position: BoardSpec } }>('hitting-4', 'combos');
    expect(exposure(board(combos), 'player1').hittingRolls).toBe(15);
  });

  it('only the direct blot is in single-number range', () => {
    const tap = step<TapStep>('hitting-4', 'tap-direct');
    expect(tap.answers).toEqual([{ kind: 'point', point: 5 }]);
  });

  it('a blot 9 away is hit by 5 rolls, one 3 away by 14', () => {
    const choice = step<ChoiceStep>('hitting-4', 'safer-spot');
    const start = board(choice);
    expect(exposure(blotOn(start, 13, 10), 'player1').hittingRolls).toBe(5);
    expect(exposure(blotOn(start, 6, 4), 'player1').hittingRolls).toBe(14);
    expect(correct(choice)).toBe('ten');
  });
});

describe('Who’s Ahead? (bearoff-4)', () => {
  it('their checker on your 20-point needs 5 pips, yours on 9 needs 9', () => {
    const closer = board(step<ChoiceStep>('bearoff-4', 'closer'));
    expect(pipCount(closer, 'player1')).toBe(9);
    expect(pipCount(closer, 'player2')).toBe(5);
    expect(correct(step<ChoiceStep>('bearoff-4', 'closer'))).toBe('them');
  });

  it('counts 18 pips in the small position', () => {
    const choice = step<ChoiceStep>('bearoff-4', 'add-up');
    expect(pipCount(board(choice), 'player1')).toBe(18);
    expect(correct(choice)).toBe('18');
  });

  it('the race question has contact; the count question is a race you lead 17 to 21', () => {
    expect(hasContact(board(step<ChoiceStep>('bearoff-4', 'pure-race')))).toBe(true);
    const ahead = board(step<ChoiceStep>('bearoff-4', 'who-ahead'));
    expect(hasContact(ahead)).toBe(false);
    expect(pipCount(ahead, 'player1')).toBe(17);
    expect(pipCount(ahead, 'player2')).toBe(21);
  });
});

describe('other counted facts', () => {
  it('the prime gap is the only missing point in a seven-point wall', () => {
    const gap = step<TapStep>('points-3', 'gap');
    const filled = createBoard({ ...gap.board.position, player1: { ...gap.board.position.player1, 13: 1, 6: 2 } });
    for (let point = 4; point <= 10; point++) expect(filled.points[point]).toBeGreaterThanOrEqual(2);
  });

  it('a checker on your 8-point needs 8 pips (racing-1 warm-up)', () => {
    const choice = step<ChoiceStep>('racing-1', 'pips');
    const only = createBoard({ player1: { 8: 1 }, off: { player1: 14, player2: 15 } });
    expect(pipCount(only, 'player1')).toBe(8);
    expect(correct(choice)).toBe('8');
  });
});
