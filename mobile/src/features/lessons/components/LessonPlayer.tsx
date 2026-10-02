import { useReducer, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { isScored, type Lesson, type LessonStep } from '@/curriculum';
import { categoryResultsFor, type LessonReward } from '@/features/learning/progressModel';
import {
  lessonSessionReducer,
  startSession,
  summarizeSession,
  type LessonOutcome,
} from '@/features/lessons/engine/session';
import { useProgressStore } from '@/state/progressStore';
import { colors, MAX_CONTENT_WIDTH, SCREEN_GUTTER, spacing } from '@/theme';

import { FeedbackPanel, praise, type Feedback } from './FeedbackPanel';
import { LessonComplete } from './LessonComplete';
import { ChoiceStepView } from './steps/ChoiceStepView';
import { CubeStepView } from './steps/CubeStepView';
import { DemoStepView } from './steps/DemoStepView';
import { ExplainStepView } from './steps/ExplainStepView';
import { MoveStepView } from './steps/MoveStepView';
import { TapStepView } from './steps/TapStepView';

type PlayerStatus = 'active' | 'correct' | 'wrong' | 'showing';

interface LessonPlayerProps {
  lesson: Lesson;
  onExit: () => void;
  onNextLesson?: (lessonId: string) => void;
}

export function LessonPlayer({ lesson, onExit, onNextLesson }: LessonPlayerProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const boardWidth = Math.min(width, MAX_CONTENT_WIDTH);
  const [session, dispatch] = useReducer(lessonSessionReducer, lesson.id, (id) => startSession(id));
  const [status, setStatus] = useState<PlayerStatus>('active');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [confirmExit, setConfirmExit] = useState(false);
  const [result, setResult] = useState<{ outcome: LessonOutcome; reward: LessonReward } | null>(null);
  const recordLessonResult = useProgressStore((state) => state.recordLessonResult);

  const step = lesson.steps[session.stepIndex];
  const mistakes = session.outcomes[step.id]?.mistakes ?? 0;
  const done = status === 'correct' || (status === 'wrong' && step.kind === 'choice') || !isScored(step);
  const progress = (session.stepIndex + (done && status !== 'active' ? 1 : 0)) / lesson.steps.length;

  const handleResult = (correct: boolean, message: string) => {
    const wasShowing = status === 'showing';
    dispatch({ type: 'answer', stepId: step.id, correct });
    setStatus(correct ? 'correct' : 'wrong');
    setFeedback({
      tone: correct ? 'correct' : 'wrong',
      title: correct ? (wasShowing ? 'Here’s how' : praise(session.stepIndex + attempt)) : 'Not quite',
      message,
    });
  };

  const restart = () => {
    dispatch({ type: 'restart' });
    setStatus('active');
    setFeedback(null);
    setAttempt(0);
    setResult(null);
  };

  const next = () => {
    const isLast = session.stepIndex >= lesson.steps.length - 1;
    if (isLast) {
      const finished = lessonSessionReducer(session, { type: 'next', totalSteps: lesson.steps.length });
      const outcome = summarizeSession(lesson, finished);
      const reward = recordLessonResult(lesson.id, outcome, categoryResultsFor(lesson, finished.outcomes));
      setResult({ outcome, reward });
      return;
    }
    dispatch({ type: 'next', totalSteps: lesson.steps.length });
    setStatus('active');
    setFeedback(null);
    setAttempt(0);
  };

  const retry = () => {
    setStatus('active');
    setFeedback(null);
    setAttempt((value) => value + 1);
  };

  const showMe = () => {
    dispatch({ type: 'reveal', stepId: step.id });
    setFeedback(null);
    setStatus('showing');
  };

  if (result) {
    return (
      <LessonComplete
        lesson={lesson}
        outcome={result.outcome}
        reward={result.reward}
        onContinue={onExit}
        onRetry={restart}
        onNextLesson={onNextLesson}
      />
    );
  }

  const stepStatus = status === 'showing' ? 'active' : status;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <IconButton
          testID="lesson-close"
          icon="close"
          accessibilityLabel="Quit lesson"
          onPress={() => setConfirmExit(true)}
        />
        <View style={styles.progress}>
          <ProgressBar progress={progress} color={colors.success} height={14} accessibilityLabel="Lesson progress" />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 260 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          {renderStep(step, {
            key: `${step.id}-${attempt}`,
            boardWidth,
            status: stepStatus,
            rawStatus: status,
            mistakes,
            onResult: handleResult,
          })}
        </View>
      </ScrollView>

      {feedback ? (
        <FeedbackPanel
          feedback={feedback}
          onContinue={next}
          onRetry={step.kind === 'choice' || step.kind === 'cube' ? undefined : retry}
          onShowMe={step.kind === 'move' ? showMe : undefined}
        />
      ) : !isScored(step) ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <Button testID="lesson-continue" label="Continue" onPress={next} />
        </View>
      ) : null}

      <ConfirmDialog
        visible={confirmExit}
        title="Leave this lesson?"
        message="You’ll lose your progress in this lesson. It only takes a couple of minutes to finish."
        confirmLabel="Leave lesson"
        cancelLabel="Keep learning"
        destructive
        onCancel={() => setConfirmExit(false)}
        onConfirm={() => {
          setConfirmExit(false);
          onExit();
        }}
      />
    </View>
  );
}

function renderStep(
  step: LessonStep,
  props: {
    key: string;
    boardWidth: number;
    status: 'active' | 'correct' | 'wrong';
    rawStatus: PlayerStatus;
    mistakes: number;
    onResult: (correct: boolean, message: string) => void;
  },
) {
  const { key, rawStatus, ...common } = props;
  switch (step.kind) {
    case 'explain':
      return <ExplainStepView key={key} step={step} boardWidth={props.boardWidth} />;
    case 'demo':
      return <DemoStepView key={key} step={step} boardWidth={props.boardWidth} />;
    case 'tap':
      return <TapStepView key={key} step={step} {...common} />;
    case 'move':
      return <MoveStepView key={key} step={step} {...common} status={rawStatus === 'showing' ? 'showing' : common.status} />;
    case 'choice':
      return <ChoiceStepView key={key} step={step} {...common} />;
    case 'cube':
      return <CubeStepView key={key} step={step} {...common} />;
    case 'challenge':
      return null;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingRight: SCREEN_GUTTER,
    height: 56,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  progress: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingTop: spacing.sm },
  inner: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SCREEN_GUTTER,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
