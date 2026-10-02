import {
  aiShouldDouble,
  aiShouldTake,
  chooseAiPlay,
  createBoard,
  createRng,
  exposure,
  formatPlay,
  getLegalPlays,
  hasBorneOffAll,
  initialBoard,
  installNetwork,
  opponentOf,
  rollDice,
  type AiLevel,
  type BoardState,
  type Player,
} from '../index';
import { samplePositions } from './helpers';

beforeAll(() => installNetwork(null));

describe('shot counting', () => {
  // player2 attacks from its 1-point (absolute 1) toward higher numbers.
  const shotsAt = (distance: number, extra: Record<number, number> = {}) =>
    exposure(createBoard({ player2: { 1: 1 }, player1: { [1 + distance]: 1, ...extra } }), 'player1').hittingRolls;

  it.each([
    [1, 11],
    [2, 12],
    [3, 14],
    [4, 15],
    [5, 15],
    [6, 17],
    [7, 6],
    [8, 6],
    [9, 5],
    [10, 3],
    [11, 2],
    [12, 3],
  ])('a blot %i pips away is hit by %i rolls', (distance, rolls) => {
    expect(shotsAt(distance)).toBe(rolls);
  });

  it('accounts for blocked intermediate points', () => {
    // With point 4 made, 3-3 can no longer reach 6 pips away.
    expect(shotsAt(6, { 4: 2 })).toBe(16);
  });

  it('reports no risk without blots', () => {
    expect(exposure(initialBoard(), 'player1').probability).toBe(0);
  });

  it('weights the pips a hit would cost', () => {
    const deep = exposure(createBoard({ player2: { 1: 1 }, player1: { 3: 1 } }), 'player1');
    const back = exposure(createBoard({ player2: { 18: 1 }, player1: { 20: 1 } }), 'player1');
    expect(deep.probability).toBeCloseTo(back.probability);
    expect(deep.expectedPipLoss).toBeGreaterThan(back.expectedPipLoss * 3);
  });
});

describe('computer moves', () => {
  const levels: AiLevel[] = ['beginner', 'intermediate', 'advanced'];
  const samples = samplePositions(12, 5);

  it.each(levels)('%s always plays a legal move', (level) => {
    const rng = createRng(1);
    for (const { board, player, roll } of samples) {
      const keys = new Set(getLegalPlays(board, player, roll).map((play) => play.key));
      expect(keys.has(chooseAiPlay(board, player, roll, level, rng).key)).toBe(true);
    }
  });

  it('uses standard opening moves', () => {
    const play = chooseAiPlay(initialBoard(), 'player1', [3, 1], 'intermediate', createRng(1));
    expect(formatPlay('player1', play.moves)).toBe('8/5 6/5');
    const reply = chooseAiPlay(initialBoard(), 'player2', [6, 5], 'advanced', createRng(1));
    expect(formatPlay('player2', reply.moves)).toBe('24/13');
  });

  it('makes the obvious point-making play without the book', () => {
    // 4-2 makes the 4-point here too, from a non-opening position.
    const board = createBoard({
      player1: { 24: 2, 13: 4, 8: 3, 6: 5, 10: 1 },
      player2: { 1: 2, 12: 5, 17: 3, 19: 5 },
    });
    const play = chooseAiPlay(board, 'player1', [4, 2], 'intermediate', createRng(3));
    expect(formatPlay('player1', play.moves)).toBe('8/4 6/4');
  });
});

describe('cube decisions', () => {
  const crushing: BoardState = createBoard({
    player1: { 1: 2 },
    player2: { 22: 15 },
    off: { player1: 13 },
  });

  it('drops when the game is hopeless and takes at the start', () => {
    expect(aiShouldTake(crushing, 'player1', 'intermediate')).toBe(false);
    expect(aiShouldTake(initialBoard(), 'player1', 'intermediate')).toBe(true);
  });

  it('never doubles when the opponent owns the cube', () => {
    expect(aiShouldDouble(initialBoard(), 'player1', { value: 2, owner: 'player2' }, 'advanced')).toBe(false);
  });

  it('does not double in the opening position', () => {
    expect(aiShouldDouble(initialBoard(), 'player1', { value: 1, owner: null }, 'intermediate')).toBe(false);
  });
});

describe('strength', () => {
  function playMatch(a: AiLevel, b: AiLevel, games: number, seed: number): number {
    const rng = createRng(seed);
    let winsA = 0;
    for (let game = 0; game < games; game++) {
      const sideA: Player = game % 2 === 0 ? 'player1' : 'player2';
      let board = initialBoard();
      let player: Player = rng() < 0.5 ? 'player1' : 'player2';
      for (let ply = 0; ply < 500; ply++) {
        const level = player === sideA ? a : b;
        board = chooseAiPlay(board, player, rollDice(rng), level, rng).board;
        if (hasBorneOffAll(board, player)) {
          if (player === sideA) winsA += 1;
          break;
        }
        player = opponentOf(player);
      }
    }
    return winsA / games;
  }

  it('intermediate beats beginner more often than not', () => {
    expect(playMatch('intermediate', 'beginner', 60, 42)).toBeGreaterThan(0.5);
  });
});
