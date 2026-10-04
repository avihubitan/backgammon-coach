import { allLessons, lessonSkills, SKILLS, type ChoiceStep, type ExplainStep, type LessonStep, type SkillId } from '@/curriculum';
import { POSITION_BANK, type BankPosition } from '@/curriculum/positionBank';
import { chainMoves } from '@/features/lessons/engine/moves';
import type { LessonRecords } from '@/features/learning/progression';
import type { SkillStats } from '@/features/learning/progressModel';
import { dueMistakes, type UserMistake } from '@/features/practice/mistakes';
import { specFromBoard } from '@/features/practice/generators/pips';
import { skillOfMistake } from '@/features/skills/extract';
import {
  createBoard,
  describePlay,
  explainDifference,
  findPlayByNotation,
  formatPlay,
  moveOutcome,
  rankByEquity,
  REVIEW_HEADLINES,
  type BoardState,
  type CheckerMove,
  type DiceRoll,
} from '@/game';

/**
 * Position of the Day, and "one more position": a real position, "What would
 * you play?", then the best move, yours, why, the key idea and what each
 * move leads to. Positions come from the learner's own games when one is due
 * for review, otherwise from a bank of real decisions in the skill they most
 * need. Picking is pure and stable for a day.
 */

export type PositionRef = { source: 'mistake'; id: string } | { source: 'bank'; id: string };

export const refKey = (ref: PositionRef) => `${ref.source}:${ref.id}`;

export function parseRef(text: string | undefined): PositionRef | null {
  const [source, ...rest] = (text ?? '').split(':');
  const id = rest.join(':');
  if (!id || (source !== 'mistake' && source !== 'bank')) return null;
  return { source, id };
}

/** Skills a lesson the learner finished has taught. */
export function taughtSkills(lessons: LessonRecords): Set<SkillId> {
  return new Set(allLessons.filter((lesson) => lessons[lesson.id]?.completed).flatMap(lessonSkills));
}

/** Recent first-try share (lifetime when there's no recent window yet); unknown skills sit in the middle. */
function recentShare(stats: SkillStats | undefined): number {
  if (!stats) return 0.75;
  if (stats.recent.length >= 3) return [...stats.recent].filter((answer) => answer === '1').length / stats.recent.length;
  return stats.attempted >= 3 ? stats.firstTry / stats.attempted : 0.75;
}

/** Skills ordered from the shakiest to the most secure. */
export function weakestFirst(skills: readonly SkillId[], bySkill: Partial<Record<SkillId, SkillStats>>): SkillId[] {
  return [...skills].sort((a, b) => recentShare(bySkill[a]) - recentShare(bySkill[b]) || a.localeCompare(b));
}

function hash(text: string): number {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

export interface DailyInput {
  day: string;
  mistakes: readonly UserMistake[];
  lessons: LessonRecords;
  bySkill: Partial<Record<SkillId, SkillStats>>;
  /** The learner has the review of their own mistakes (Premium), which already brings back the due ones. */
  reviewQueue?: boolean;
}

/**
 * Today's position: a mistake from the learner's games that's due for review,
 * else a bank position in their shakiest taught skill (null before any skill
 * the bank covers has been taught). With the review queue, due mistakes are
 * reviewed there, so the bank comes first.
 */
export function pickDailyPosition({ day, mistakes, lessons, bySkill, reviewQueue = false }: DailyInput): PositionRef | null {
  const due = dueMistakes(mistakes, day);
  const fromGame: PositionRef | null = due.length > 0 ? { source: 'mistake', id: due[0].id } : null;
  if (fromGame && !reviewQueue) return fromGame;
  const taught = taughtSkills(lessons);
  const covered = [...new Set(POSITION_BANK.map((entry) => entry.skill))].filter((skill) => taught.has(skill));
  if (covered.length === 0) return fromGame;
  const skill = weakestFirst(covered, bySkill)[0];
  const pool = POSITION_BANK.filter((entry) => entry.skill === skill);
  return { source: 'bank', id: pool[hash(day) % pool.length].id };
}

/** Whether a position can still be shown: its mistake is still saved, or it's in the bank. */
export function refExists(ref: PositionRef, mistakes: readonly UserMistake[]): boolean {
  return ref.source === 'bank'
    ? POSITION_BANK.some((entry) => entry.id === ref.id)
    : mistakes.some((mistake) => mistake.id === ref.id);
}

/**
 * Today's position: the one already shown today (so it doesn't change after a
 * game or a lesson), else a fresh pick. Pure; the caller remembers the result.
 */
export function dailyPosition(input: DailyInput & { stored: { day: string | null; ref: string | null } }): PositionRef | null {
  const kept = input.stored.day === input.day ? parseRef(input.stored.ref ?? undefined) : null;
  if (kept && refExists(kept, input.mistakes)) return kept;
  return pickDailyPosition(input);
}

/** Another bank position with the same idea, not one already seen (null once they run out). */
export function anotherLike(skill: SkillId, seen: readonly string[], seed: number): PositionRef | null {
  const pool = POSITION_BANK.filter((entry) => entry.skill === skill && !seen.includes(entry.id));
  if (pool.length === 0) return null;
  return { source: 'bank', id: pool[Math.abs(seed) % pool.length].id };
}

interface Candidate {
  moves: CheckerMove[];
  best: boolean;
  /** What the learner played in the game, for positions from their games. */
  yours?: boolean;
}

interface Decision {
  board: BoardState;
  dice: DiceRoll;
  skill: SkillId;
  candidates: Candidate[];
  fromGame: boolean;
}

const percent = (chance: number) => `${Math.round(chance * 100)}%`;
const SAFETY = new Set<string>([REVIEW_HEADLINES.safer, REVIEW_HEADLINES.slightlySafer]);

const shotsText = (count: number) => (count === 0 ? 'no shots' : count === 1 ? '1 shot' : `${count} shots`);

/** What a move leads to compared with the best one: shots and winning chances, when they differ. Names both moves. */
function consequence(board: BoardState, played: readonly CheckerMove[], best: readonly CheckerMove[], skipShots: boolean): string {
  const outcome = moveOutcome({ boardBefore: board, player: 'player1', played: [...played], best: [...best] });
  const playedText = formatPlay('player1', played);
  const bestText = formatPlay('player1', best);
  const parts: string[] = [];
  // Shots only when they argue for the best move: a bold best move is explained by its reason, not its risk.
  if (!skipShots && outcome.shots.played > outcome.shots.best) {
    parts.push(`${playedText} leaves ${shotsText(outcome.shots.played)}; ${bestText} leaves ${shotsText(outcome.shots.best)}.`);
  }
  if (Math.abs(outcome.winChance.best - outcome.winChance.played) >= 0.02) {
    parts.push(`Winning chances: ${percent(outcome.winChance.played)} after ${playedText}, ${percent(outcome.winChance.best)} after ${bestText}.`);
  }
  return parts.join(' ');
}

function decisionFor(ref: PositionRef, mistakes: readonly UserMistake[]): Decision | null {
  if (ref.source === 'bank') {
    const entry: BankPosition | undefined = POSITION_BANK.find((candidate) => candidate.id === ref.id);
    if (!entry) return null;
    const board = createBoard(entry.position);
    const dice = entry.dice as DiceRoll;
    const plays = [entry.best, ...entry.others].map((text) => findPlayByNotation(board, 'player1', dice, text));
    if (plays.some((play) => !play)) return null;
    return {
      board,
      dice,
      skill: entry.skill,
      candidates: plays.map((play, index) => ({ moves: play!.moves, best: index === 0 })),
      fromGame: false,
    };
  }
  const mistake = mistakes.find((candidate) => candidate.id === ref.id);
  if (!mistake) return null;
  const board = mistake.position;
  const ranked = rankByEquity(board, 'player1', mistake.dice);
  const keyOf = (moves: readonly CheckerMove[]) => ranked.find((entry) => formatPlay('player1', entry.play.moves) === formatPlay('player1', moves))?.play.key;
  const bestKey = keyOf(mistake.recommendedMove);
  const yoursKey = keyOf(mistake.selectedMove);
  const top = ranked[0]?.equity ?? 0;
  // A third choice: the most tempting other move that's clearly worse.
  const third = ranked.find((entry) => entry.play.key !== bestKey && entry.play.key !== yoursKey && top - entry.equity >= 0.03);
  const candidates: Candidate[] = [
    { moves: mistake.recommendedMove, best: true },
    { moves: mistake.selectedMove, best: false, yours: true },
    ...(third ? [{ moves: third.play.moves, best: false }] : []),
  ];
  return { board, dice: mistake.dice, skill: skillOfMistake(mistake), candidates, fromGame: true };
}

/** Stable order for a position's choices, so a replay looks the same. */
function ordered<T>(items: T[], seed: string): T[] {
  return items
    .map((item, index) => ({ item, key: hash(`${seed}:${index}`) }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.item);
}

/**
 * The two steps of a position: the choice ("What would you play?") with each
 * move's reason and consequence, then the key idea with the best move shown.
 */
export function positionSteps(ref: PositionRef, mistakes: readonly UserMistake[], label: string): LessonStep[] | null {
  const decision = decisionFor(ref, mistakes);
  if (!decision) return null;
  const { board, dice, skill, candidates, fromGame } = decision;
  const best = candidates.find((candidate) => candidate.best)!;
  const bestText = formatPlay('player1', best.moves);
  const options = candidates.map((candidate, index) => {
    const text = formatPlay('player1', candidate.moves);
    if (candidate.best) {
      return {
        id: `move-${index}`,
        text,
        play: text,
        correct: true,
        explanation: `Right: ${bestText}. ${describePlay(board, 'player1', best.moves)}`,
      };
    }
    const why = explainDifference(board, 'player1', candidate.moves, best.moves, false);
    const yours = candidate.yours ? 'That’s what you played in your game. ' : '';
    return {
      id: `move-${index}`,
      text,
      play: text,
      explanation: `${yours}${why.explanation} ${consequence(board, candidate.moves, best.moves, SAFETY.has(why.headline))}`.trim(),
    };
  });
  const position = specFromBoard(board);
  const roll = `**${Math.max(...dice)}-${Math.min(...dice)}**`;
  const choice: ChoiceStep = {
    id: `pick-${refKey(ref)}`,
    kind: 'choice',
    skill,
    prompt: fromGame ? `From your game: you rolled ${roll}. What would you play?` : `${label}: you rolled ${roll}. What would you play?`,
    board: { position, dice: [...dice] },
    options: ordered(options, refKey(ref)),
  };
  // The idea, the move it gives here, and the question that finds it next time.
  const { summary, question } = SKILLS[skill];
  const idea: ExplainStep = {
    id: `idea-${refKey(ref)}`,
    kind: 'explain',
    title: `Key idea: ${SKILLS[skill].title}`,
    text: `${summary} Here that’s **${bestText}**.${question ? ` Before every move, ask: **${question}**` : ''}`,
    board: { position, dice: [...dice], arrows: chainMoves(best.moves).map((trip) => ({ ...trip, tone: 'hint' as const })) },
  };
  return [choice, idea];
}

/** The skill a position is about, for "Try another position using the same idea". */
export function skillOfRef(ref: PositionRef, mistakes: readonly UserMistake[]): SkillId | null {
  if (ref.source === 'bank') return POSITION_BANK.find((entry) => entry.id === ref.id)?.skill ?? null;
  const mistake = mistakes.find((candidate) => candidate.id === ref.id);
  return mistake ? skillOfMistake(mistake) : null;
}
