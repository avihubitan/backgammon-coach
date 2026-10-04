import { applyMove, createBoard, initialBoard, type BoardState, type CheckerMove } from '@/game';

import { checkerCenterOnPoint, columnCenterX, computeMetrics, placeAt } from '../geometry';
import { diffLayout, layoutFromBoard, stackKey } from '../layout';
import {
  flightDuration,
  HOP_REST_MS,
  hopDelays,
  KNOCK_EXTRA_MS,
  mergeCues,
  MOVE_STEP_MS,
  planMotions,
  RESPACE_LEAD_MS,
  SETTLE_MS,
  STAGGER_MS,
} from '../motion';

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

  it('knocks a hit checker off to the bar the moment the hitter comes down on it', () => {
    const board = createBoard({ player1: { 8: 2, 6: 5 }, player2: { 5: 1, 19: 5 } });
    const { next, plan } = step(board, [{ from: 8, to: 5, die: 3, hit: true }]);
    const hitter = next.find((checker) => checker.player === 'player1' && checker.moved)!;
    const victim = next.find((checker) => checker.player === 'player2' && checker.moved)!;
    const hitterMotion = plan.motions[hitter.id];
    const victimMotion = plan.motions[victim.id];
    const landing = hitterMotion.delay + hitterMotion.duration;
    // The hitter lands hard; the hit checker doesn't move before it's touched.
    expect(hitterMotion.hits).toBe(true);
    expect(victimMotion.kind).toBe('hit');
    expect(victimMotion.delay).toBe(landing);
    expect(victimMotion.hop).toBeGreaterThan(hitterMotion.hop);
    expect(victimMotion.hits).toBeUndefined();
    expect(plan.impacts).toHaveLength(1);
    expect(plan.impacts[0]).toMatchObject({ delay: landing, victim: 'player2' });
    expect(plan.cues.map((cue) => cue.kind)).toEqual(['hit', 'place']);
    expect(plan.totalMs).toBe(victimMotion.delay + victimMotion.duration);
  });

  it('flies a hit checker a little longer than a plain move of the same length', () => {
    const board = createBoard({ player1: { 8: 2, 6: 5 }, player2: { 5: 1, 19: 5 } });
    const { next, plan } = step(board, [{ from: 8, to: 5, die: 3, hit: true }]);
    const victim = next.find((checker) => checker.player === 'player2' && checker.moved)!;
    expect(plan.motions[victim.id].duration).toBeGreaterThanOrEqual(220 + KNOCK_EXTRA_MS);
    expect(plan.motions[victim.id].duration).toBeLessThanOrEqual(MOVE_STEP_MS - 20 + KNOCK_EXTRA_MS);
  });

  it('closes up a full point just before a checker lands on it, not while it is far away', () => {
    // The 6-point holds five: a sixth squeezes the stack.
    const { next, plan } = step(initialBoard(), [{ from: 8, to: 6, die: 2, hit: false }]);
    const mover = next.find((checker) => checker.moved)!;
    const motion = plan.motions[mover.id];
    expect(plan.respace[stackKey(mover)]).toBe(motion.delay + motion.duration - RESPACE_LEAD_MS);
    // The stack it left needs no waiting.
    expect(plan.respace['player1:p8']).toBeUndefined();
  });

  it('cues the bear-off sound for checkers going into the tray', () => {
    const board = createBoard({ player1: { 2: 1, 1: 14 }, player2: { 24: 15 } });
    const { plan } = step(board, [{ from: 2, to: 'off', die: 2, hit: false }]);
    const motion = Object.values(plan.motions)[0];
    expect(motion.kind).toBe('bearoff');
    expect(plan.cues).toEqual([{ at: motion.duration, kind: 'bearoff' }]);
    // A glint where it lands in the tray, as it lands.
    expect(plan.glints).toHaveLength(1);
    expect(plan.glints[0].delay).toBe(motion.duration);
    expect(plan.glints[0].at.x).toBeGreaterThan(m.trayX);
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

  it('times each hop of a multi-step move by its length, with a short rest on each point', () => {
    // 8/7/4 with 1-3: a one-pip hop, then a hop over the bar.
    const delays = hopDelays(initialBoard(), 'player1', [
      { from: 8, to: 7, die: 1, hit: false },
      { from: 7, to: 4, die: 3, hit: false },
    ]);
    expect(delays[0]).toBe(0);
    // A short hop doesn't wait for the longest possible flight.
    expect(delays[1]).toBeLessThan(MOVE_STEP_MS);
    expect(delays[1]).toBeGreaterThanOrEqual(220 + HOP_REST_MS);
    // A long one (13 to 7, corner to corner) gets all the time it needs.
    const lone = createBoard({ player1: { 13: 1, 6: 14 }, player2: { 24: 15 } });
    const long = hopDelays(lone, 'player1', [
      { from: 13, to: 7, die: 6, hit: false },
      { from: 7, to: 1, die: 6, hit: false },
    ]);
    expect(long[1]).toBe(MOVE_STEP_MS - 20 + HOP_REST_MS);
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

describe('dragging and dropping', () => {
  it('finds the place under a finger: points, bar and tray', () => {
    const top = m.innerTop + 10;
    const bottom = m.innerBottom - 10;
    expect(placeAt(m, columnCenterX(m, 13), top)).toBe(13);
    expect(placeAt(m, columnCenterX(m, 18), top)).toBe(18);
    expect(placeAt(m, columnCenterX(m, 19), top)).toBe(19);
    expect(placeAt(m, columnCenterX(m, 24), top)).toBe(24);
    expect(placeAt(m, columnCenterX(m, 12), bottom)).toBe(12);
    expect(placeAt(m, columnCenterX(m, 6), bottom)).toBe(6);
    expect(placeAt(m, columnCenterX(m, 1), bottom)).toBe(1);
    expect(placeAt(m, m.barX + m.barWidth / 2, m.midY)).toBe('bar');
    expect(placeAt(m, m.trayX + m.trayWidth / 2, bottom)).toBe('off');
    // The narrow tray also takes the frame beside it.
    expect(placeAt(m, m.trayX - 2, bottom)).toBe('off');
    expect(placeAt(m, columnCenterX(m, 6), m.innerBottom + 4)).toBeNull();
    // Every checker spot maps back to its own point.
    for (let point = 1; point <= 24; point++) {
      const spot = checkerCenterOnPoint(m, point, 2, 3);
      expect(placeAt(m, spot.x, spot.y)).toBe(point);
    }
  });

  it('settles a dropped checker from the release point instead of flying from its old spot', () => {
    const before = layoutFromBoard(initialBoard());
    const next = diffLayout(before, applyMove(initialBoard(), 'player1', { from: 13, to: 8, die: 5, hit: false }));
    const at = { x: 123, y: 210 };
    const plan = planMotions(before, next, m, 1, { player: 'player1', at });
    const mover = next.find((checker) => checker.moved)!;
    expect(plan.motions[mover.id]).toMatchObject({ kind: 'move', delay: 0, duration: SETTLE_MS, from: at });
    expect(plan.cues).toEqual([{ at: SETTLE_MS, kind: 'place' }]);
  });

  it('times a hit from the settle, and leaves the other player alone', () => {
    const board = createBoard({ player1: { 8: 2, 6: 5 }, player2: { 5: 1, 19: 5 } });
    const before = layoutFromBoard(board);
    const next = diffLayout(before, applyMove(board, 'player1', { from: 8, to: 5, die: 3, hit: true }));
    const plan = planMotions(before, next, m, 1, { player: 'player1', at: { x: 300, y: 300 } });
    const victim = next.find((checker) => checker.player === 'player2' && checker.moved)!;
    expect(plan.motions[victim.id].delay).toBe(SETTLE_MS);
    expect(plan.impacts[0].delay).toBe(SETTLE_MS);

    const ai = planMotions(before, next, m, 2, { player: 'player2', at: { x: 0, y: 0 } });
    const hitter = next.find((checker) => checker.player === 'player1' && checker.moved)!;
    expect(ai.motions[hitter.id].from).toBeUndefined();
  });
});
