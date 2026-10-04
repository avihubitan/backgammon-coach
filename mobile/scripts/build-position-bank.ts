/**
 * Builds the position bank: real decisions from games the AI plays against
 * itself, each with the network's best move, a few clearly weaker moves a
 * learner might pick, and the skill the decision is about.
 *
 *   npx tsx scripts/build-position-bank.ts > src/curriculum/positionBank.ts
 *
 * Deterministic: the same seeds give the same bank. The tests re-check every
 * entry against the network, so a stale bank fails loudly.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { skillOfMistake } from '../src/features/skills/extract';
import { explainDifference } from '../src/game/ai/analysis';
import { chooseAiPlay } from '../src/game/ai/bots';
import { installNetwork, rankByEquity } from '../src/game/ai/engine';
import { deserializeNetwork, type SerializedNetwork } from '../src/game/ai/network';
import { checkersAt, hasContact, initialBoard, opponentOf } from '../src/game/board/board';
import { createRng, rollDice } from '../src/game/dice/dice';
import { formatPlay } from '../src/game/moves/notation';
import { hasBorneOffAll } from '../src/game/rules/movement';
import type { BoardState, Player } from '../src/game/types';

const net = deserializeNetwork(JSON.parse(readFileSync(join(__dirname, '../src/game/ai/weights/network.json'), 'utf8')) as SerializedNetwork);
installNetwork(net);

/** How much better the best move must be than each alternative shown. */
const CLEAR_GAP = 0.05;
/** Positions kept per skill, and games to draw them from. */
const PER_SKILL = 14;
const GAMES = 260;

interface Entry {
  position: Record<string, unknown>;
  dice: [number, number];
  skill: string;
  best: string;
  others: string[];
  gap: number;
}

function spec(board: BoardState) {
  const player1: Record<number, number> = {};
  const player2: Record<number, number> = {};
  for (let point = 1; point <= 24; point++) {
    const mine = checkersAt(board, point, 'player1');
    const theirs = checkersAt(board, point, 'player2');
    if (mine > 0) player1[point] = mine;
    if (theirs > 0) player2[point] = theirs;
  }
  const out: Record<string, unknown> = { player1, player2 };
  if (board.bar.player1 || board.bar.player2) out.bar = { ...board.bar };
  if (board.off.player1 || board.off.player2) out.off = { ...board.off };
  return out;
}

const bySkill = new Map<string, Entry[]>();
const seen = new Set<string>();
const rng = createRng(20261004);

for (let game = 0; game < GAMES; game++) {
  let board = initialBoard();
  let player: Player = rng() < 0.5 ? 'player1' : 'player2';
  for (let ply = 0; ply < 400; ply++) {
    const roll = rollDice(rng);
    if (player === 'player1' && ply >= 4 && roll[0] !== roll[1]) {
      const ranked = rankByEquity(board, 'player1', roll);
      const key = `${JSON.stringify(spec(board))}|${roll}`;
      if (ranked.length >= 3 && !seen.has(key)) {
        seen.add(key);
        const best = ranked[0];
        const weaker = ranked.filter((entry) => best.equity - entry.equity >= CLEAR_GAP).slice(0, 2);
        if (weaker.length === 2) {
          const why = explainDifference(board, 'player1', weaker[0].play.moves, best.play.moves, false);
          const skill = skillOfMistake(why);
          const list = bySkill.get(skill) ?? [];
          if (list.length < PER_SKILL && (hasContact(board) || skill === 'bear-off' || skill === 'racing')) {
            list.push({
              position: spec(board),
              dice: [Math.max(roll[0], roll[1]), Math.min(roll[0], roll[1])],
              skill,
              best: formatPlay('player1', best.play.moves),
              others: weaker.map((entry) => formatPlay('player1', entry.play.moves)),
              gap: Math.round((best.equity - weaker[0].equity) * 1000) / 1000,
            });
            bySkill.set(skill, list);
          }
        }
      }
    }
    const chosen = chooseAiPlay(board, player, roll, 'intermediate', rng);
    board = chosen.board;
    if (hasBorneOffAll(board, player)) break;
    player = opponentOf(player);
  }
}

const entries = [...bySkill.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([, list]) => list);
const counts = Object.fromEntries([...bySkill.entries()].map(([skill, list]) => [skill, list.length]));
console.error('kept', entries.length, counts);

/** A spec as a compact TypeScript literal: { player1: { 6: 4, 8: 3 }, ... }. */
const literal = (value: unknown): string =>
  JSON.stringify(value)
    .replace(/"(\w+)":/g, '$1: ')
    .replace(/,/g, ', ')
    .replace(/\{/g, '{ ')
    .replace(/\}/g, ' }');

const lines = entries.map((entry, index) =>
  [
    '  {',
    `    id: 'p${String(index + 1).padStart(3, '0')}',`,
    `    skill: '${entry.skill}',`,
    `    dice: [${entry.dice.join(', ')}],`,
    `    best: '${entry.best}',`,
    `    others: [${entry.others.map((play) => `'${play}'`).join(', ')}],`,
    `    position: ${literal(entry.position)},`,
    '  },',
  ].join('\n'),
);

console.log(`import type { BoardSpec, DieValue } from '@/game';

import type { SkillId } from './skills';

/**
 * Real decisions from games the AI played against itself, for "What would you
 * play?" exercises: the network's best move, two clearly weaker moves a
 * learner might choose, and the skill the decision is about.
 *
 * Generated by scripts/build-position-bank.ts. Do not edit by hand: the tests
 * check every entry against the network.
 */
export interface BankPosition {
  id: string;
  /** You (player1) are to play. */
  position: BoardSpec;
  dice: [DieValue, DieValue];
  skill: SkillId;
  /** The network's best play, in notation. */
  best: string;
  /** Plays that lose clearly against it (at least ${CLEAR_GAP} in equity). */
  others: string[];
}

export const POSITION_BANK: BankPosition[] = [
${lines.join('\n')}
];
`);
