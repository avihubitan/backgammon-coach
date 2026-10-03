import { createBoard, findPlayByNotation, initialBoard, installNetwork, playMove, startTurn, type BoardState, type DiceRoll } from '@/game';
import { createFeatureAccess } from '@/features/monetization/access';
import { FREE_ENTITLEMENTS } from '@/features/monetization/entitlements';
import { useGameStore } from '@/state/gameStore';

import { coachWatchApplies, QUIET_TURNS, watchPlay, watchSpacingAllows } from '../coachWatch';
import { nextGameInMatch, startActiveGame } from '../gameModel';

beforeAll(() => installNetwork(null));

function played(board: BoardState, roll: DiceRoll, notation: string) {
  let turn = startTurn(board, 'player1', roll);
  for (const move of findPlayByNotation(board, 'player1', roll, notation)!.moves) turn = playMove(turn, move);
  return turn;
}

describe('Coach Watch verdicts', () => {
  it('stops a clear mistake with a clue, keeping the answer for "Show me"', () => {
    const verdict = watchPlay(played(initialBoard(), [3, 1], '24/23 13/10'))!;
    expect(['mistake', 'blunder']).toContain(verdict.severity);
    expect(verdict.clue).toBe('You can make a point with this roll.');
    // The clue doesn't give the move away; the hint has it.
    expect(verdict.clue).not.toContain('8/5');
    expect(verdict.hint.notation).toBe('8/5 6/5');
    expect(verdict.hint.reason).toMatch(/5-point/);
  });

  it('notices a missed hit', () => {
    const board = createBoard({
      player1: { 13: 4, 8: 3, 6: 5, 24: 2, 5: 1 },
      player2: { 9: 1, 19: 5, 17: 3, 12: 4, 1: 2 },
    });
    expect(watchPlay(played(board, [4, 1], '24/20 24/23'))!.clue).toBe('There’s a hit you can make.');
  });

  it('stays quiet for good moves, reasonable alternatives and forced moves', () => {
    expect(watchPlay(played(initialBoard(), [3, 1], '8/5 6/5'))).toBeNull();
    expect(watchPlay(played(initialBoard(), [6, 5], '13/7 13/8'))).toBeNull();
    expect(watchPlay(played(createBoard({ player1: { 2: 1 }, player2: { 19: 1 } }), [6, 5], '2/off'))).toBeNull();
    expect(watchPlay(startTurn(initialBoard(), 'player1', [3, 1]))).toBeNull();
  });
});

describe('when Coach Watch looks', () => {
  const base = { enabled: true, alreadyChecked: false, askedForHint: false, used: 0, limit: 3 as number | null };

  it('checks once per turn, never after a hint, and only when switched on', () => {
    expect(coachWatchApplies(base)).toBe(true);
    expect(coachWatchApplies({ ...base, enabled: false })).toBe(false);
    expect(coachWatchApplies({ ...base, alreadyChecked: true })).toBe(false);
    expect(coachWatchApplies({ ...base, askedForHint: true })).toBe(false);
  });

  it('has a few checks per game for free players and every move for Premium', () => {
    expect(coachWatchApplies({ ...base, used: 2 })).toBe(true);
    expect(coachWatchApplies({ ...base, used: 3 })).toBe(false);
    expect(coachWatchApplies({ ...base, used: 40, limit: null })).toBe(true);
    expect(createFeatureAccess(FREE_ENTITLEMENTS, { reviewedToday: [], unlockedReviews: [] }).coachWatchPerGame()).toBe(3);
    const premium = { ...FREE_ENTITLEMENTS, isPremium: true, hasAiCoach: true };
    expect(createFeatureAccess(premium, { reviewedToday: [], unlockedReviews: [] }).coachWatchPerGame()).toBeNull();
  });

  it('counts checks per game, and each game of a match starts afresh', () => {
    useGameStore.setState({ active: startActiveGame('m2', { level: 'beginner', matchLength: 3, cubeEnabled: false }, '2026-03-10T10:00:00.000Z') });
    useGameStore.getState().countWatch(6);
    expect(useGameStore.getState().active!).toMatchObject({ watchUsed: 1, watchLastPly: 6 });
    expect(nextGameInMatch(useGameStore.getState().active!)).toMatchObject({ watchUsed: 0, watchLastPly: undefined });
  });
});

describe('spacing between Coach Watch stops', () => {
  const mine = { player: 'player1', moves: [{}] };
  const theirs = { player: 'player2', moves: [{}] };
  const cube = { player: 'player1', moves: [], cubeAction: 'double' };
  // The coach stopped the player on the turn that starts at history length 4.
  const upTo = (myMoves: number) => {
    const history: { player: string; moves: unknown[]; cubeAction?: string }[] = [mine, theirs, mine, theirs];
    for (let i = 0; i < myMoves; i++) history.push(mine, theirs);
    return history;
  };

  it('lets the next moves pass before stopping again for a mistake', () => {
    expect(watchSpacingAllows({ history: upTo(1), lastStopPly: 4, severity: 'mistake' })).toBe(false);
    expect(watchSpacingAllows({ history: upTo(QUIET_TURNS), lastStopPly: 4, severity: 'mistake' })).toBe(false);
    expect(watchSpacingAllows({ history: upTo(QUIET_TURNS + 1), lastStopPly: 4, severity: 'mistake' })).toBe(true);
  });

  it('always stops for a blunder, and for the first mistake of a game', () => {
    expect(watchSpacingAllows({ history: upTo(1), lastStopPly: 4, severity: 'blunder' })).toBe(true);
    expect(watchSpacingAllows({ history: upTo(0), lastStopPly: undefined, severity: 'mistake' })).toBe(true);
  });

  it('counts only the player’s own moves, not the computer’s or cube decisions', () => {
    const history = [...upTo(1), cube, theirs, cube, theirs];
    expect(watchSpacingAllows({ history, lastStopPly: 4, severity: 'mistake' })).toBe(false);
  });
});
