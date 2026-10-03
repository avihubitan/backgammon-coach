import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { chooseAiPlay, createGame, currentLegalMoves, gameReducer, getLegalPlays, type GameState } from '@/game';
import { crashReporter } from '@/services/crash';
import { useGameStore } from '@/state/gameStore';

import { useGameController } from '../useGameController';

jest.mock('@/game', () => {
  const actual = jest.requireActual('@/game');
  return { ...actual, chooseAiPlay: jest.fn(actual.chooseAiPlay) };
});

function Game() {
  useGameController();
  return null;
}

/** The computer won the opening roll with 6-1 and it's its move. */
function computerToPlay(): GameState {
  return gameReducer(createGame({ cubeEnabled: false }), { type: 'opening-roll', dice: [1, 6] });
}

/** Opens the game screen on `state` and lets the computer play for a while. */
function playFrom(state: GameState): GameState {
  useGameStore.getState().startGame({ level: 'beginner', cubeEnabled: false, matchLength: 1 });
  useGameStore.getState().updateState(state);
  let screen!: ReactTestRenderer;
  act(() => {
    screen = create(<Game />);
  });
  for (let tick = 0; tick < 20; tick++) act(() => jest.advanceTimersByTime(500));
  act(() => screen.unmount());
  return useGameStore.getState().active!.state!;
}

/** The computer finished its turn with a whole, legal play of its roll. */
function expectComputerPlayedLegally(before: GameState, after: GameState) {
  expect(after.currentPlayer).toBe('player1');
  expect(after.history).toHaveLength(before.history.length + 1);
  const plays = getLegalPlays(before.turn!.startBoard, 'player2', before.turn!.roll!);
  expect(plays.some((play) => JSON.stringify(play.board) === JSON.stringify(after.board))).toBe(true);
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0.5);
  jest.spyOn(crashReporter, 'captureException').mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  useGameStore.getState().resetGames();
});

describe('a game left partway through the computer’s turn', () => {
  // Leaving the game screen (or the app being closed) loses the computer's
  // plan for the turn; its saved moves stay. Planning the whole roll again
  // from there played a die twice: the engine threw inside a timer, which
  // crashes a release build, and the game could never go on.
  it.each([6, 1])('goes on when reopened after the computer played its %i', (die) => {
    const start = computerToPlay();
    const move = currentLegalMoves(start).find((candidate) => candidate.die === die)!;
    const saved = gameReducer(start, { type: 'move', move });

    const after = playFrom(saved);

    expectComputerPlayedLegally(start, after);
    expect(crashReporter.captureException).not.toHaveBeenCalled();
  });
});

describe('a planned move the rules refuse', () => {
  it('is reported, and a legal move is played instead', () => {
    const start = computerToPlay();
    jest.mocked(chooseAiPlay).mockReturnValueOnce({
      moves: [{ from: 'bar', to: 20, die: 6, hit: false }],
      board: start.board,
      key: 'impossible',
    } as unknown as ReturnType<typeof chooseAiPlay>);

    const after = playFrom(start);

    expectComputerPlayedLegally(start, after);
    expect(crashReporter.captureException).toHaveBeenCalled();
  });
});
