/**
 * Plays AI levels against each other with and without the trained network,
 * and measures how the coach grades a learner-like player.
 *
 *   npx tsx scripts/benchmark-ai.ts [games]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { initialBoard, opponentOf } from '../src/game/board/board';
import { createRng, rollDice, type Rng } from '../src/game/dice/dice';
import { chooseAiPlay, type AiLevel } from '../src/game/ai/bots';
import { installNetwork } from '../src/game/ai/engine';
import { deserializeNetwork, type Network, type SerializedNetwork } from '../src/game/ai/network';
import { reviewGame } from '../src/game/ai/analysis';
import { hasBorneOffAll } from '../src/game/rules/movement';
import { winTypeFor } from '../src/game/rules/outcome';
import { getLegalPlays } from '../src/game/rules/plays';
import type { TurnRecord } from '../src/game/engine/game';
import type { BoardState, Player } from '../src/game/types';

const GAMES = Number(process.argv[2] ?? 300);
const net: Network = deserializeNetwork(
  JSON.parse(readFileSync(join(__dirname, '../src/game/ai/weights/network.json'), 'utf8')) as SerializedNetwork,
);

interface Side {
  level: AiLevel;
  network: boolean;
}

function playGame(sides: Record<Player, Side>, rng: Rng, record?: TurnRecord[]): { winner: Player; points: number } {
  let board: BoardState = initialBoard();
  let player: Player = rng() < 0.5 ? 'player1' : 'player2';
  for (let ply = 0; ply < 1000; ply++) {
    const roll = rollDice(rng);
    const side = sides[player];
    installNetwork(side.network ? net : null);
    const plays = getLegalPlays(board, player, roll);
    const before = board;
    if (plays.length > 0) {
      const chosen = chooseAiPlay(board, player, roll, side.level, rng);
      board = chosen.board;
      record?.push({ player, roll, boardBefore: before, moves: chosen.moves });
    } else {
      record?.push({ player, roll, boardBefore: before, moves: [] });
    }
    if (hasBorneOffAll(board, player)) {
      const type = winTypeFor(board, player);
      return { winner: player, points: type === 'backgammon' ? 3 : type === 'gammon' ? 2 : 1 };
    }
    player = opponentOf(player);
  }
  return { winner: 'player1', points: 0 };
}

function match(name: string, a: Side, b: Side, games: number, seed: number) {
  const rng = createRng(seed);
  let wins = 0;
  let points = 0;
  const started = Date.now();
  for (let i = 0; i < games; i++) {
    // Alternate seats so neither side always plays player1.
    const flip = i % 2 === 1;
    const sides = flip ? { player1: b, player2: a } : { player1: a, player2: b };
    const result = playGame(sides, rng);
    const aWon = (result.winner === 'player1') !== flip;
    if (aWon) wins++;
    points += aWon ? result.points : -result.points;
  }
  console.log(
    `${name.padEnd(44)} A wins ${((100 * wins) / games).toFixed(1)}%  ppg ${(points / games).toFixed(3)}  (${((Date.now() - started) / 1000).toFixed(0)}s)`,
  );
}

const H = (level: AiLevel): Side => ({ level, network: false });
const N = (level: AiLevel): Side => ({ level, network: true });

// The level ladder as shipped (the network is installed in the app).
match('intermediate vs beginner', N('intermediate'), N('beginner'), GAMES, 1);
match('advanced vs intermediate', N('advanced'), N('intermediate'), GAMES, 2);
match('advanced vs beginner', N('advanced'), N('beginner'), GAMES, 3);
// The network level against the old heuristic 2-ply search it replaces.
match('advanced (network) vs advanced (heuristic 2-ply)', N('advanced'), H('advanced'), Math.round(GAMES / 4), 4);

// How does the coach grade a learner-like (beginner level) player?
for (const useNet of [false, true]) {
  const counts: Record<string, number> = {};
  let total = 0;
  const rng = createRng(99);
  for (let g = 0; g < 20; g++) {
    const record: TurnRecord[] = [];
    playGame({ player1: H('beginner'), player2: H('intermediate') }, rng, record);
    installNetwork(useNet ? net : null);
    const review = reviewGame(record, 'player1');
    for (const move of review.moves) {
      counts[move.severity] = (counts[move.severity] ?? 0) + 1;
      total++;
    }
  }
  const share = Object.entries(counts)
    .sort()
    .map(([k, v]) => `${k} ${((100 * v) / total).toFixed(0)}%`)
    .join('  ');
  console.log(`coach on beginner-level moves (${useNet ? 'network' : 'heuristic'}): ${share}`);
}
