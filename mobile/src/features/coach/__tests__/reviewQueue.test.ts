import type { FinishedGame } from '@/features/gameplay/gameModel';
import {
  chooseAiPlay,
  createRng,
  getLegalPlays,
  hasBorneOffAll,
  initialBoard,
  installNetwork,
  opponentOf,
  rollDice,
  type BoardState,
  type Player,
  type TurnRecord,
} from '@/game';
import { useGameStore } from '@/state/gameStore';
import { useMistakesStore } from '@/state/mistakesStore';

import { reviewPendingGames } from '../reviewQueue';

beforeAll(() => installNetwork(null));

/** A whole game between two beginner-level bots, as the app records it. */
function playedHistory(seed: number): { history: TurnRecord[]; winner: Player } {
  const rng = createRng(seed);
  let board: BoardState = initialBoard();
  let player: Player = 'player1';
  const history: TurnRecord[] = [];
  for (let ply = 0; ply < 600; ply++) {
    const roll = rollDice(rng);
    const before = board;
    const moves = getLegalPlays(board, player, roll).length > 0 ? chooseAiPlay(board, player, roll, 'beginner', rng) : null;
    if (moves) board = moves.board;
    history.push({ player, roll, boardBefore: before, moves: moves?.moves ?? [] });
    if (hasBorneOffAll(board, player)) return { history, winner: player };
    player = opponentOf(player);
  }
  throw new Error('Game did not finish');
}

function finished(id: string, seed: number): FinishedGame {
  const { history, winner } = playedHistory(seed);
  return {
    id,
    level: 'beginner',
    startedAt: '2026-03-01T10:00:00.000Z',
    finishedAt: `2026-03-01T10:${String(seed).padStart(2, '0')}:00.000Z`,
    result: { winner, type: 'single', cubeValue: 1, points: 1, reason: 'bore-off' },
    playerWon: winner === 'player1',
    history,
    matchLength: 1,
  };
}

beforeEach(() => {
  useGameStore.setState({ finished: [] });
  useMistakesStore.getState().reset();
});

describe('background reviews', () => {
  it('reviews every finished game and saves its mistakes for practice', async () => {
    useGameStore.setState({ finished: [finished('a', 3), finished('b', 2), finished('c', 1)] });

    expect(await reviewPendingGames({ gapMs: 0 })).toBe(3);

    const games = useGameStore.getState().finished;
    expect(games.every((game) => game.review && game.review.summary.movesReviewed > 0)).toBe(true);
    const flagged = games.reduce((sum, game) => sum + game.review!.summary.mistakes + game.review!.summary.blunders, 0);
    expect(useMistakesStore.getState().mistakes).toHaveLength(flagged);

    // Nothing left to do the second time.
    expect(await reviewPendingGames({ gapMs: 0 })).toBe(0);
    expect(useMistakesStore.getState().mistakes).toHaveLength(flagged);
  });

  it('reviews newest games first, up to a limit per run', async () => {
    useGameStore.setState({ finished: [finished('new', 2), finished('old', 1)] });
    expect(await reviewPendingGames({ gapMs: 0, max: 1 })).toBe(1);
    const [newest, oldest] = useGameStore.getState().finished;
    expect(newest.review).toBeDefined();
    expect(oldest.review).toBeUndefined();
  });

  it('runs one queue at a time', async () => {
    useGameStore.setState({ finished: [finished('a', 1), finished('b', 2)] });
    const [first, second] = await Promise.all([reviewPendingGames({ gapMs: 0 }), reviewPendingGames({ gapMs: 0 })]);
    expect(first).toBe(2);
    expect(second).toBe(0);
  });

  it('does not miss a game that finishes while a run is going', async () => {
    useGameStore.setState({ finished: [finished('first', 1)] });
    const running = reviewPendingGames({ gapMs: 0, max: 1 });
    // A new game ends and asks for its review while the first run is busy.
    useGameStore.setState({ finished: [finished('second', 2), ...useGameStore.getState().finished] });
    expect(await reviewPendingGames({ gapMs: 0 })).toBe(0);
    expect(await running).toBe(2);
    expect(useGameStore.getState().finished.every((game) => game.review)).toBe(true);
  });

  it('skips a game it cannot review instead of getting stuck on it', async () => {
    const broken: FinishedGame = {
      ...finished('broken', 4),
      history: [{ player: 'player1', roll: [3, 1], boardBefore: undefined as unknown as BoardState, moves: [] }],
    };
    useGameStore.setState({ finished: [broken, finished('fine', 5)] });
    expect(await reviewPendingGames({ gapMs: 0 })).toBe(1);
    const games = useGameStore.getState().finished;
    expect(games.find((game) => game.id === 'broken')!.review).toBeUndefined();
    expect(games.find((game) => game.id === 'fine')!.review).toBeDefined();
    // And it stays skipped.
    expect(await reviewPendingGames({ gapMs: 0 })).toBe(0);
  });
});
