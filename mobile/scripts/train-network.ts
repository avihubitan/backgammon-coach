/**
 * Trains the backgammon evaluation network by self-play with TD(lambda),
 * in the spirit of Tesauro's TD-Gammon.
 *
 *   npx tsx scripts/train-network.ts --games 200000 --hidden 64 --out src/game/ai/weights/network.json
 *
 * Every checkpoint the network plays a benchmark match against the
 * hand-written heuristic bot so progress is measurable.
 */
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { initialBoard, opponentOf } from '../src/game/board/board';
import { createRng, rollDice, type DiceRoll } from '../src/game/dice/dice';
import { hasBorneOffAll } from '../src/game/rules/movement';
import { winTypeFor } from '../src/game/rules/outcome';
import { getLegalPlays } from '../src/game/rules/plays';
import type { BoardState, Player } from '../src/game/types';
import { evaluatePosition } from '../src/game/ai/evaluate';
import {
  createNetwork,
  deserializeNetwork,
  encodeSparse,
  forwardSparse,
  INPUTS,
  OUTPUTS,
  serializeNetwork,
  type Network,
} from '../src/game/ai/network';

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);

const GAMES = Number(args.get('games') ?? 100000);
const HIDDEN = Number(args.get('hidden') ?? 64);
const OUT = args.get('out') ?? 'src/game/ai/weights/network.json';
const RESUME = args.get('resume');
const CHECKPOINT = Number(args.get('checkpoint') ?? 5000);
const BENCH_GAMES = Number(args.get('bench') ?? 300);
const LAMBDA = Number(args.get('lambda') ?? 0.7);
const ALPHA_START = Number(args.get('alpha') ?? 0.1);
const ALPHA_END = Number(args.get('alphaEnd') ?? 0.02);
const SEED = Number(args.get('seed') ?? 2026);

const rng = createRng(SEED);
const net: Network = RESUME && existsSync(RESUME)
  ? deserializeNetwork(JSON.parse(readFileSync(RESUME, 'utf8')))
  : createNetwork(HIDDEN, rng, 0.1);
const H = net.hidden;

const indices = new Int32Array(INPUTS);
const values = new Float32Array(INPUTS);
const hidden = new Float32Array(H);
const out = new Float32Array(OUTPUTS);

function equityOf(o: Float32Array): number {
  return 2 * o[0] - 1 + o[1] - o[2];
}

/** Picks the play with the best network equity for `player`. */
function bestPlayByNet(board: BoardState, player: Player, roll: DiceRoll): BoardState {
  const plays = getLegalPlays(board, player, roll);
  if (plays.length === 1) return plays[0].board;
  let best = plays[0].board;
  let bestEquity = -Infinity;
  for (const play of plays) {
    const nnz = encodeSparse(play.board, player, indices, values);
    forwardSparse(net, indices, values, nnz, hidden, out);
    const equity = equityOf(out);
    if (equity > bestEquity) {
      bestEquity = equity;
      best = play.board;
    }
  }
  return best;
}

function bestPlayByHeuristic(board: BoardState, player: Player, roll: DiceRoll): BoardState {
  let best = board;
  let bestValue = -Infinity;
  for (const play of getLegalPlays(board, player, roll)) {
    const value = evaluatePosition(play.board, player);
    if (value > bestValue) {
      bestValue = value;
      best = play.board;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Eligibility traces, one set per player (each player's own states form a TD chain).

const W1 = H * INPUTS;
interface Trace {
  e1: Float32Array; // OUTPUTS x W1
  eb1: Float32Array; // OUTPUTS x H
  e2: Float32Array; // OUTPUTS x H (only row k matters for output k)
  eb2: Float32Array; // OUTPUTS
  prev: Float32Array | null;
}
const newTrace = (): Trace => ({
  e1: new Float32Array(OUTPUTS * W1),
  eb1: new Float32Array(OUTPUTS * H),
  e2: new Float32Array(OUTPUTS * H),
  eb2: new Float32Array(OUTPUTS),
  prev: null,
});
const traces: Record<Player, Trace> = { player1: newTrace(), player2: newTrace() };

function resetTrace(trace: Trace) {
  trace.e1.fill(0);
  trace.eb1.fill(0);
  trace.e2.fill(0);
  trace.eb2.fill(0);
  trace.prev = null;
}

/** w += alpha * sum_k delta_k * e_k */
function applyDelta(trace: Trace, delta: Float32Array, alpha: number) {
  for (let k = 0; k < OUTPUTS; k++) {
    const step = alpha * delta[k];
    if (step === 0) continue;
    const e1 = k * W1;
    for (let i = 0; i < W1; i++) net.w1[i] += step * trace.e1[e1 + i];
    const eh = k * H;
    for (let j = 0; j < H; j++) {
      net.b1[j] += step * trace.eb1[eh + j];
      net.w2[eh + j] += step * trace.e2[eh + j];
    }
    net.b2[k] += step * trace.eb2[k];
  }
}

/** e = lambda * e + grad(y) at the position currently held in indices/values/hidden/out. */
function accumulateGradient(trace: Trace, nnz: number) {
  for (let k = 0; k < OUTPUTS; k++) {
    const dy = out[k] * (1 - out[k]);
    const e1 = k * W1;
    const eh = k * H;
    for (let i = 0; i < W1; i++) trace.e1[e1 + i] *= LAMBDA;
    for (let j = 0; j < H; j++) {
      trace.eb1[eh + j] *= LAMBDA;
      trace.e2[eh + j] = LAMBDA * trace.e2[eh + j] + dy * hidden[j];
      const back = dy * net.w2[eh + j] * hidden[j] * (1 - hidden[j]);
      trace.eb1[eh + j] += back;
      const row = e1 + j * INPUTS;
      for (let n = 0; n < nnz; n++) trace.e1[row + indices[n]] += back * values[n];
    }
    trace.eb2[k] = LAMBDA * trace.eb2[k] + dy;
  }
}

const delta = new Float32Array(OUTPUTS);

function visit(player: Player, board: BoardState, alpha: number) {
  const trace = traces[player];
  const nnz = encodeSparse(board, player, indices, values);
  forwardSparse(net, indices, values, nnz, hidden, out);
  if (trace.prev) {
    for (let k = 0; k < OUTPUTS; k++) delta[k] = out[k] - trace.prev[k];
    applyDelta(trace, delta, alpha);
    // Recompute activations with the updated weights before taking the gradient.
    forwardSparse(net, indices, values, nnz, hidden, out);
  }
  accumulateGradient(trace, nnz);
  trace.prev = Float32Array.from(out);
}

function finish(player: Player, target: [number, number, number], alpha: number) {
  const trace = traces[player];
  if (!trace.prev) return;
  for (let k = 0; k < OUTPUTS; k++) delta[k] = target[k] - trace.prev[k];
  applyDelta(trace, delta, alpha);
}

function openingRoll(): { starter: Player; roll: DiceRoll } {
  for (;;) {
    const [a, b] = rollDice(rng);
    if (a !== b) return { starter: a > b ? 'player1' : 'player2', roll: [a, b] };
  }
}

function trainGame(alpha: number): number {
  resetTrace(traces.player1);
  resetTrace(traces.player2);
  let board = initialBoard();
  let { starter: player, roll } = openingRoll();
  for (let ply = 0; ply < 2000; ply++) {
    board = bestPlayByNet(board, player, roll);
    if (hasBorneOffAll(board, player)) {
      const gammon = winTypeFor(board, player) !== 'single' ? 1 : 0;
      finish(player, [1, gammon, 0], alpha);
      finish(opponentOf(player), [0, 0, gammon], alpha);
      return ply;
    }
    visit(player, board, alpha);
    player = opponentOf(player);
    roll = rollDice(rng);
  }
  return 2000;
}

/** Network (greedy) vs heuristic bot; returns the network's share of points won. */
function benchmark(games: number): { winRate: number; pointShare: number } {
  const benchRng = createRng(99);
  let netPoints = 0;
  let total = 0;
  let netWins = 0;
  for (let g = 0; g < games; g++) {
    const netSide: Player = g % 2 === 0 ? 'player1' : 'player2';
    let board = initialBoard();
    let player: Player;
    let roll: DiceRoll;
    for (;;) {
      const [a, b] = rollDice(benchRng);
      if (a !== b) {
        player = a > b ? 'player1' : 'player2';
        roll = [a, b];
        break;
      }
    }
    for (let ply = 0; ply < 2000; ply++) {
      board = player === netSide ? bestPlayByNet(board, player, roll) : bestPlayByHeuristic(board, player, roll);
      if (hasBorneOffAll(board, player)) {
        const points = winTypeFor(board, player) === 'single' ? 1 : winTypeFor(board, player) === 'gammon' ? 2 : 3;
        total += points;
        if (player === netSide) {
          netWins += 1;
          netPoints += points;
        }
        break;
      }
      player = opponentOf(player);
      roll = rollDice(benchRng);
    }
  }
  return { winRate: netWins / games, pointShare: total ? netPoints / total : 0 };
}

function save(gamesDone: number, bench?: { winRate: number; pointShare: number }) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify(
      serializeNetwork(net, {
        trainedGames: gamesDone,
        hidden: H,
        lambda: LAMBDA,
        benchmarkVsHeuristic: bench,
        savedAt: new Date().toISOString(),
      }),
    ),
  );
}

const started = Date.now();
let plies = 0;
for (let game = 1; game <= GAMES; game++) {
  const alpha = ALPHA_START + (ALPHA_END - ALPHA_START) * (game / GAMES);
  plies += trainGame(alpha);
  if (game % CHECKPOINT === 0 || game === GAMES) {
    const bench = benchmark(BENCH_GAMES);
    save(game, bench);
    const seconds = (Date.now() - started) / 1000;
    console.log(
      `games ${game}  avg plies ${(plies / CHECKPOINT).toFixed(1)}  alpha ${alpha.toFixed(3)}  ` +
        `vs heuristic: win ${(bench.winRate * 100).toFixed(1)}%  points ${(bench.pointShare * 100).toFixed(1)}%  ` +
        `(${seconds.toFixed(0)}s, ${(game / seconds).toFixed(1)} games/s)`,
    );
    plies = 0;
  }
}
