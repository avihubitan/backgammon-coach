import { useState } from 'react';

import type { Lesson } from '@/curriculum';
import { categoryResultsFor, type LessonReward } from '@/features/learning/progressModel';
import { summarizeSession, type LessonOutcome } from '@/features/lessons/engine/session';
import { useProgressStore } from '@/state/progressStore';

import { LessonComplete } from './LessonComplete';
import { StepSessionPlayer } from './StepSessionPlayer';

interface LessonPlayerProps {
  lesson: Lesson;
  onExit: () => void;
  onNextLesson?: (lessonId: string) => void;
}

/** Plays a lesson and records the result (XP, stars, unlocks) when it ends. */
export function LessonPlayer({ lesson, onExit, onNextLesson }: LessonPlayerProps) {
  const recordLessonResult = useProgressStore((state) => state.recordLessonResult);
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<{ outcome: LessonOutcome; reward: LessonReward } | null>(null);

  if (result) {
    return (
      <LessonComplete
        lesson={lesson}
        outcome={result.outcome}
        reward={result.reward}
        onContinue={onExit}
        onRetry={() => {
          setResult(null);
          setRun((value) => value + 1);
        }}
        onNextLesson={onNextLesson}
      />
    );
  }

  return (
    <StepSessionPlayer
      key={run}
      sessionId={lesson.id}
      steps={lesson.steps}
      onExit={onExit}
      onFinish={(session) => {
        const outcome = summarizeSession(lesson, session);
        const reward = recordLessonResult(lesson.id, outcome, categoryResultsFor(lesson, session.outcomes));
        setResult({ outcome, reward });
      }}
    />
  );
}
