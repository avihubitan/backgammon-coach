import type { LessonStep, MoveStep } from '@/curriculum';
import {
  DRILL_CATEGORIES,
  drillsFor,
  getDrillCategory,
  type DrillCategory,
  type DrillCategoryInfo,
  type DrillLevel,
  type TacticalDrill,
} from '@/curriculum/drills';
import type { LessonRecords } from '@/features/learning/progression';
import { skillOfMistake } from '@/features/skills/extract';
import type { PositionRef } from '@/features/coach/positionOfTheDay';
import { createRng, formatPlay, type Rng } from '@/game';

import { openLevels, planLevels, type LessonDone, type LevelStats } from './drillLevels';
import { generatorFor } from './generators';
import { specFromBoard } from './generators/pips';
import type { UserMistake } from './mistakes';

export { randomRace, raceQuestion, specFromBoard } from './generators/pips';
export type { LessonDone } from './drillLevels';

export function drillToStep(drill: TacticalDrill): MoveStep {
  return {
    id: drill.id,
    kind: 'move',
    skill: drill.skill ?? DRILL_CATEGORIES.find((info) => info.id === drill.category)?.skill,
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
    skill: skillOfMistake(mistake),
    prompt: `From one of your games: you rolled **${mistake.dice.join('-')}**. Find the better move.`,
    board: { position: specFromBoard(mistake.position), dice: mistake.dice },
    goal: { type: 'plays', plays: [best] },
    solution: best,
    correct: `That’s it: ${best}. ${mistake.explanation}`,
    wrong: `Last time you played ${formatPlay('player1', mistake.selectedMove)}.`,
    coachFeedback: true,
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
  category: DrillCategory | 'mistakes' | 'position';
  steps: LessonStep[];
  /** The level each step comes from, for drills (step id → level id). */
  levelOf: Record<string, string>;
  /** For a single position: which one it is. */
  ref?: PositionRef;
}

export const SESSION_LENGTH = 5;

const ALL_DONE: LessonDone = () => true;

/** A level's step, tagged with the skill it trains (and a time to beat on speed levels). */
function decorate(step: LessonStep, info: DrillCategoryInfo, level: DrillLevel): LessonStep {
  const skill = step.skill ?? level.skill ?? info.skill;
  if (step.kind === 'choice' && level.targetSeconds) return { ...step, skill, targetSeconds: level.targetSeconds };
  return { ...step, skill };
}

/**
 * A drill session: questions from the learner's current level (one from a
 * level they've cleared), generated fresh for each seed or hand-picked.
 * A level that runs out of hand-picked positions hands over to another open level.
 */
export function buildDrillSession(
  category: DrillCategory,
  seed: number,
  length = SESSION_LENGTH,
  done: LessonDone = ALL_DONE,
  levelStats: Partial<Record<string, LevelStats>> = {},
): PracticeSession {
  const rng = createRng(seed);
  const info = getDrillCategory(category)!;
  const pool = shuffle(
    drillsFor(category).filter((drill) => !drill.requiresLesson || done(drill.requiresLesson)),
    rng,
  );
  const used = new Set<string>();
  const stepFor = (level: DrillLevel, index: number): LessonStep | null => {
    const generate = generatorFor(category, level.id);
    if (generate) {
      const step = generate(rng, index);
      return step ? decorate(step, info, level) : null;
    }
    const drill = pool.find((candidate) => !used.has(candidate.id) && (candidate.level ?? 'classics') === level.id);
    if (!drill) return null;
    used.add(drill.id);
    return decorate(drillToStep(drill), info, level);
  };
  const open = openLevels(info, done);
  const steps: LessonStep[] = [];
  const levelOf: Record<string, string> = {};
  planLevels(info, done, levelStats, length, rng).forEach((planned, index) => {
    for (const level of [planned, ...open.filter((other) => other.id !== planned.id)]) {
      const made = stepFor(level, index);
      if (!made) continue;
      // Step ids identify answers within the session, so they must not repeat.
      const step = levelOf[made.id] ? { ...made, id: `${made.id}-${index}` } : made;
      steps.push(step);
      levelOf[step.id] = level.id;
      return;
    }
  });
  return { id: `drill-${category}-${seed}`, title: info.title, category, steps, levelOf };
}

export function buildMistakeSession(mistakes: UserMistake[]): PracticeSession {
  return { id: 'mistakes', title: 'My mistakes', category: 'mistakes', steps: mistakes.map(mistakeToStep), levelOf: {} };
}

/** Drill categories the learner has unlocked: the lesson that teaches each one is done. */
export function unlockedDrillCategories(records: LessonRecords): DrillCategoryInfo[] {
  return DRILL_CATEGORIES.filter((info) => !!records[info.requiresLesson]?.completed);
}
