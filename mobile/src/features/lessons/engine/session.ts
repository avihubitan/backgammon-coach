import { isScored, type Lesson } from '@/curriculum';

/**
 * Pure state for one run through a lesson. The lesson player dispatches
 * answers; scoring and star rules live here so they can be unit tested.
 */
export interface StepOutcome {
  /** Wrong attempts made on this step. */
  mistakes: number;
  /** The learner reached the right answer (possibly after mistakes). */
  solved: boolean;
  /** The answer was demonstrated before the learner solved it. */
  revealed: boolean;
}

export interface LessonSessionState {
  lessonId: string;
  stepIndex: number;
  outcomes: Record<string, StepOutcome>;
  startedAt: number;
  finishedAt: number | null;
}

export type LessonSessionAction =
  | { type: 'answer'; stepId: string; correct: boolean }
  | { type: 'reveal'; stepId: string }
  | { type: 'next'; totalSteps: number; now?: number }
  | { type: 'restart'; now?: number };

export function startSession(lessonId: string, now = Date.now()): LessonSessionState {
  return { lessonId, stepIndex: 0, outcomes: {}, startedAt: now, finishedAt: null };
}

const EMPTY_OUTCOME: StepOutcome = { mistakes: 0, solved: false, revealed: false };

export function lessonSessionReducer(
  state: LessonSessionState,
  action: LessonSessionAction,
): LessonSessionState {
  switch (action.type) {
    case 'answer': {
      const previous = state.outcomes[action.stepId] ?? EMPTY_OUTCOME;
      if (previous.solved) return state;
      const next: StepOutcome = action.correct
        ? { ...previous, solved: true }
        : { ...previous, mistakes: previous.mistakes + 1 };
      return { ...state, outcomes: { ...state.outcomes, [action.stepId]: next } };
    }
    case 'reveal': {
      const previous = state.outcomes[action.stepId] ?? EMPTY_OUTCOME;
      if (previous.solved) return state;
      return {
        ...state,
        outcomes: { ...state.outcomes, [action.stepId]: { ...previous, revealed: true } },
      };
    }
    case 'next': {
      const last = state.stepIndex >= action.totalSteps - 1;
      if (last) return { ...state, finishedAt: state.finishedAt ?? action.now ?? Date.now() };
      return { ...state, stepIndex: state.stepIndex + 1 };
    }
    case 'restart':
      return startSession(state.lessonId, action.now);
  }
}

/** 1 for first-try answers, 0.5 when solved after a mistake, 0 if revealed or never solved. */
export function stepScore(outcome: StepOutcome | undefined): number {
  if (!outcome || !outcome.solved || outcome.revealed) return 0;
  return outcome.mistakes === 0 ? 1 : 0.5;
}

export interface LessonOutcome {
  accuracy: number;
  stars: 0 | 1 | 2 | 3;
  passed: boolean;
  scoredSteps: number;
  firstTryCorrect: number;
  mistakes: number;
  durationMs: number;
}

export function starsForAccuracy(accuracy: number): 1 | 2 | 3 {
  if (accuracy >= 0.9) return 3;
  if (accuracy >= 0.65) return 2;
  return 1;
}

export function summarizeSession(lesson: Lesson, state: LessonSessionState): LessonOutcome {
  const scored = lesson.steps.filter(isScored);
  const total = scored.reduce((sum, step) => sum + stepScore(state.outcomes[step.id]), 0);
  const accuracy = scored.length === 0 ? 1 : total / scored.length;
  const passed = accuracy + 1e-9 >= lesson.passingScore;
  return {
    accuracy,
    stars: passed ? starsForAccuracy(accuracy) : 0,
    passed,
    scoredSteps: scored.length,
    firstTryCorrect: scored.filter((step) => stepScore(state.outcomes[step.id]) === 1).length,
    mistakes: scored.reduce((sum, step) => sum + (state.outcomes[step.id]?.mistakes ?? 0), 0),
    durationMs: (state.finishedAt ?? Date.now()) - state.startedAt,
  };
}
