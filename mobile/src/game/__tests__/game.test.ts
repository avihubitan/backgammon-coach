import {
  applyActions,
  canDouble,
  canEndTurn,
  checkersAt,
  createBoard,
  createGame,
  createGameFromPosition,
  createRng,
  currentLegalMoves,
  gameReducer,
  GameRuleError,
  initialBoard,
  rollDice,
  totalCheckers,
  winTypeFor,
  type GameState,
} from '../index';

describe('opening roll', () => {
  it('re-rolls ties', () => {
    const game = gameReducer(createGame(), { type: 'opening-roll', dice: [4, 4] });
    expect(game.phase).toBe('opening');
    expect(game.openingTies).toEqual([4]);
  });

  it('lets the higher die start and play both numbers', () => {
    const game = gameReducer(createGame(), { type: 'opening-roll', dice: [2, 5] });
    expect(game.currentPlayer).toBe('player2');
    expect(game.phase).toBe('moving');
    expect(game.turn?.roll).toEqual([2, 5]);
    expect(game.turn?.requiredMoves).toBe(2);
  });

  it('cannot happen twice', () => {
    const game = gameReducer(createGame(), { type: 'opening-roll', dice: [6, 1] });
    expect(() => gameReducer(game, { type: 'opening-roll', dice: [6, 1] })).toThrow(GameRuleError);
  });
});

describe('turn flow', () => {
  const opened = gameReducer(createGame(), { type: 'opening-roll', dice: [3, 1] });

  it('does not end the turn until the dice are used', () => {
    expect(canEndTurn(opened)).toBe(false);
    expect(() => gameReducer(opened, { type: 'end-turn' })).toThrow(GameRuleError);
  });

  it('plays a full turn and passes to the opponent', () => {
    const game = applyActions(opened, [
      { type: 'move', move: { from: 8, to: 5, die: 3 } },
      { type: 'move', move: { from: 6, to: 5, die: 1 } },
      { type: 'end-turn' },
    ]);
    expect(checkersAt(game.board, 5, 'player1')).toBe(2);
    expect(game.currentPlayer).toBe('player2');
    expect(game.phase).toBe('rolling');
    expect(game.history).toHaveLength(1);
    expect(game.history[0].moves).toHaveLength(2);
  });

  it('rejects illegal moves', () => {
    expect(() =>
      gameReducer(opened, { type: 'move', move: { from: 24, to: 19, die: 5 } }),
    ).toThrow(GameRuleError);
  });

  it('can undo a move', () => {
    const moved = gameReducer(opened, { type: 'move', move: { from: 8, to: 5, die: 3 } });
    const undone = gameReducer(moved, { type: 'undo' });
    expect(undone.board).toEqual(initialBoard());
  });

  it('cannot roll while moving', () => {
    expect(() => gameReducer(opened, { type: 'roll', dice: [1, 2] })).toThrow(GameRuleError);
  });

  it('allows ending a turn with no legal moves', () => {
    const board = createBoard({ player1: { 13: 2 }, player2: { 19: 2, 20: 2, 1: 1 }, bar: { player1: 1 } });
    const game = gameReducer(createGameFromPosition(board, 'player1'), { type: 'roll', dice: [6, 5] });
    expect(currentLegalMoves(game)).toEqual([]);
    expect(canEndTurn(game)).toBe(true);
    expect(gameReducer(game, { type: 'end-turn' }).currentPlayer).toBe('player2');
  });
});

describe('hitting and re-entering', () => {
  it('sends a hit checker to the bar and forces it to enter', () => {
    const board = createBoard({ player1: { 13: 2, 6: 2 }, player2: { 10: 1, 19: 2 } });
    let game = createGameFromPosition(board, 'player1');
    game = applyActions(game, [
      { type: 'roll', dice: [3, 2] },
      { type: 'move', move: { from: 13, to: 10, die: 3 } },
      { type: 'move', move: { from: 6, to: 4, die: 2 } },
      { type: 'end-turn' },
      { type: 'roll', dice: [4, 1] },
    ]);
    expect(game.board.bar.player2).toBe(1);
    expect(currentLegalMoves(game).every((move) => move.from === 'bar')).toBe(true);
  });
});

describe('winning', () => {
  function bearOffLast(board = createBoard({ player1: { 1: 1 }, player2: { 20: 2 }, off: { player1: 14, player2: 13 } })) {
    return applyActions(createGameFromPosition(board, 'player1'), [
      { type: 'roll', dice: [2, 1] },
      { type: 'move', move: { from: 1, to: 'off', die: 2 } },
    ]);
  }

  it('ends the game the moment the last checker is borne off', () => {
    const game = bearOffLast();
    expect(game.phase).toBe('finished');
    expect(game.result).toMatchObject({ winner: 'player1', type: 'single', points: 1, reason: 'bore-off' });
    expect(game.history).toHaveLength(1);
  });

  it('scores a gammon when the loser has borne off nothing', () => {
    const game = bearOffLast(createBoard({ player1: { 1: 1 }, player2: { 20: 15 }, off: { player1: 14 } }));
    expect(game.result).toMatchObject({ type: 'gammon', points: 2 });
  });

  it('scores a backgammon when the loser is still in the winner home board', () => {
    const game = bearOffLast(createBoard({ player1: { 1: 1 }, player2: { 20: 14, 3: 1 }, off: { player1: 14 } }));
    expect(game.result).toMatchObject({ type: 'backgammon', points: 3 });
  });

  it('scores a backgammon when the loser has a checker on the bar', () => {
    const board = createBoard({ player2: { 20: 14 }, bar: { player2: 1 } });
    expect(winTypeFor(board, 'player1')).toBe('backgammon');
  });

  it('applies the Jacoby rule only when enabled', () => {
    const board = createBoard({ player1: { 1: 1 }, player2: { 20: 15 }, off: { player1: 14 } });
    const game = applyActions(createGameFromPosition(board, 'player1', { jacoby: true }), [
      { type: 'roll', dice: [2, 1] },
      { type: 'move', move: { from: 1, to: 'off', die: 2 } },
    ]);
    expect(game.result).toMatchObject({ type: 'single', points: 1 });
  });

  it('records resignations', () => {
    const game = gameReducer(createGameFromPosition(initialBoard(), 'player1'), {
      type: 'resign',
      player: 'player1',
      winType: 'gammon',
    });
    expect(game.result).toMatchObject({ winner: 'player2', type: 'gammon', points: 2, reason: 'resigned' });
  });
});

describe('the doubling cube', () => {
  const start = createGameFromPosition(initialBoard(), 'player1');

  it('allows either player to double from the center before rolling', () => {
    expect(canDouble(start)).toBe(true);
    const offered = gameReducer(start, { type: 'double' });
    expect(offered.phase).toBe('doubling');
    expect(offered.doubleOfferedBy).toBe('player1');
  });

  it('take: doubles the stakes and gives the taker the cube', () => {
    const taken = applyActions(start, [{ type: 'double' }, { type: 'take' }]);
    expect(taken.cube).toEqual({ value: 2, owner: 'player2' });
    expect(taken.phase).toBe('rolling');
    expect(taken.currentPlayer).toBe('player1');
    // player1 no longer owns the cube, so cannot redouble.
    expect(canDouble(taken)).toBe(false);
  });

  it('drop: ends the game at the current stake', () => {
    const dropped = applyActions(start, [{ type: 'double' }, { type: 'drop' }]);
    expect(dropped.phase).toBe('finished');
    expect(dropped.result).toMatchObject({ winner: 'player1', points: 1, reason: 'dropped-double' });
  });

  it('lets the cube owner redouble later', () => {
    let game = applyActions(start, [{ type: 'double' }, { type: 'take' }]);
    game = applyActions(game, [{ type: 'roll', dice: [3, 1] }]);
    game = applyActions(game, [
      { type: 'move', move: { from: 8, to: 5, die: 3 } },
      { type: 'move', move: { from: 6, to: 5, die: 1 } },
      { type: 'end-turn' },
    ]);
    expect(game.currentPlayer).toBe('player2');
    expect(canDouble(game)).toBe(true);
    game = applyActions(game, [{ type: 'double' }, { type: 'take' }]);
    expect(game.cube).toEqual({ value: 4, owner: 'player1' });
  });

  it('cannot double after rolling', () => {
    const rolled = gameReducer(start, { type: 'roll', dice: [3, 1] });
    expect(canDouble(rolled)).toBe(false);
    expect(() => gameReducer(rolled, { type: 'double' })).toThrow(GameRuleError);
  });

  it('cannot double in the Crawford game or when the cube is disabled', () => {
    expect(canDouble(createGameFromPosition(initialBoard(), 'player1', { crawford: true }))).toBe(false);
    expect(canDouble(createGameFromPosition(initialBoard(), 'player1', { cubeEnabled: false }))).toBe(false);
  });

  it('multiplies gammons by the cube value', () => {
    const board = createBoard({ player1: { 1: 1 }, player2: { 20: 15 }, off: { player1: 14 } });
    const game = applyActions(createGameFromPosition(board, 'player1'), [
      { type: 'double' },
      { type: 'take' },
      { type: 'roll', dice: [2, 1] },
      { type: 'move', move: { from: 1, to: 'off', die: 2 } },
    ]);
    expect(game.result).toMatchObject({ type: 'gammon', cubeValue: 2, points: 4 });
  });
});

describe('random games', () => {
  function playRandomGame(seed: number): GameState {
    const rng = createRng(seed);
    let game = createGame({ cubeEnabled: false });
    while (game.phase === 'opening') game = gameReducer(game, { type: 'opening-roll', dice: rollDice(rng) });
    for (let step = 0; step < 5000 && game.phase !== 'finished'; step++) {
      if (game.phase === 'rolling') {
        game = gameReducer(game, { type: 'roll', dice: rollDice(rng) });
        continue;
      }
      const moves = currentLegalMoves(game);
      if (moves.length === 0) {
        game = gameReducer(game, { type: 'end-turn' });
        continue;
      }
      game = gameReducer(game, { type: 'move', move: moves[Math.floor(rng() * moves.length)] });
      for (const player of ['player1', 'player2'] as const) {
        expect(totalCheckers(game.board, player)).toBe(15);
      }
      for (let point = 1; point <= 24; point++) {
        expect(checkersAt(game.board, point, 'player1') > 0 && checkersAt(game.board, point, 'player2') > 0).toBe(false);
      }
    }
    return game;
  }

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('game with seed %i always finishes with a valid result', (seed) => {
    const game = playRandomGame(seed);
    expect(game.phase).toBe('finished');
    expect(game.result).not.toBeNull();
    expect(game.board.off[game.result!.winner]).toBe(15);
  });
});
