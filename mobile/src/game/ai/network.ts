import { checkersAt, opponentOf, pointAtDistance } from '../board/board';
import type { BoardState, Player } from '../types';

/**
 * A small TD-Gammon style neural network evaluator.
 *
 * Positions are encoded from the point of view of the player who just moved
 * ("me") with the opponent about to roll, so one network serves both colours.
 * Outputs: P(I win), P(I win a gammon or better), P(I lose a gammon or better).
 */
export const INPUTS = 196;
export const OUTPUTS = 3;

export interface Network {
  hidden: number;
  /** hidden x INPUTS, row-major. */
  w1: Float32Array;
  b1: Float32Array;
  /** OUTPUTS x hidden, row-major. */
  w2: Float32Array;
  b2: Float32Array;
}

export interface NetEvaluation {
  win: number;
  winGammon: number;
  loseGammon: number;
  /** Cubeless equity in points per game (-3..3, practically -2..2). */
  equity: number;
}

export function createNetwork(hidden: number, rng: () => number = Math.random, scale = 0.1): Network {
  const rand = () => (rng() * 2 - 1) * scale;
  return {
    hidden,
    w1: Float32Array.from({ length: hidden * INPUTS }, rand),
    b1: Float32Array.from({ length: hidden }, rand),
    w2: Float32Array.from({ length: OUTPUTS * hidden }, rand),
    b2: Float32Array.from({ length: OUTPUTS }, rand),
  };
}

/**
 * Sparse encoding: returns parallel arrays of input indices and values.
 * Each side gets 4 units per point (1, 2, 3, and (n-3)/2 for big stacks),
 * plus bar/2 and borne-off/15.
 */
export function encodeSparse(board: BoardState, me: Player, indices: Int32Array, values: Float32Array): number {
  let count = 0;
  const sides: Player[] = [me, opponentOf(me)];
  for (let s = 0; s < 2; s++) {
    const side = sides[s];
    const base = s * 98;
    for (let distance = 1; distance <= 24; distance++) {
      const n = checkersAt(board, pointAtDistance(side, distance), side);
      if (n === 0) continue;
      const unit = base + (distance - 1) * 4;
      indices[count] = unit;
      values[count++] = 1;
      if (n >= 2) {
        indices[count] = unit + 1;
        values[count++] = 1;
      }
      if (n >= 3) {
        indices[count] = unit + 2;
        values[count++] = 1;
      }
      if (n > 3) {
        indices[count] = unit + 3;
        values[count++] = (n - 3) / 2;
      }
    }
    if (board.bar[side] > 0) {
      indices[count] = base + 96;
      values[count++] = board.bar[side] / 2;
    }
    if (board.off[side] > 0) {
      indices[count] = base + 97;
      values[count++] = board.off[side] / 15;
    }
  }
  return count;
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** Scratch buffers reused across calls (evaluation is synchronous). */
const scratch = { indices: new Int32Array(INPUTS), values: new Float32Array(INPUTS) };

export interface ForwardResult {
  hidden: Float32Array;
  out: Float32Array;
  nnz: number;
}

export function forwardSparse(
  net: Network,
  indices: Int32Array,
  values: Float32Array,
  nnz: number,
  hiddenOut: Float32Array = new Float32Array(net.hidden),
  out: Float32Array = new Float32Array(OUTPUTS),
): ForwardResult {
  const { hidden, w1, b1, w2, b2 } = net;
  for (let j = 0; j < hidden; j++) {
    let sum = b1[j];
    const row = j * INPUTS;
    for (let k = 0; k < nnz; k++) sum += w1[row + indices[k]] * values[k];
    hiddenOut[j] = sigmoid(sum);
  }
  for (let o = 0; o < OUTPUTS; o++) {
    let sum = b2[o];
    const row = o * hidden;
    for (let j = 0; j < hidden; j++) sum += w2[row + j] * hiddenOut[j];
    out[o] = sigmoid(sum);
  }
  return { hidden: hiddenOut, out, nnz };
}

/** Evaluates a position for `me`, who has just moved (the opponent rolls next). */
export function evaluateNetwork(net: Network, board: BoardState, me: Player): NetEvaluation {
  const nnz = encodeSparse(board, me, scratch.indices, scratch.values);
  const { out } = forwardSparse(net, scratch.indices, scratch.values, nnz);
  const win = out[0];
  const winGammon = Math.min(out[1], win);
  const loseGammon = Math.min(out[2], 1 - win);
  return { win, winGammon, loseGammon, equity: 2 * win - 1 + winGammon - loseGammon };
}

// ---------------------------------------------------------------------------
// Serialisation (base64 Float32 so the weights ship as a small JSON file)

export interface SerializedNetwork {
  version: 1;
  hidden: number;
  w1: string;
  b1: string;
  w2: string;
  b2: string;
  meta?: Record<string, unknown>;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += B64[(triple >> 18) & 63] + B64[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(triple >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[triple & 63] : '=';
  }
  return out;
}

function base64ToBytes(text: string): Uint8Array {
  const clean = text.replace(/=+$/, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of clean) {
    buffer = (buffer << 6) | B64.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[index++] = (buffer >> bits) & 255;
    }
  }
  return bytes;
}

const f32ToBase64 = (array: Float32Array) =>
  bytesToBase64(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));

function base64ToF32(text: string): Float32Array {
  const bytes = base64ToBytes(text);
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Float32Array(copy.buffer);
}

export function serializeNetwork(net: Network, meta?: Record<string, unknown>): SerializedNetwork {
  return {
    version: 1,
    hidden: net.hidden,
    w1: f32ToBase64(net.w1),
    b1: f32ToBase64(net.b1),
    w2: f32ToBase64(net.w2),
    b2: f32ToBase64(net.b2),
    meta,
  };
}

export function deserializeNetwork(data: SerializedNetwork): Network {
  const net: Network = {
    hidden: data.hidden,
    w1: base64ToF32(data.w1),
    b1: base64ToF32(data.b1),
    w2: base64ToF32(data.w2),
    b2: base64ToF32(data.b2),
  };
  if (net.w1.length !== net.hidden * INPUTS || net.w2.length !== OUTPUTS * net.hidden) {
    throw new Error('Network weights do not match their declared shape');
  }
  return net;
}
