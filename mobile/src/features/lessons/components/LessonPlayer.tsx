import { useEffect, useState } from 'react';

import { getSection, type Lesson } from '@/curriculum';
import { reportChallengeEvent } from '@/features/challenges/challengeService';
import { skillResultsFor, type LessonReward } from '@/features/learning/progressModel';
import { exerciseXp } from '@/features/learning/progression';
import { summarizeSession, type LessonOutcome } from '@/features/lessons/engine/session';
import { useFeatureAccess } from '@/features/monetization/useFeatureAccess';
import { analytics, type LaunchSource } from '@/services/analytics';
import { useCelebrationStore } from '@/state/celebrationStore';
import { useProgressStore } from '@/state/progressStore';

import { LessonComplete } from './LessonComplete';
import { StepSessionPlayer } from './StepSessionPlayer';

interface LessonPlayerProps {
  lesson: Lesson;
  /** Where the lesson was opened from (analytics). */
  source?: LaunchSource;
  onExit: () => void;
  onNextLesson?: (lessonId: string) => void;
}

/** Plays a lesson and records the result (XP, stars, unlocks) when it ends. */
export function LessonPlayer({ lesson, source, onExit, onNextLesson }: LessonPlayerProps) {
  const recordLessonResult = useProgressStore((state) => state.recordLessonResult);
  const canAccess = useFeatureAccess().canAccessLesson;
  // Replays of finished lessons earn practice XP at half rate.
  const replay = useProgressStore((state) => !!state.lessons[lesson.id]?.completed);
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<{ outcome: LessonOutcome; reward: LessonReward } | null>(null);

  useEffect(() => {
    analytics.track('lesson_started', { lesson_id: lesson.id, section_id: lesson.sectionId, replay, source });
    // Once per run of the lesson.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, lesson.id]);

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
      onExit={(progress) => {
        analytics.track('lesson_exited', { lesson_id: lesson.id, step_index: progress.stepIndex, steps: progress.steps });
        onExit();
      }}
      xpForStep={(outcome) => exerciseXp(outcome, replay)}
      onFinish={(session) => {
        const outcome = summarizeSession(lesson, session);
        const reward = recordLessonResult(
          lesson.id,
          outcome,
          skillResultsFor(lesson.steps, session.outcomes, lesson),
          session.outcomes,
          canAccess,
        );
        if (outcome.passed) {
          analytics.track('lesson_completed', {
            lesson_id: lesson.id,
            section_id: lesson.sectionId,
            stars: outcome.stars,
            accuracy: outcome.accuracy,
            duration_ms: outcome.durationMs,
            xp: reward.xpGained,
            replay,
            retry_count: outcome.mistakes,
            source,
          });
          if (source === 'coach_pick') analytics.track('coach_pick_completed', { kind: 'lesson' });
          reportChallengeEvent({ type: 'lesson-completed', stars: outcome.stars });
        } else {
          analytics.track('lesson_failed', {
            lesson_id: lesson.id,
            section_id: lesson.sectionId,
            accuracy: outcome.accuracy,
            duration_ms: outcome.durationMs,
            retry_count: outcome.mistakes,
          });
        }
        const unlocked = reward.unlockedLessons[0];
        if (unlocked) {
          useCelebrationStore.getState().queueUnlock(unlocked.id);
          const section = getSection(unlocked.sectionId);
          if (section?.lessons[0]?.id === unlocked.id) analytics.track('section_unlocked', { section_id: section.id });
        }
        setResult({ outcome, reward });
      }}
    />
  );
}
