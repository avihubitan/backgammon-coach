import {
  createGame,
  createGameFromPosition,
  currentLegalMoves,
  gameReducer,
  initialBoard,
  type GameState,
} from '@/game';

import { gameStatus, type StatusInput } from '../gameStatus';

const input = (state: GameState, extra: Partial<StatusInput> = {}): StatusInput => ({
  state,
  message: null,
  messageTone: 'info',
  lastAiPlay: null,
  opponentName: 'Niko',
  showHowTo: false,
  ...extra,
});

const yourRoll = (dice: [1 | 2 | 3 | 4 | 5 | 6, 1 | 2 | 3 | 4 | 5 | 6], board = initialBoard()) =>
  gameReducer(createGameFromPosition(board, 'player1', { cubeEnabled: false }), { type: 'roll', dice });

describe('the status line', () => {
  it('stays quiet for a regular player in the middle of a turn', () => {
    expect(gameStatus(input(yourRoll([6, 1])))).toBeNull();
  });

  it('explains moving to new players, and how to confirm once the move is made', () => {
    const rolled = yourRoll([6, 1]);
    expect(gameStatus(input(rolled, { showHowTo: true }))?.text).toMatch(/Drag a checker/);
    let done = rolled;
    for (let i = 0; i < 2; i++) done = gameReducer(done, { type: 'move', move: currentLegalMoves(done)[0] });
    expect(gameStatus(input(done, { showHowTo: true }))?.text).toMatch(/Tap Done/);
    expect(gameStatus(input(done))).toBeNull();
  });

  it('always says what a rule demands right now', () => {
    const board = initialBoard();
    const onBar = { ...board, points: board.points.slice(), bar: { ...board.bar, player1: 1 } };
    onBar.points[6] -= 1;
    expect(gameStatus(input(yourRoll([6, 1], onBar)))).toEqual({
      text: 'You’re on the bar: come back in on Niko’s side first.',
      tone: 'info',
    });
  });

  it('spells out doubles until the first of the four moves', () => {
    const doubles = yourRoll([3, 3]);
    expect(gameStatus(input(doubles))).toEqual({ text: 'Doubles! You play four 3s.', tone: 'info' });
    const moved = gameReducer(doubles, { type: 'move', move: currentLegalMoves(doubles)[0] });
    expect(gameStatus(input(moved))).toBeNull();
  });

  it('shows what the opponent just played until the player rolls, and nothing during its turn', () => {
    const waiting = createGameFromPosition(initialBoard(), 'player1', { cubeEnabled: false });
    expect(gameStatus(input(waiting, { lastAiPlay: { text: 'Niko played 13/7 8/7.' } }))?.text).toBe('Niko played 13/7 8/7.');
    const theirs = createGameFromPosition(initialBoard(), 'player2', { cubeEnabled: false });
    expect(gameStatus(input(theirs))).toBeNull();
  });

  it('lets a message speak first, in its own tone', () => {
    expect(gameStatus(input(yourRoll([6, 1]), { message: 'That checker can’t land there.', messageTone: 'warning' }))).toEqual({
      text: 'That checker can’t land there.',
      tone: 'warning',
    });
  });

  it('names the opponent for the cube and the opening', () => {
    const offered: GameState = { ...createGame(), phase: 'doubling', doubleOfferedBy: 'player2' };
    expect(gameStatus(input(offered))?.text).toBe('Niko doubles to 2. Take or drop?');
    expect(gameStatus(input(createGame()))?.text).toBe('Roll to see who goes first.');
  });
});
