import { applyMove, createBoard, initialBoard, type BoardState, type CheckerMove } from '@/game';

import { computeMetrics } from '../geometry';
import { diffLayout, layoutFromBoard } from '../layout';
import { flightDuration, mergeCues, MOVE_STEP_MS, planMotions, STAGGER_MS } from '../motion';

const m = computeMetrics(390);

function step(board: BoardState, moves: CheckerMove[], player: 'player1' | 'player2' = 'player1') {
  const before = layoutFromBoard(board);
  let after = board;
  for (const move of moves) after = applyMove(after, player, move);
  const next = diffLayout(before, after);
  return { before, next, plan: planMotions(before, next, m, 1) };
}

describe('planMotions', () => {
  it('flies a single moved checker and cues a landing sound', () => {
    const { next, plan } = step(initialBoard(), [{ from: 13, to: 8, die: 5, hit: false }]);
    const mover = next.find((checker) => checker.moved)!;
    const motion = plan.motions[mover.id];
    expect(motion).toMatchObject({ kind: 'move', delay: 0 });
    expect(motion.duration).toBeGreaterThanOrEqual(220);
    expect(motion.duration).toBeLessThan(MOVE_STEP_MS);
    expect(plan.cues).toEqual([{ at: motion.duration, kind: 'place' }]);
    expect(plan.impacts).toEqual([]);
    expect(Object.keys(plan.motions)).toHaveLength(1);
  });

  it('staggers several checkers moving in one update', () => {
    const { plan } = step(initialBoard(), [
      { from: 8, to: 5, die: 3, hit: false },
      { from: 6, to: 5, die: 1, hit: false },
    ]);
    const delays = Object.values(plan.motions)
      .map((motion) => motion.delay)
      .sort((a, b) => a - b);
    expect(delays).toEqual([0, STAGGER_MS]);
  });

  it('makes a hit checker wait for the hitter, then fly to the bar with an impact', () => {
    const board = createBoard({ player1: { 8: 2, 6: 5 }, player2: { 5: 1, 19: 5 } });
    const { next, plan } = step(board, [{ from: 8, to: 5, die: 3, hit: true }]);
    const hitter = next.find((checker) => checker.player === 'player1' && checker.moved)!;
    const victim = next.find((checker) => checker.player === 'player2' && checker.moved)!;
    const hitterMotion = plan.motions[hitter.id];
    const victimMotion = plan.motions[victim.id];
    const landing = hitterMotion.delay + hitterMotion.duration;
    expect(victimMotion.kind).toBe('hit');
    expect(victimMotion.delay).toBe(landing - 40);
    expect(victimMotion.hop).toBeGreaterThan(hitterMotion.hop);
    expect(plan.impacts).toHaveLength(1);
    expect(plan.impacts[0]).toMatchObject({ delay: landing, victim: 'player2' });
    expect(plan.cues.map((cue) => cue.kind)).toEqual(['hit', 'place']);
    expect(plan.totalMs).toBe(victimMotion.delay + victimMotion.duration);
  });

  it('cues the bear-off sound for checkers going into the tray', () => {
    const board = createBoard({ player1: { 2: 1, 1: 14 }, player2: { 24: 15 } });
    const { plan } = step(board, [{ from: 2, to: 'off', die: 2, hit: false }]);
    const motion = Object.values(plan.motions)[0];
    expect(motion.kind).toBe('bearoff');
    expect(plan.cues).toEqual([{ at: motion.duration, kind: 'bearoff' }]);
  });

  it('does not animate an unchanged board', () => {
    const board = initialBoard();
    const layout = layoutFromBoard(board);
    const plan = planMotions(layout, diffLayout(layout, board), m, 2);
    expect(plan.motions).toEqual({});
    expect(plan.cues).toEqual([]);
  });
});

describe('timing helpers', () => {
  it('scales flight time with distance within limits', () => {
    expect(flightDuration(0, m)).toBe(220);
    expect(flightDuration(m.width * 10, m)).toBe(MOVE_STEP_MS - 20);
    expect(flightDuration(m.width / 2, m)).toBeGreaterThan(flightDuration(m.width / 6, m));
  });

  it('merges near-simultaneous sounds, keeping the strongest', () => {
    expect(
      mergeCues([
        { at: 100, kind: 'place' },
        { at: 120, kind: 'hit' },
        { at: 300, kind: 'place' },
      ]),
    ).toEqual([
      { at: 100, kind: 'hit' },
      { at: 300, kind: 'place' },
    ]);
  });
});
