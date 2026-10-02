import {
  ALL_ROLLS,
  applyMove,
  createRng,
  getLegalPlays,
  hasBorneOffAll,
  initialBoard,
  isDouble,
  legalSingleMoves,
  movesForRoll,
  opponentOf,
  positionKey,
  rollDice,
  type BoardState,
  type DiceRoll,
  type DieValue,
  type Player,
} from '../index';

/**
 * Deliberately naive reference implementation of "all legal plays": tries
 * every die in every order without any pruning. Used to cross-check the
 * optimised generator.
 */
export function naivePlayKeys(board: BoardState, player: Player, roll: DiceRoll): Set<string> {
  const dice = movesForRoll(roll);
  const results: { key: string; used: number; firstDie: DieValue | null }[] = [];
  const search = (current: BoardState, remaining: DieValue[], used: number, firstDie: DieValue | null) => {
    if (used > 0 && hasBorneOffAll(current, player)) {
      results.push({ key: positionKey(current), used: dice.length, firstDie });
      return;
    }
    let moved = false;
    remaining.forEach((die, index) => {
      for (const move of legalSingleMoves(current, player, die)) {
        moved = true;
        const rest = [...remaining.slice(0, index), ...remaining.slice(index + 1)];
        search(applyMove(current, player, move), rest, used + 1, firstDie ?? die);
      }
    });
    if (!moved) results.push({ key: positionKey(current), used, firstDie });
  };
  search(board, dice, 0, null);
  const max = Math.max(...results.map((r) => r.used));
  let best = results.filter((r) => r.used === max);
  if (!isDouble(roll) && max === 1) {
    const larger = Math.max(...roll) as DieValue;
    const withLarger = best.filter((r) => r.firstDie === larger);
    if (withLarger.length > 0) best = withLarger;
  }
  return new Set(best.map((r) => r.key));
}

export interface SampledPosition {
  board: BoardState;
  player: Player;
  roll: DiceRoll;
}

/** Plays random legal games with a seeded RNG and samples positions along the way. */
export function samplePositions(count: number, seed = 7): SampledPosition[] {
  const rng = createRng(seed);
  const samples: SampledPosition[] = [];
  while (samples.length < count) {
    let board = initialBoard();
    let player: Player = rng() < 0.5 ? 'player1' : 'player2';
    for (let ply = 0; ply < 400 && samples.length < count; ply++) {
      const roll = rollDice(rng);
      if (rng() < 0.15) samples.push({ board, player, roll });
      const plays = getLegalPlays(board, player, roll);
      board = plays[Math.floor(rng() * plays.length)].board;
      if (hasBorneOffAll(board, player)) break;
      player = opponentOf(player);
    }
  }
  return samples;
}

export { ALL_ROLLS };
