import type { Lesson } from '@/curriculum';

import {
  lessonSessionReducer,
  starsForAccuracy,
  startSession,
  stepScore,
  summarizeSession,
  type LessonSessionState,
} from '../engine/session';

const lesson: Lesson = {
  id: 'test-lesson',
  sectionId: 'test',
  title: 'Test',
  description: '',
  icon: 'star',
  difficulty: 1,
  skill: 'board',
  purpose: { outcome: 'Test', requires: [], shows: 'intro', decision: 'q2', inGame: 'Test' },
  objectives: [],
  passingScore: 0.5,
  xp: 10,
  steps: [
    { id: 'intro', kind: 'explain', text: 'Hello' },
    {
      id: 'q1',
      kind: 'choice',
      prompt: 'Q1',
      options: [
        { id: 'a', text: 'A', correct: true, explanation: '' },
        { id: 'b', text: 'B', explanation: '' },
      ],
    },
    {
      id: 'q2',
      kind: 'tap',
      prompt: 'Q2',
      board: { position: {} },
      answers: [{ kind: 'bar' }],
      correct: '',
      wrong: '',
    },
  ],
};

const run = (actions: Parameters<typeof lessonSessionReducer>[1][]): LessonSessionState =>
  actions.reduce(lessonSessionReducer, startSession(lesson.id, 0));

describe('lesson session', () => {
  it('scores first-try answers as full credit', () => {
    const state = run([
      { type: 'answer', stepId: 'q1', correct: true },
      { type: 'answer', stepId: 'q2', correct: true },
    ]);
    const summary = summarizeSession(lesson, state);
    expect(summary.accuracy).toBe(1);
    expect(summary.stars).toBe(3);
    expect(summary.passed).toBe(true);
    expect(summary.firstTryCorrect).toBe(2);
  });

  it('gives half credit after a mistake', () => {
    const state = run([
      { type: 'answer', stepId: 'q1', correct: false },
      { type: 'answer', stepId: 'q1', correct: true },
      { type: 'answer', stepId: 'q2', correct: true },
    ]);
    expect(stepScore(state.outcomes.q1)).toBe(0.5);
    expect(summarizeSession(lesson, state).accuracy).toBe(0.75);
    expect(summarizeSession(lesson, state).mistakes).toBe(1);
  });

  it('gives no credit when the answer was revealed', () => {
    const state = run([
      { type: 'answer', stepId: 'q1', correct: false },
      { type: 'reveal', stepId: 'q1' },
      { type: 'answer', stepId: 'q1', correct: true },
    ]);
    expect(stepScore(state.outcomes.q1)).toBe(0);
  });

  it('ignores answers after a step is solved', () => {
    const state = run([
      { type: 'answer', stepId: 'q1', correct: true },
      { type: 'answer', stepId: 'q1', correct: false },
    ]);
    expect(state.outcomes.q1).toEqual({ mistakes: 0, solved: true, revealed: false });
  });

  it('fails a lesson below the passing score with zero stars', () => {
    const state = run([
      { type: 'answer', stepId: 'q1', correct: false },
      { type: 'answer', stepId: 'q2', correct: false },
    ]);
    const summary = summarizeSession(lesson, state);
    expect(summary.passed).toBe(false);
    expect(summary.stars).toBe(0);
  });

  it('advances through steps and records when it finished', () => {
    let state = startSession(lesson.id, 0);
    state = lessonSessionReducer(state, { type: 'next', totalSteps: 3 });
    state = lessonSessionReducer(state, { type: 'next', totalSteps: 3 });
    expect(state.stepIndex).toBe(2);
    expect(state.finishedAt).toBeNull();
    state = lessonSessionReducer(state, { type: 'next', totalSteps: 3, now: 5000 });
    expect(state.finishedAt).toBe(5000);
    expect(summarizeSession(lesson, state).durationMs).toBe(5000);
  });

  it('maps accuracy to stars', () => {
    expect(starsForAccuracy(1)).toBe(3);
    expect(starsForAccuracy(0.9)).toBe(3);
    expect(starsForAccuracy(0.7)).toBe(2);
    expect(starsForAccuracy(0.2)).toBe(1);
  });
});
