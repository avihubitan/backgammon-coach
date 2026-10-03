/**
 * How long the engine work that runs on the JavaScript thread takes: computer
 * moves, Coach Watch and hints, cube decisions, winning chances and whole-game
 * reviews, on positions from real games between the levels.
 *
 *   npx tsx scripts/benchmark-speed.ts [games]
 *
 * Node's V8 has a JIT; phones run Hermes, which interprets (no JIT), and slower
 * CPUs. Read the numbers as a floor, and see docs/DEVICE_TESTING.md for checks
 * on real phones.
 */
import { initialBoard, opponentOf } from '../src/game/board/board';
import { createRng, rollDice, type DiceRoll } from '../src/game/dice/dice';
import { chooseAiPlay, type AiLevel } from '../src/game/ai/bots';
import { loadDefaultNetwork } from '../src/game/ai/defaultNetwork';
import { installNetwork, rankByEquity, winChanceOnRoll } from '../src/game/ai/engine';
import { moveOutcome, reviewGame } from '../src/game/ai/analysis';
import { hasBorneOffAll } from '../src/game/rules/movement';
import { getLegalPlays } from '../src/game/rules/plays';
import type { TurnRecord } from '../src/game/engine/game';
import type { BoardState, Player } from '../src/game/types';

const GAMES = Number((typeof process !== 'undefined' && process.argv[2]) || 6);
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function stats(name: string, samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const pick = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  console.log(
    `${name.padEnd(34)} n=${String(samples.length).padStart(4)}  mean ${mean.toFixed(1).padStart(7)} ms  p50 ${pick(0.5).toFixed(1).padStart(7)}  p95 ${pick(0.95).toFixed(1).padStart(7)}  max ${sorted[sorted.length - 1].toFixed(1).padStart(7)}`,
  );
}

function time<T>(samples: number[], work: () => T): T {
  const start = now();
  const result = work();
  samples.push(now() - start);
  return result;
}

const startup: number[] = [];
const network = time(startup, () => loadDefaultNetwork());
installNetwork(network);
stats('load network (start-up)', startup);

const moves: Record<AiLevel, number[]> = { beginner: [], intermediate: [], advanced: [] };
const ranking: number[] = [];
const winChance: number[] = [];
const legalPlays: number[] = [];
const histories: TurnRecord[][] = [];
const positions: { board: BoardState; player: Player; roll: DiceRoll }[] = [];

const rng = createRng(7);
const levels: AiLevel[] = ['advanced', 'intermediate', 'beginner'];
for (let game = 0; game < GAMES; game++) {
  let board = initialBoard();
  let player: Player = 'player1';
  const history: TurnRecord[] = [];
  for (let ply = 0; ply < 400; ply++) {
    const roll = rollDice(rng);
    const level = levels[(game + (player === 'player1' ? 0 : 1)) % levels.length];
    time(legalPlays, () => getLegalPlays(board, player, roll));
    positions.push({ board, player, roll });
    const before = board;
    const chosen = time(moves[level], () => chooseAiPlay(board, player, roll, level, rng));
    history.push({ player, roll, boardBefore: before, moves: chosen.moves });
    board = chosen.board;
    if (hasBorneOffAll(board, player)) break;
    player = opponentOf(player);
  }
  histories.push(history);
}

// Coach Watch, hints and the strongest computer level all rank every play once.
for (const { board, player, roll } of positions) time(ranking, () => rankByEquity(board, player, roll));
// Cube decisions and "winning chances" look at all 21 rolls.
for (const { board, player } of positions.filter((_, index) => index % 4 === 0)) {
  time(winChance, () => winChanceOnRoll(board, player));
}

const reviews: number[] = [];
const outcomes: number[] = [];
for (const history of histories) {
  const review = time(reviews, () => reviewGame(history, 'player1'));
  for (const move of review.moves.slice(0, 8)) time(outcomes, () => moveOutcome(move));
}

stats('legal plays', legalPlays);
for (const level of levels) stats(`computer move (${level})`, moves[level]);
stats('rank all plays (watch, hint)', ranking);
stats('win chance on roll (cube)', winChance);
stats('move outcome (review screen)', outcomes);
stats('review a whole game', reviews);
