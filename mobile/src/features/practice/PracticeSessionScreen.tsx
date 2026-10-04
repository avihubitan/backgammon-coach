import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { getLesson } from '@/curriculum';
import { DRILL_CATEGORIES, getDrillCategory, type DrillCategory } from '@/curriculum/drills';
import { reportChallengeEvent } from '@/features/challenges/challengeService';
import {
  anotherLike,
  dailyPosition,
  parseRef,
  positionSteps,
  refKey,
  skillOfRef,
  type PositionRef,
} from '@/features/coach/positionOfTheDay';
import { exerciseXp, MISTAKE_MASTERED_XP, repeatFactor } from '@/features/learning/progression';
import { skillResultsFor, type Reward } from '@/features/learning/progressModel';
import { StepSessionPlayer } from '@/features/lessons/components/StepSessionPlayer';
import { summarizeSteps, type LessonOutcome } from '@/features/lessons/engine/session';
import { currentFeatureAccess, useFeatureAccess } from '@/features/monetization/useFeatureAccess';
import { skillOfDrill } from '@/features/skills/extract';
import type { MasteryUp } from '@/features/skills/mastery';
import { currentMasteryLevels, settleMastery } from '@/features/skills/masteryService';
import { analytics, type LaunchSource } from '@/services/analytics';
import { useDailyPositionStore } from '@/state/dailyPositionStore';
import { useMistakesStore } from '@/state/mistakesStore';
import { roundsOn, usePracticeStore, type PracticeKind } from '@/state/practiceStore';
import { todayKey, useProgressStore } from '@/state/progressStore';
import { colors, SCREEN_GUTTER, spacing } from '@/theme';

import { levelProgress, type LevelProgress } from './drillLevels';
import { dueIn, isMastered, nextDueDay, pickForPractice, withFocus } from './mistakes';
import { PracticeComplete } from './PracticeComplete';
import {
  buildDrillSession,
  buildMistakeSession,
  SESSION_LENGTH,
  unlockedDrillCategories,
  type PracticeSession,
} from './practiceModel';

const isDrill = (kind: string): kind is DrillCategory => DRILL_CATEGORIES.some((info) => info.id === kind);

/**
 * Practice earns XP at the replay rate (steady, but never faster than new
 * lessons), and less once the same practice has been played three times today.
 */
const practiceXp = (outcome: Parameters<typeof exerciseXp>[0], factor: number) => exerciseXp(outcome, true, factor);

/**
 * Where a run starts from: each skill's level and the mistakes already fixed
 * (to see what the run changes), and how many rounds of this practice were
 * played today.
 */
function runStart(kind: string) {
  return {
    mastery: currentMasteryLevels(),
    fixed: new Set(useMistakesStore.getState().mistakes.filter(isMastered).map((mistake) => mistake.id)),
    rounds: roundsOn(usePracticeStore.getState().records[kind as PracticeKind], todayKey()),
  };
}

const DAILY_TITLE = 'Position of the Day';
const MORE_TITLE = 'One more position';

/** A "What would you play?" session for one position (null when it can't be shown). */
function buildPosition(ref: PositionRef | null, title: string): PracticeSession | null {
  if (!ref) return null;
  const steps = positionSteps(ref, useMistakesStore.getState().mistakes, title);
  return steps ? { id: `position-${refKey(ref)}`, title, category: 'position', steps, levelOf: {}, ref } : null;
}

/** Today's position: the one shown today already, else a fresh pick (the screen remembers it once mounted). */
function dailyRef(): PositionRef | null {
  const progress = useProgressStore.getState();
  return dailyPosition({
    day: todayKey(),
    stored: useDailyPositionStore.getState(),
    mistakes: useMistakesStore.getState().mistakes,
    lessons: progress.lessons,
    bySkill: progress.stats.bySkill,
    reviewQueue: currentFeatureAccess().canUseAdvancedTraining(),
  });
}

/** Another position with the same idea as `ref`, not one seen today. */
function nextLike(ref: PositionRef | undefined): PositionRef | null {
  if (!ref) return null;
  const skill = skillOfRef(ref, useMistakesStore.getState().mistakes);
  const daily = useDailyPositionStore.getState();
  const seen = [...(daily.day === todayKey() ? daily.seen : []), refKey(ref)]
    .map((key) => parseRef(key))
    .filter((seenRef): seenRef is PositionRef => seenRef?.source === 'bank')
    .map((seenRef) => seenRef.id);
  return skill ? anotherLike(skill, seen, Date.now()) : null;
}

function buildSession(kind: PracticeKind, seed: number, options: { focus?: string; position?: string; daily?: boolean }): PracticeSession | null {
  if (kind === 'position') {
    return options.daily ? buildPosition(dailyRef(), DAILY_TITLE) : buildPosition(parseRef(options.position), MORE_TITLE);
  }
  if (kind === 'mistakes') {
    const all = useMistakesStore.getState().mistakes;
    const picks = withFocus(pickForPractice(all, SESSION_LENGTH, todayKey()), all, options.focus, SESSION_LENGTH);
    return picks.length > 0 ? buildMistakeSession(picks) : null;
  }
  const lessons = useProgressStore.getState().lessons;
  const levels = usePracticeStore.getState().records[kind]?.levels ?? {};
  return buildDrillSession(kind, seed, SESSION_LENGTH, (lessonId) => !!lessons[lessonId]?.completed, levels);
}

/** The drill's level right now: compared before and after a session to celebrate a level-up. */
function currentDrillLevel(kind: PracticeKind): LevelProgress | null {
  const info = getDrillCategory(kind);
  if (!info) return null;
  const lessons = useProgressStore.getState().lessons;
  return levelProgress(info, (lessonId) => !!lessons[lessonId]?.completed, usePracticeStore.getState().records[kind]?.levels ?? {});
}

export interface PracticeResult {
  outcome: LessonOutcome;
  reward: Reward;
  /** Everything the run earned: answers, mistakes fixed, skill levels. */
  xp: number;
  /** Mistakes from your games fixed for good in this run, and their XP. */
  mastered: number;
  fixedXp: number;
  /** Skills that reached a new level, with their XP. */
  masteryUps: MasteryUp[];
  /** Which round of this practice today (1-based), and the share of XP it earned. */
  round: number;
  factor: number;
  /** The drill's level after the session, and whether this session moved it up. */
  level: LevelProgress | null;
  levelUp: boolean;
  /** For your own mistakes: when the soonest of the ones just practised comes back ("tomorrow"). */
  nextReview: string | null;
}

const firstTry = (answer: { mistakes: number; solved: boolean; revealed: boolean } | undefined) =>
  !!answer?.solved && !answer.revealed && answer.mistakes === 0;

/**
 * A short practice run: five drills from one skill, positions from your own
 * games, or one position to think about ("What would you play?").
 * `focus`: a mistake to practise first. `position`: the position to show
 * ("mistake:<id>" or "bank:<id>"). `daily`: today's Position of the Day.
 */
export function PracticeSessionScreen({
  kind,
  focus,
  position,
  daily = false,
  source,
}: {
  kind: string;
  focus?: string;
  position?: string;
  daily?: boolean;
  source?: LaunchSource;
}) {
  const insets = useSafeAreaInsets();
  const lessons = useProgressStore((state) => state.lessons);
  const canPracticeMistakes = useFeatureAccess().canUseAdvancedTraining();
  const valid = kind === 'mistakes' || kind === 'position' || isDrill(kind);
  // A single position is free for everyone; the review queue of your own mistakes is Premium.
  const unlocked =
    kind === 'position'
      ? true
      : kind === 'mistakes'
        ? canPracticeMistakes
        : unlockedDrillCategories(lessons).some((info) => info.id === kind);
  const [run, setRun] = useState(() => ({
    id: 0,
    session: valid && unlocked ? buildSession(kind as PracticeKind, Date.now(), { focus, position, daily }) : null,
    // "Try another" runs are extra positions, not today's.
    daily,
    start: runStart(kind),
  }));
  const factor = repeatFactor(run.start.rounds);
  const [result, setResult] = useState<PracticeResult | null>(null);
  const answered = useRef(new Set<string>());
  // "Try another" for a position: worked out once the session ends.
  const [another, setAnother] = useState<PositionRef | null>(null);
  // Today's position stays the same for the rest of the day once it's been shown.
  const shownDaily = run.daily ? (run.session?.ref ?? null) : undefined;
  useEffect(() => {
    if (shownDaily !== undefined) useDailyPositionStore.getState().keep(todayKey(), shownDaily);
  }, [shownDaily]);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/practice');
  };

  const again = () => {
    answered.current = new Set();
    setResult(null);
    setRun((previous) => ({
      id: previous.id + 1,
      session: kind === 'position' ? buildPosition(another, MORE_TITLE) : buildSession(kind as PracticeKind, Date.now(), {}),
      daily: false,
      start: runStart(kind),
    }));
  };

  if (kind === 'mistakes' && !canPracticeMistakes) {
    return (
      <View style={[styles.blocked, { paddingTop: insets.top + spacing.huge }]} testID="practice-premium">
        <Icon name="crown" size={48} color={colors.primary} />
        <AppText variant="title" align="center">
          Practise your own mistakes
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          Positions you got wrong in your games come back until they stick. Reviewing all of them is part of Premium;
          any single position is free from its game’s review, and your mistakes are saved either way.
        </AppText>
        <Button label="See Premium" icon="crown" onPress={() => router.replace({ pathname: '/paywall', params: { source: 'mistakes' } })} />
        <Button label="Not now" variant="ghost" size="medium" onPress={leave} />
      </View>
    );
  }

  if (!valid || !unlocked || !run.session) {
    const info = DRILL_CATEGORIES.find((entry) => entry.id === kind);
    const lesson = info ? getLesson(info.requiresLesson) : undefined;
    return (
      <View style={[styles.blocked, { paddingTop: insets.top + spacing.huge }]} testID="practice-unavailable">
        <Icon name={kind === 'mistakes' || kind === 'position' ? 'check-decagram' : 'lock'} size={48} color={colors.textMuted} />
        <AppText variant="title" align="center">
          {!valid
            ? 'Practice not found'
            : kind === 'mistakes'
              ? 'No mistakes to practise'
              : kind === 'position'
                ? 'No position to show'
                : 'This drill is locked'}
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          {!valid
            ? 'It may have moved in an update.'
            : kind === 'mistakes'
              ? 'Play a game: your coach saves the positions you got wrong here, so you can fix them.'
              : kind === 'position'
                ? 'Learn a little more on your path: positions start once your lessons cover hitting.'
                : `Finish the lesson “${lesson?.title ?? 'before it'}” on your path to unlock it.`}
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
        onAgain={kind !== 'position' || another ? again : undefined}
        againLabel={kind === 'position' ? 'Try another like it' : undefined}
        onDone={leave}
      />
    );
  }

  return (
    <StepSessionPlayer
      key={run.id}
      sessionId={session.id}
      steps={session.steps}
      xpForStep={(outcome) => practiceXp(outcome, factor)}
      kind="practice"
      exitTitle="Leave this practice?"
      exitMessage="This session won’t count, but nothing else is lost."
      onExit={leave}
      onAnswer={(step, correct) => {
        // A position from your games counts toward fixing it when you find the move on the first attempt.
        const mistakeId =
          kind === 'mistakes' ? step.id : kind === 'position' && session.ref?.source === 'mistake' && step.kind === 'choice' ? session.ref.id : null;
        if (!mistakeId || answered.current.has(step.id)) return;
        answered.current.add(step.id);
        useMistakesStore.getState().recordAttempt(mistakeId, correct);
        analytics.track('mistake_practiced', { fixed: correct });
        if (correct) reportChallengeEvent({ type: 'mistake-fixed' });
      }}
      onFinish={(state) => {
        const outcome = summarizeSteps(session.steps, 0, state);
        const answersXp = session.steps.reduce((sum, step) => sum + practiceXp(state.outcomes[step.id] ?? EMPTY, factor), 0);
        const progress = useProgressStore.getState();
        // Every answer counts toward its skill, the same as in lessons.
        const fallback = isDrill(kind) ? skillOfDrill(kind) : 'points';
        progress.recordSkillResults(skillResultsFor(session.steps, state.outcomes, { skill: fallback }));
        // Count the session first so practice achievements see it.
        progress.recordPracticeSession();
        const before = currentDrillLevel(kind as PracticeKind);
        const levelResults = session.steps
          .filter((step) => session.levelOf[step.id])
          .map((step) => ({ level: session.levelOf[step.id], firstTry: firstTry(state.outcomes[step.id]) }));
        usePracticeStore.getState().recordSession(kind as PracticeKind, outcome.firstTryCorrect, undefined, levelResults);
        const after = currentDrillLevel(kind as PracticeKind);
        const levelUp = !getDrillCategory(kind)?.mixLevels && !!before && !!after && after.number > before.number;
        if (session.ref) {
          const choice = session.steps.find((step) => step.kind === 'choice');
          useDailyPositionStore.getState().finish(todayKey(), session.ref, firstTry(choice && state.outcomes[choice.id]), run.daily);
          setAnother(nextLike(session.ref));
        }
        // Mistakes from your games fixed for good in this run, and skills that reached a new level: real
        // improvement, rewarded once each.
        const saved = useMistakesStore.getState().mistakes;
        const practised = saved.filter(
          (mistake) => session.steps.some((step) => step.id === mistake.id) || (session.ref?.source === 'mistake' && session.ref.id === mistake.id),
        );
        const mastered = practised.filter((mistake) => isMastered(mistake) && !run.start.fixed.has(mistake.id)).length;
        const fixedXp = mastered * MISTAKE_MASTERED_XP;
        const masteryUps = settleMastery(run.start.mastery).filter((up) => up.xp > 0);
        const xp = answersXp + fixedXp + masteryUps.reduce((sum, up) => sum + up.xp, 0);
        // A finished session keeps the streak going, even if every answer was shown.
        const reward = progress.awardXp(xp, {}, true);
        reportChallengeEvent({ type: 'practice-session', category: kind as PracticeKind });
        analytics.track('practice_session_completed', {
          kind,
          steps: outcome.scoredSteps,
          first_try: outcome.firstTryCorrect,
          xp,
          source,
        });
        if (source === 'coach_pick') {
          analytics.track('coach_pick_completed', { kind: kind === 'mistakes' ? 'mistakes' : 'drill' });
        }
        const comesBack = kind === 'mistakes' || kind === 'position' ? nextDueDay(practised, todayKey()) : null;
        const nextReview = comesBack ? dueIn(comesBack, todayKey()) : null;
        setResult({
          outcome,
          reward,
          xp,
          mastered,
          fixedXp,
          masteryUps,
          round: run.start.rounds + 1,
          factor,
          level: getDrillCategory(kind)?.mixLevels ? null : after,
          levelUp,
          nextReview,
        });
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
