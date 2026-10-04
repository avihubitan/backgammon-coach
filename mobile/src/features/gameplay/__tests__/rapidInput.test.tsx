import { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { createGameFromPosition, gameReducer, initialBoard, type GameState } from '@/game';
import { crashReporter } from '@/services/crash';
import { useGameStore } from '@/state/gameStore';
import { useSettingsStore } from '@/state/settingsStore';

import { useGameController, type GameController } from '../useGameController';

// Expo's native UUID isn't available under Jest.
jest.mock('@/utils/id', () => ({ newId: () => 'rapid-game' }));

// The controller as of the last render.
const latest: { current: GameController | null } = { current: null };
function Game() {
  const controller = useGameController();
  useEffect(() => {
    latest.current = controller;
  });
  return null;
}
const game = () => latest.current!;

let screen: ReactTestRenderer | null = null;

/** Opens the game screen with the player to move `dice` from the starting position. */
function open(dice: [1 | 2 | 3 | 4 | 5 | 6, 1 | 2 | 3 | 4 | 5 | 6]) {
  const ready = createGameFromPosition(initialBoard(), 'player1', { cubeEnabled: false });
  useGameStore.getState().startGame({ level: 'beginner', cubeEnabled: false, matchLength: 1 });
  useGameStore.getState().updateState(gameReducer(ready, { type: 'roll', dice }));
  act(() => {
    screen = create(<Game />);
  });
}

const stored = (): GameState => useGameStore.getState().active!.state!;

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0.5);
  jest.spyOn(crashReporter, 'captureException').mockImplementation(() => {});
  useSettingsStore.setState({ coachWatch: false });
});
afterEach(() => {
  act(() => screen?.unmount());
  screen = null;
  jest.useRealTimers();
  jest.restoreAllMocks();
  useGameStore.getState().resetGames();
});

describe('fast hands', () => {
  // A checker sent two dice away moves one hop at a time; the later hops wait
  // on timers. Resigning in between used to leave a hop that the engine
  // refused with a throw inside a timer: a crash in a release build.
  it('stops a multi-step move cleanly when the game ends between its hops', () => {
    open([3, 1]);
    act(() => game().tap(8));
    act(() => game().tap(4));
    expect(stored().turn!.moves).toHaveLength(1);
    act(() => game().resign());
    expect(() => act(() => jest.advanceTimersByTime(2000))).not.toThrow();
    expect(stored().phase).toBe('finished');
    expect(stored().board.points[4]).toBe(0);
    expect(crashReporter.captureException).not.toHaveBeenCalled();
  });

  it('ignores taps, drags and undo while a multi-step move is still landing', () => {
    open([3, 1]);
    act(() => game().tap(8));
    act(() => game().tap(4));
    const midway = stored();
    act(() => game().tap(13));
    act(() => game().tap(24, { dragged: true }));
    act(() => game().undo());
    expect(stored()).toBe(midway);
    act(() => jest.advanceTimersByTime(1000));
    expect(stored().turn!.moves.map((move) => `${move.from}/${move.to}`)).toEqual(['8/7', '7/4']);
    expect(game().busy).toBe(false);
  });

  it('rolls once for a double tap on Roll', () => {
    open([3, 1]);
    // Back to the start of the player's next turn: their roll.
    act(() => game().tap(8));
    act(() => game().tap(5));
    act(() => game().tap(6));
    act(() => game().tap(5));
    act(() => game().endTurn());
    for (let tick = 0; tick < 20 && stored().currentPlayer !== 'player1'; tick++) act(() => jest.advanceTimersByTime(500));
    expect(stored()).toMatchObject({ currentPlayer: 'player1', phase: 'rolling' });
    const turns = stored().history.length;
    act(() => {
      game().roll();
      game().roll();
    });
    expect(stored().phase).toBe('moving');
    expect(stored().history).toHaveLength(turns);
    expect(crashReporter.captureException).not.toHaveBeenCalled();
  });

  it('ends the turn once for a double tap on Done', () => {
    open([3, 1]);
    act(() => game().tap(8));
    act(() => game().tap(5));
    act(() => game().tap(6));
    act(() => game().tap(5));
    const turns = stored().history.length;
    act(() => {
      game().endTurn();
      game().endTurn();
    });
    expect(stored().currentPlayer).toBe('player2');
    expect(stored().history).toHaveLength(turns + 1);
    expect(crashReporter.captureException).not.toHaveBeenCalled();
  });
});
