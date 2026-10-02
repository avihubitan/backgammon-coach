import { useState } from 'react';

import type { Lesson } from '@/curriculum';
import { reportChallengeEvent } from '@/features/challenges/challengeService';
import { categoryResultsFor, type LessonReward } from '@/features/learning/progressModel';
import { exerciseXp } from '@/features/learning/progression';
import { summarizeSession, type LessonOutcome } from '@/features/lessons/engine/session';
import { useCelebrationStore } from '@/state/celebrationStore';
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
  // Replays of finished lessons earn practice XP at half rate.
  const replay = useProgressStore((state) => !!state.lessons[lesson.id]?.completed);
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
      xpForStep={(outcome) => exerciseXp(outcome, replay)}
      onFinish={(session) => {
        const outcome = summarizeSession(lesson, session);
        const reward = recordLessonResult(
          lesson.id,
          outcome,
          categoryResultsFor(lesson, session.outcomes),
          session.outcomes,
        );
        if (outcome.passed) reportChallengeEvent({ type: 'lesson-completed', stars: outcome.stars });
        const unlocked = reward.unlockedLessons[0];
        if (unlocked) useCelebrationStore.getState().queueUnlock(unlocked.id);
        setResult({ outcome, reward });
      }}
    />
  );
}
