import type { IconName } from '@/components/ui/Icon';
import type { BoardSpec, DieValue, MoveSource, MoveTarget, Player } from '@/game';
import type { BoardArrow, BoardHighlight } from '@/types/board';

import type { SkillId } from './skills';

/**
 * The curriculum is pure, JSON-serialisable data. Adding a lesson never
 * requires touching screen code: the lesson player renders any step below.
 */

export interface BoardSetup {
  position: BoardSpec;
  highlights?: BoardHighlight[];
  arrows?: BoardArrow[];
  /** Dice to display (and, for move steps, to play). */
  dice?: DieValue[];
  cube?: { value: number; owner: Player | null };
  /** Defaults to true. Turning numbers off makes recognition exercises harder. */
  showPointNumbers?: boolean;
}

export type TapTarget = { kind: 'point'; point: number } | { kind: 'bar' } | { kind: 'off' };

interface StepBase {
  id: string;
  /** The skill this step trains, when it isn't the lesson's own (it must be one the lesson lists). */
  skill?: SkillId;
}

/** Short explanation, optionally illustrated on the board. Not scored. */
export interface ExplainStep extends StepBase {
  kind: 'explain';
  title?: string;
  /** One or two short sentences. Supports **bold** for key terms. */
  text: string;
  board?: BoardSetup;
  tip?: string;
}

/** The board plays a scripted sequence of moves with captions. Not scored. */
export interface DemoStep extends StepBase {
  kind: 'demo';
  title?: string;
  text: string;
  board: BoardSetup;
  moves: { player?: Player; from: MoveSource; to: MoveTarget; caption?: string }[];
}

/** Position recognition: tap the right place on the board. */
export interface TapStep extends StepBase {
  kind: 'tap';
  prompt: string;
  board: BoardSetup;
  /** Any of these counts as correct. */
  answers: TapTarget[];
  /** Shown after a correct tap. */
  correct: string;
  /**
   * Shown after a wrong tap. `{point}` is replaced with the tapped point number
   * and `{count}` with the number of checkers on it.
   */
  wrong: string;
  /** More specific feedback for particular wrong taps. */
  wrongCases?: { targets: TapTarget[]; text: string }[];
  /** Board to show after the correct tap (e.g. checkers placed during setup). */
  reveal?: BoardSpec;
  hint?: string;
}

export type MoveGoal =
  /** Any complete legal play is fine (practising the mechanics). */
  | { type: 'any' }
  /** The final position must match one of these plays, written in notation. */
  | { type: 'plays'; plays: string[] }
  /** At least `count` of your checkers must finish on `point`. */
  | { type: 'land-on'; point: number; count?: number }
  /** The play must hit (optionally on a specific point). */
  | { type: 'hit'; point?: number }
  /** Finish with a made point (2+ checkers) on `point` that was not made before. */
  | { type: 'make-point'; point: number }
  /** No checkers left on the bar. */
  | { type: 'enter' }
  /** Bear off at least `count` checkers this turn. */
  | { type: 'bear-off'; count: number }
  /** Leave no blots anywhere. */
  | { type: 'safe' };

/** Perform a move on the board with the given dice. */
export interface MoveStep extends StepBase {
  kind: 'move';
  prompt: string;
  board: BoardSetup & { dice: DieValue[] };
  goal: MoveGoal;
  /** A correct play in notation, demonstrated when the learner needs help. */
  solution: string;
  correct: string;
  /** Default explanation when the goal is not met. */
  wrong: string;
  /** Targeted explanations for specific wrong plays (notation). */
  wrongPlays?: { plays: string[]; text: string }[];
  hint?: string;
  /** Apply the "larger die" rule as in a real roll (default: true when two different dice). */
  realRoll?: boolean;
  /** Explain wrong answers with the coach engine (based on the move actually played). */
  coachFeedback?: boolean;
}

export interface ChoiceOption {
  id: string;
  text: string;
  correct?: boolean;
  /** Why this option is right or wrong. */
  explanation: string;
  /** A play in notation: the learner sees it as arrows when they pick the option, then confirms. */
  play?: string;
}

/** Multiple choice, optionally about a position. */
export interface ChoiceStep extends StepBase {
  kind: 'choice';
  prompt: string;
  board?: BoardSetup;
  options: ChoiceOption[];
  /** A speed goal: a timer runs down while the learner thinks. It never changes the score. */
  targetSeconds?: number;
}

export type CubeAnswer = 'double' | 'no-double' | 'take' | 'drop';

/** Doubling cube decision. */
export interface CubeStep extends StepBase {
  kind: 'cube';
  prompt: string;
  board: BoardSetup;
  /** 'offer': double or not. 'respond': take or drop. */
  decision: 'offer' | 'respond';
  answer: CubeAnswer;
  explanations: Partial<Record<CubeAnswer, string>>;
}

/** What a mini-game asks for by its last roll. */
export type ChallengeGoal =
  /** Every checker borne off. */
  | { type: 'bear-off-all' }
  /** Every checker in the home board. */
  | { type: 'all-home' }
  /** Every checker past all of theirs: nothing left to hit or be hit. */
  | { type: 'escape' }
  /** A wall of at least `length` made points in a row. */
  | { type: 'prime'; length: number }
  /** At least `count` of their checkers sent to the bar. */
  | { type: 'hit'; count: number };

/** A short solo mini-game played over several fixed rolls (e.g. bear everything off). */
export interface ChallengeStep extends StepBase {
  kind: 'challenge';
  prompt: string;
  board: BoardSetup;
  rolls: [DieValue, DieValue][];
  goal: ChallengeGoal;
  success: string;
  failure: string;
}

export type LessonStep = ExplainStep | DemoStep | TapStep | MoveStep | ChoiceStep | CubeStep | ChallengeStep;

export type ScoredStep = TapStep | MoveStep | ChoiceStep | CubeStep | ChallengeStep;

export const SCORED_KINDS: readonly LessonStep['kind'][] = ['tap', 'move', 'choice', 'cube', 'challenge'];

export function isScored(step: LessonStep): step is ScoredStep {
  return SCORED_KINDS.includes(step.kind);
}

export interface LessonObjective {
  id: string;
  text: string;
}

/**
 * What a lesson is for. Every lesson changes something the learner does at
 * the board; the curriculum tests check each field.
 */
export interface LessonPurpose {
  /** The behaviour the lesson builds, as something the learner can now do. */
  outcome: string;
  /** Skills the lesson builds on: each one is taught by an earlier lesson. */
  requires: SkillId[];
  /** The step that shows the idea on the board. */
  shows: string;
  /** The key decision the learner makes on their own, on a position. It comes after `shows`. */
  decision: string;
  /** Where the idea comes up in a real game, in one sentence. */
  inGame: string;
}

export interface Lesson {
  id: string;
  sectionId: string;
  title: string;
  description: string;
  icon: IconName;
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** The skill the lesson trains. Its scored steps count toward it unless a step names another. */
  skill: SkillId;
  /** Other skills some of its steps train (each step that does says so with `skill`). */
  alsoTrains?: SkillId[];
  purpose: LessonPurpose;
  objectives: LessonObjective[];
  steps: LessonStep[];
  /** Fraction (0..1) of scored steps needed to pass. 0 means finishing is enough. */
  passingScore: number;
  /** One-time bonus XP for completing the lesson (exercises earn their own XP). */
  xp: number;
}

export interface Section {
  id: string;
  title: string;
  subtitle: string;
  icon: IconName;
  /** Accent colour used on the learning map. */
  color: string;
  goal: string;
  lessons: Lesson[];
  /**
   * Who can open the section's lessons. The beginner course is free;
   * advanced sections may be 'premium'. Defaults to 'free'.
   */
  tier?: 'free' | 'premium';
}
