import { useReducer, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FlyingXp, type ScreenPoint } from '@/components/fx/FlyingXp';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { XpPill } from '@/components/ui/XpPill';
import { isScored, type LessonStep } from '@/curriculum';
import {
  lessonSessionReducer,
  startSession,
  type LessonSessionState,
  type StepOutcome,
} from '@/features/lessons/engine/session';
import { feedback as gameFeedback } from '@/services/feedback';
import { colors, MAX_CONTENT_WIDTH, SCREEN_GUTTER, spacing } from '@/theme';

import { FeedbackPanel, praise, type Feedback } from './FeedbackPanel';
import { ChallengeStepView } from './steps/ChallengeStepView';
import { ChoiceStepView } from './steps/ChoiceStepView';
import { CubeStepView } from './steps/CubeStepView';
import { DemoStepView } from './steps/DemoStepView';
import { ExplainStepView } from './steps/ExplainStepView';
import { MoveStepView } from './steps/MoveStepView';
import { TapStepView } from './steps/TapStepView';

type PlayerStatus = 'active' | 'correct' | 'wrong' | 'showing';

interface StepSessionPlayerProps {
  sessionId: string;
  steps: LessonStep[];
  /** Called once with the finished session (after the last step). */
  onFinish: (session: LessonSessionState) => void;
  onExit: () => void;
  /** Called for every answer (practice uses it to track individual items). */
  onAnswer?: (step: LessonStep, correct: boolean, firstTry: boolean) => void;
  /** XP a solved step earns; when set, the player shows an XP counter and flying rewards. */
  xpForStep?: (outcome: StepOutcome) => number;
  exitTitle?: string;
  exitMessage?: string;
}

interface XpFlight {
  id: number;
  amount: number;
  from: ScreenPoint;
  to: ScreenPoint;
}

/**
 * Runs a sequence of lesson steps: renders each step, shows feedback, handles
 * retries and "show me". Lessons and practice sessions both use it.
 */
export function StepSessionPlayer({
  sessionId,
  steps,
  onFinish,
  onExit,
  onAnswer,
  xpForStep,
  exitTitle = 'Leave this lesson?',
  exitMessage = 'You’ll lose your progress in this lesson. It only takes a couple of minutes to finish.',
}: StepSessionPlayerProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const boardWidth = Math.min(width, MAX_CONTENT_WIDTH);
  const [session, dispatch] = useReducer(lessonSessionReducer, sessionId, (id) => startSession(id));
  const [status, setStatus] = useState<PlayerStatus>('active');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [confirmExit, setConfirmExit] = useState(false);
  const [combo, setCombo] = useState(0);
  const [shownXp, setShownXp] = useState(0);
  const [xpBump, setXpBump] = useState(0);
  const [flights, setFlights] = useState<XpFlight[]>([]);
  const pillRef = useRef<View>(null);
  const flightId = useRef(0);

  const step = steps[session.stepIndex];
  const mistakes = session.outcomes[step.id]?.mistakes ?? 0;
  const done = status === 'correct' || (status === 'wrong' && (step.kind === 'choice' || step.kind === 'cube')) || !isScored(step);
  const progress = (session.stepIndex + (done && status !== 'active' ? 1 : 0)) / steps.length;

  const handleResult = (correct: boolean, message: string) => {
    const wasShowing = status === 'showing';
    const previous = session.outcomes[step.id];
    const updated = lessonSessionReducer(session, { type: 'answer', stepId: step.id, correct });
    dispatch({ type: 'answer', stepId: step.id, correct });
    const firstTry = !previous && correct && !wasShowing;
    onAnswer?.(step, correct, firstTry);
    const nextCombo = firstTry ? combo + 1 : correct ? combo : 0;
    setCombo(nextCombo);
    if (correct && !wasShowing) gameFeedback.success();
    if (!correct) gameFeedback.error();
    const outcome = updated.outcomes[step.id];
    const xp = correct && xpForStep && outcome ? xpForStep(outcome) : 0;
    setStatus(correct ? 'correct' : 'wrong');
    setFeedback({
      tone: correct ? 'correct' : 'wrong',
      title: correct
        ? wasShowing
          ? 'Here’s how'
          : nextCombo >= 3
            ? `${nextCombo} in a row!`
            : praise(session.stepIndex + attempt)
        : 'Not quite',
      message,
      xp,
    });
  };

  const launchXp = (from: ScreenPoint) => {
    const amount = feedback?.xp ?? 0;
    if (amount <= 0) return;
    pillRef.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0) {
        setShownXp((value) => value + amount);
        return;
      }
      flightId.current += 1;
      const flight = { id: flightId.current, amount, from, to: { x: x + width / 2, y: y + height / 2 } };
      setFlights((list) => [...list, flight]);
    });
  };

  const landXp = (flight: XpFlight) => {
    setFlights((list) => list.filter((candidate) => candidate.id !== flight.id));
    setShownXp((value) => value + flight.amount);
    setXpBump((value) => value + 1);
    gameFeedback.xp();
  };

  const next = () => {
    if (session.stepIndex >= steps.length - 1) {
      onFinish(lessonSessionReducer(session, { type: 'next', totalSteps: steps.length }));
      return;
    }
    dispatch({ type: 'next', totalSteps: steps.length });
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

  const stepStatus = status === 'showing' ? 'active' : status;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <IconButton testID="lesson-close" icon="close" accessibilityLabel="Quit" onPress={() => setConfirmExit(true)} />
        <View style={styles.progress}>
          <ProgressBar progress={progress} color={colors.success} height={14} accessibilityLabel="Progress" />
        </View>
        {xpForStep ? <XpPill ref={pillRef} value={shownXp} bumpKey={xpBump} testID="session-xp" /> : null}
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
          key={`${step.id}-${attempt}-${feedback.tone}`}
          feedback={feedback}
          onXpLaunch={launchXp}
          onContinue={next}
          onRetry={step.kind === 'choice' || step.kind === 'cube' ? undefined : retry}
          onShowMe={step.kind === 'move' ? showMe : undefined}
        />
      ) : !isScored(step) ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <Button testID="lesson-continue" label="Continue" onPress={next} />
        </View>
      ) : null}

      <View pointerEvents="none" style={styles.fxLayer}>
        {flights.map((flight) => (
          <FlyingXp key={flight.id} from={flight.from} to={flight.to} amount={flight.amount} onArrive={() => landXp(flight)} />
        ))}
      </View>

      <ConfirmDialog
        visible={confirmExit}
        title={exitTitle}
        message={exitMessage}
        confirmLabel="Leave"
        cancelLabel="Keep going"
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
      return <ChallengeStepView key={key} step={step} {...common} />;
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
  fxLayer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 200 },
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
