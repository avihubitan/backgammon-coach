import {
  DRILL_CATEGORIES,
  drillsFor,
  type DrillCategory,
  type DrillCategoryInfo,
  type TacticalDrill,
} from '@/curriculum/drills';
import type { ChoiceStep, LessonStep, MoveStep, SkillCategory } from '@/curriculum';
import {
  checkersAt,
  createRng,
  formatPlay,
  pipCount,
  type BoardSpec,
  type BoardState,
  type Rng,
} from '@/game';
import type { LessonRecords } from '@/features/learning/progression';

import type { UserMistake } from './mistakes';

/** Converts a board back into the readable spec format lessons use. */
export function specFromBoard(board: BoardState): BoardSpec {
  const player1: Record<number, number> = {};
  const player2: Record<number, number> = {};
  for (let point = 1; point <= 24; point++) {
    const mine = checkersAt(board, point, 'player1');
    const theirs = checkersAt(board, point, 'player2');
    if (mine > 0) player1[point] = mine;
    if (theirs > 0) player2[point] = theirs;
  }
  return { player1, player2, bar: { ...board.bar }, off: { ...board.off } };
}

export const SKILL_FOR_DRILL: Record<DrillCategory, SkillCategory> = {
  hitting: 'hitting',
  safety: 'positioning',
  points: 'positioning',
  'bear-off': 'bearing-off',
  race: 'racing',
  opening: 'opening',
};

export function drillToStep(drill: TacticalDrill): MoveStep {
  return {
    id: drill.id,
    kind: 'move',
    prompt: drill.prompt,
    board: { position: drill.position, dice: drill.dice },
    goal: drill.goal,
    solution: drill.solution,
    correct: drill.explanation,
    wrong: '',
    coachFeedback: true,
  };
}

export function mistakeToStep(mistake: UserMistake): MoveStep {
  const best = formatPlay('player1', mistake.recommendedMove);
  return {
    id: mistake.id,
    kind: 'move',
    prompt: `From one of your games: you rolled **${mistake.dice.join('-')}**. Find the better move.`,
    board: { position: specFromBoard(mistake.position), dice: mistake.dice },
    goal: { type: 'plays', plays: [best] },
    solution: best,
    correct: `That’s it: ${best}. ${mistake.explanation}`,
    wrong: `Last time you played ${formatPlay('player1', mistake.selectedMove)}.`,
    coachFeedback: true,
  };
}

/** A random pure-race position: player1 in 1..12, player2 in 13..24, no contact. */
export function randomRace(rng: Rng): BoardState {
  const place = (player: 'player1' | 'player2'): Record<number, number> => {
    const spots: Record<number, number> = {};
    for (let i = 0; i < 15; i++) {
      // Weighted toward the home board, like a real race.
      const distance = Math.min(12, 1 + Math.floor(Math.pow(rng(), 1.6) * 12));
      const point = player === 'player1' ? distance : 25 - distance;
      spots[point] = (spots[point] ?? 0) + 1;
    }
    return spots;
  };
  const player1 = place('player1');
  const player2 = place('player2');
  const board: BoardState = { points: new Array(25).fill(0), bar: { player1: 0, player2: 0 }, off: { player1: 0, player2: 0 } };
  for (const [point, count] of Object.entries(player1)) board.points[Number(point)] = count;
  for (const [point, count] of Object.entries(player2)) board.points[Number(point)] = -count;
  return board;
}

export function raceQuestion(rng: Rng, index: number): ChoiceStep {
  let board = randomRace(rng);
  for (let tries = 0; tries < 20 && pipCount(board, 'player1') === pipCount(board, 'player2'); tries++) board = randomRace(rng);
  const mine = pipCount(board, 'player1');
  const theirs = pipCount(board, 'player2');
  const id = `race-${index}`;
  if (index % 2 === 0) {
    const ahead = mine < theirs;
    const gap = Math.abs(mine - theirs);
    return {
      id,
      kind: 'choice',
      prompt: 'Pure race. Count the pips: who is ahead?',
      board: { position: specFromBoard(board) },
      options: [
        {
          id: 'me',
          text: 'You are',
          correct: ahead,
          explanation: `You need ${mine} pips and your opponent needs ${theirs}. ${ahead ? `You lead by ${gap}.` : `They lead by ${gap}.`}`,
        },
        {
          id: 'them',
          text: 'Your opponent is',
          correct: !ahead,
          explanation: `Your count is ${mine}, theirs is ${theirs}. ${!ahead ? `They lead by ${gap}.` : `Actually you lead by ${gap}.`}`,
        },
      ],
    };
  }
  const offsets = [0, mine % 2 === 0 ? 6 : -6, mine % 3 === 0 ? -11 : 9];
  const options = offsets
    .map((offset) => mine + offset)
    .sort(() => rng() - 0.5)
    .map((value) => ({
      id: String(value),
      text: `${value} pips`,
      correct: value === mine,
      explanation:
        value === mine
          ? `Exactly ${mine}. Count each checker’s distance from home and add them up.`
          : `Not quite: your pip count is ${mine}. Multiply each point by the checkers on it and add them up.`,
    }));
  return {
    id,
    kind: 'choice',
    prompt: 'What is **your** pip count (the light checkers)?',
    board: { position: specFromBoard(board) },
    options,
  };
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export interface PracticeSession {
  id: string;
  title: string;
  category: DrillCategory | 'mistakes';
  steps: LessonStep[];
}

export const SESSION_LENGTH = 5;

export function buildDrillSession(category: DrillCategory, seed: number, length = SESSION_LENGTH): PracticeSession {
  const rng = createRng(seed);
  const info = DRILL_CATEGORIES.find((entry) => entry.id === category)!;
  const steps: LessonStep[] =
    category === 'race'
      ? Array.from({ length }, (_, index) => raceQuestion(rng, index))
      : shuffle(drillsFor(category), rng).slice(0, length).map(drillToStep);
  return { id: `drill-${category}-${seed}`, title: info.title, category, steps };
}

export function buildMistakeSession(mistakes: UserMistake[]): PracticeSession {
  return { id: 'mistakes', title: 'My mistakes', category: 'mistakes', steps: mistakes.map(mistakeToStep) };
}

export function unlockedDrillCategories(records: LessonRecords, sections: { id: string; lessons: { id: string }[] }[]): DrillCategoryInfo[] {
  return DRILL_CATEGORIES.filter((info) => {
    const section = sections.find((candidate) => candidate.id === info.requiresSection);
    return !!section && section.lessons.length > 0 && section.lessons.every((lesson) => records[lesson.id]?.completed);
  });
}

// ---------------------------------------------------------------------------
// Daily challenge

export interface DailyChallenge {
  id: string;
  category: DrillCategory;
  title: string;
  target: number;
  xp: number;
}

const CHALLENGE_TITLES: Record<DrillCategory, string> = {
  hitting: 'Make 5 correct moves involving hitting',
  safety: 'Find 5 safe plays',
  points: 'Make 5 points in drills',
  'bear-off': 'Ace 5 bear-off drills',
  race: 'Answer 5 race questions correctly',
  opening: 'Play 5 opening moves correctly',
};

function hashDay(day: string): number {
  let hash = 2166136261;
  for (const char of day) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

/** Today's challenge: picked deterministically from the drills the learner has unlocked. */
export function dailyChallengeFor(day: string, unlocked: DrillCategoryInfo[]): DailyChallenge | null {
  if (unlocked.length === 0) return null;
  const info = unlocked[hashDay(day) % unlocked.length];
  return { id: `${day}:${info.id}`, category: info.id, title: CHALLENGE_TITLES[info.id], target: 5, xp: 50 };
}
