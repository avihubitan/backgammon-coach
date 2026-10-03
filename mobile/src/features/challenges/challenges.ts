import type { IconName } from '@/components/ui/Icon';
import type { DrillCategory } from '@/curriculum/drills';

/**
 * Daily challenges: one small, optional goal per day. Progress comes from
 * events the rest of the app reports (a correct exercise, a hit, a won
 * game…), so a challenge never needs special screens. Skipping a day costs
 * nothing.
 */
export type ChallengeEvent =
  | { type: 'exercise-correct'; firstTry: boolean }
  | { type: 'hit' }
  | { type: 'lesson-completed'; stars: number }
  | { type: 'practice-session'; category: DrillCategory | 'mistakes' }
  | { type: 'mistake-fixed' }
  | { type: 'game-won' };

export interface ChallengeContext {
  /** Sections the learner has finished. */
  completedSections: string[];
  unlockedDrills: DrillCategory[];
  playUnlocked: boolean;
  /** Unmastered mistakes from the learner's games. */
  openMistakes: number;
  /** Whether the learner can open mistake practice (a Premium feature). */
  canPracticeMistakes: boolean;
}

export type ChallengeAction =
  | { kind: 'lesson' }
  | { kind: 'practice'; category: DrillCategory | 'mistakes' }
  | { kind: 'play' };

export interface ChallengeDefinition {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  target: number;
  xp: number;
  action: ChallengeAction;
  /** How much an event moves this challenge forward. */
  progressFor: (event: ChallengeEvent) => number;
  available: (context: ChallengeContext) => boolean;
}

const DRILL_TITLES: Record<DrillCategory, string> = {
  hitting: 'Find the hit',
  safety: 'Play it safe',
  points: 'Make points',
  'bear-off': 'Bear-off speed',
  race: 'Who’s ahead?',
  opening: 'Opening moves',
};

function drillChallenge(category: DrillCategory): ChallengeDefinition {
  return {
    id: `drill-${category}`,
    title: `Finish a “${DRILL_TITLES[category]}” drill`,
    description: 'Five quick positions in the Practice tab.',
    icon: 'target',
    target: 1,
    xp: 40,
    action: { kind: 'practice', category },
    progressFor: (event) => (event.type === 'practice-session' && event.category === category ? 1 : 0),
    available: (context) => context.unlockedDrills.includes(category),
  };
}

export const CHALLENGES: ChallengeDefinition[] = [
  {
    id: 'exercises',
    title: 'Get 5 exercises right',
    description: 'In lessons or practice. Every correct answer counts.',
    icon: 'check-decagram',
    target: 5,
    xp: 30,
    action: { kind: 'lesson' },
    progressFor: (event) => (event.type === 'exercise-correct' ? 1 : 0),
    available: () => true,
  },
  {
    id: 'first-try',
    title: 'Answer 3 exercises on the first try',
    description: 'Take your time: check each move before you make it.',
    icon: 'bullseye-arrow',
    target: 3,
    xp: 35,
    action: { kind: 'lesson' },
    progressFor: (event) => (event.type === 'exercise-correct' && event.firstTry ? 1 : 0),
    available: () => true,
  },
  {
    id: 'perfect-lesson',
    title: 'Earn 3 stars in a lesson',
    description: 'A new lesson or a replay, as long as it’s flawless.',
    icon: 'star-shooting',
    target: 1,
    xp: 40,
    action: { kind: 'lesson' },
    progressFor: (event) => (event.type === 'lesson-completed' && event.stars === 3 ? 1 : 0),
    available: (context) => context.completedSections.length > 0,
  },
  {
    id: 'hit-blots',
    title: 'Hit 3 blots',
    description: 'In lessons, drills or games.',
    icon: 'sword-cross',
    target: 3,
    xp: 40,
    action: { kind: 'practice', category: 'hitting' },
    progressFor: (event) => (event.type === 'hit' ? 1 : 0),
    available: (context) => context.unlockedDrills.includes('hitting'),
  },
  {
    id: 'win-game',
    title: 'Win a game against the computer',
    description: 'Any level counts.',
    icon: 'trophy',
    target: 1,
    xp: 60,
    action: { kind: 'play' },
    progressFor: (event) => (event.type === 'game-won' ? 1 : 0),
    available: (context) => context.playUnlocked,
  },
  {
    id: 'fix-mistakes',
    title: 'Fix 3 of your mistakes',
    description: 'Replay positions you got wrong in your games.',
    icon: 'auto-fix',
    target: 3,
    xp: 50,
    action: { kind: 'practice', category: 'mistakes' },
    progressFor: (event) => (event.type === 'mistake-fixed' ? 1 : 0),
    available: (context) => context.canPracticeMistakes && context.openMistakes >= 3,
  },
  ...(['hitting', 'safety', 'points', 'bear-off', 'race', 'opening'] as const).map(drillChallenge),
];

export function getChallenge(id: string): ChallengeDefinition | undefined {
  return CHALLENGES.find((challenge) => challenge.id === id);
}

function hashDay(day: string): number {
  let hash = 2166136261;
  for (const char of day) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

/** Today's challenge, picked deterministically from those the learner can do. */
export function challengeForDay(day: string, context: ChallengeContext): ChallengeDefinition {
  const available = CHALLENGES.filter((challenge) => challenge.available(context));
  return available[hashDay(day) % available.length];
}

export interface DailyChallengeState {
  day: string;
  id: string;
  progress: number;
  completedAt: string | null;
}

export function startDaily(day: string, context: ChallengeContext): DailyChallengeState {
  return { day, id: challengeForDay(day, context).id, progress: 0, completedAt: null };
}

/** Applies an event; `completed` is true only on the event that finishes the challenge. */
export function applyChallengeEvent(
  state: DailyChallengeState,
  event: ChallengeEvent,
  now: string,
): { state: DailyChallengeState; completed: boolean } {
  const definition = getChallenge(state.id);
  if (!definition || state.completedAt) return { state, completed: false };
  const gained = definition.progressFor(event);
  if (gained <= 0) return { state, completed: false };
  const progress = Math.min(definition.target, state.progress + gained);
  const completed = progress >= definition.target;
  return { state: { ...state, progress, completedAt: completed ? now : null }, completed };
}
