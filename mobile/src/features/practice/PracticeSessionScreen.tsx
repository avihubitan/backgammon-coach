import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { curriculum } from '@/curriculum';
import { DRILL_CATEGORIES, type DrillCategory } from '@/curriculum/drills';
import { reportChallengeEvent } from '@/features/challenges/challengeService';
import { exerciseXp } from '@/features/learning/progression';
import { useFeatureAccess } from '@/features/monetization/useFeatureAccess';
import { analytics } from '@/services/analytics';
import type { Reward } from '@/features/learning/progressModel';
import { StepSessionPlayer } from '@/features/lessons/components/StepSessionPlayer';
import { summarizeSteps, type LessonOutcome } from '@/features/lessons/engine/session';
import { useMistakesStore } from '@/state/mistakesStore';
import { usePracticeStore, type PracticeKind } from '@/state/practiceStore';
import { useProgressStore } from '@/state/progressStore';
import { colors, SCREEN_GUTTER, spacing } from '@/theme';

import { isMastered, pickForPractice } from './mistakes';
import { PracticeComplete } from './PracticeComplete';
import {
  buildDrillSession,
  buildMistakeSession,
  SESSION_LENGTH,
  unlockedDrillCategories,
  type PracticeSession,
} from './practiceModel';

const isDrill = (kind: string): kind is DrillCategory => DRILL_CATEGORIES.some((info) => info.id === kind);

/** Practice earns XP at the replay rate: steady, but never faster than new lessons. */
const practiceXp = (outcome: Parameters<typeof exerciseXp>[0]) => exerciseXp(outcome, true);

function buildSession(kind: PracticeKind, seed: number): PracticeSession | null {
  if (kind === 'mistakes') {
    const picks = pickForPractice(useMistakesStore.getState().mistakes, SESSION_LENGTH);
    return picks.length > 0 ? buildMistakeSession(picks) : null;
  }
  return buildDrillSession(kind, seed);
}

export interface PracticeResult {
  outcome: LessonOutcome;
  reward: Reward;
  xp: number;
  mastered: number;
}

/** A short practice run: five drills from one skill, or positions from your own games. */
export function PracticeSessionScreen({ kind }: { kind: string }) {
  const insets = useSafeAreaInsets();
  const lessons = useProgressStore((state) => state.lessons);
  const canPracticeMistakes = useFeatureAccess().canUseAdvancedTraining();
  const valid = kind === 'mistakes' || isDrill(kind);
  const unlocked =
    kind === 'mistakes'
      ? canPracticeMistakes
      : unlockedDrillCategories(lessons, curriculum).some((info) => info.id === kind);
  const [run, setRun] = useState(() => ({ id: 0, session: valid && unlocked ? buildSession(kind as PracticeKind, Date.now()) : null }));
  const [result, setResult] = useState<PracticeResult | null>(null);
  const answered = useRef(new Set<string>());

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/practice');
  };

  const again = () => {
    answered.current = new Set();
    setResult(null);
    setRun((previous) => ({ id: previous.id + 1, session: buildSession(kind as PracticeKind, Date.now()) }));
  };

  if (kind === 'mistakes' && !canPracticeMistakes) {
    return (
      <View style={[styles.blocked, { paddingTop: insets.top + spacing.huge }]} testID="practice-premium">
        <Icon name="crown" size={48} color={colors.primary} />
        <AppText variant="title" align="center">
          Practise your own mistakes
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          Positions you got wrong in your games come back until you get them right. It’s part of Premium; your
          mistakes are saved either way.
        </AppText>
        <Button label="See Premium" icon="crown" onPress={() => router.replace({ pathname: '/paywall', params: { source: 'mistakes' } })} />
        <Button label="Not now" variant="ghost" size="medium" onPress={leave} />
      </View>
    );
  }

  if (!valid || !unlocked || !run.session) {
    const info = DRILL_CATEGORIES.find((entry) => entry.id === kind);
    const section = curriculum.find((entry) => entry.id === info?.requiresSection);
    return (
      <View style={[styles.blocked, { paddingTop: insets.top + spacing.huge }]} testID="practice-unavailable">
        <Icon name={kind === 'mistakes' ? 'check-decagram' : 'lock'} size={48} color={colors.textMuted} />
        <AppText variant="title" align="center">
          {!valid
            ? 'Practice not found'
            : kind === 'mistakes'
              ? 'No mistakes to practise'
              : 'This drill is locked'}
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          {!valid
            ? 'It may have moved in an update.'
            : kind === 'mistakes'
              ? 'Play a game and review it: positions you got wrong are collected here so you can fix them.'
              : `Finish “${section?.title ?? 'the previous section'}” on your path to unlock it.`}
        </AppText>
        <Button label="Back to practice" onPress={() => router.replace('/practice')} />
      </View>
    );
  }

  const session = run.session;

  if (result) {
    return (
      <PracticeComplete
        title={session.title}
        kind={kind as PracticeKind}
        result={result}
        onAgain={again}
        onDone={leave}
      />
    );
  }

  return (
    <StepSessionPlayer
      key={run.id}
      sessionId={session.id}
      steps={session.steps}
      xpForStep={practiceXp}
      kind="practice"
      exitTitle="Leave this practice?"
      exitMessage="This session won’t count, but nothing else is lost."
      onExit={leave}
      onAnswer={(step, correct) => {
        // Mistakes count as fixed when you find the move on your first attempt.
        if (kind !== 'mistakes' || answered.current.has(step.id)) return;
        answered.current.add(step.id);
        useMistakesStore.getState().recordAttempt(step.id, correct);
        if (correct) reportChallengeEvent({ type: 'mistake-fixed' });
      }}
      onFinish={(state) => {
        const outcome = summarizeSteps(session.steps, 0, state);
        const xp = session.steps.reduce((sum, step) => sum + practiceXp(state.outcomes[step.id] ?? EMPTY), 0);
        const progress = useProgressStore.getState();
        const reward = progress.awardXp(xp);
        progress.recordPracticeSession();
        usePracticeStore.getState().recordSession(kind as PracticeKind, outcome.firstTryCorrect);
        reportChallengeEvent({ type: 'practice-session', category: kind as PracticeKind });
        analytics.track('practice_session_completed', {
          kind,
          steps: outcome.scoredSteps,
          first_try: outcome.firstTryCorrect,
          xp,
        });
        const saved = useMistakesStore.getState().mistakes;
        const mastered =
          kind === 'mistakes'
            ? session.steps.filter((step) => saved.some((mistake) => mistake.id === step.id && isMastered(mistake))).length
            : 0;
        setResult({ outcome, reward, xp, mastered });
      }}
    />
  );
}

const EMPTY = { mistakes: 0, solved: false, revealed: false };

const styles = StyleSheet.create({
  blocked: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: SCREEN_GUTTER,
  },
});
