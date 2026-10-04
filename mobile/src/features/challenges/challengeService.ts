import { curriculum } from '@/curriculum';
import { focusDrill } from '@/features/coach/coachPick';
import { isFeatureUnlocked } from '@/features/learning/progression';
import { currentFeatureAccess } from '@/features/monetization/useFeatureAccess';
import { isMastered } from '@/features/practice/mistakes';
import { unlockedDrillCategories } from '@/features/practice/practiceModel';
import { analytics } from '@/services/analytics';
import { feedback } from '@/services/feedback';
import { useChallengeStore } from '@/state/challengeStore';
import { useMistakesStore } from '@/state/mistakesStore';
import { usePracticeStore } from '@/state/practiceStore';
import { todayKey, useProgressStore } from '@/state/progressStore';
import { useToastStore } from '@/state/toastStore';

import { getChallenge, type ChallengeContext, type ChallengeEvent } from './challenges';

/** What the learner can currently do, for picking a fair daily challenge. */
export function currentChallengeContext(): ChallengeContext {
  const { lessons, stats } = useProgressStore.getState();
  const mistakes = useMistakesStore.getState().mistakes;
  const access = currentFeatureAccess();
  const unlockedDrills = unlockedDrillCategories(lessons).map((info) => info.id);
  return {
    completedSections: curriculum
      .filter((section) => section.lessons.length > 0 && section.lessons.every((lesson) => lessons[lesson.id]?.completed))
      .map((section) => section.id),
    unlockedDrills,
    playUnlocked: isFeatureUnlocked('play', lessons),
    openMistakes: mistakes.filter((mistake) => !isMastered(mistake)).length,
    canPracticeMistakes: access.canUseAdvancedTraining(),
    focusDrill: focusDrill({
      mistakes,
      bySkill: stats.bySkill,
      lessons,
      unlockedDrills,
      canPracticeMistakes: access.canUseAdvancedTraining(),
      canAccessLesson: access.canAccessLesson,
      today: todayKey(),
      practiced: usePracticeStore.getState().records,
    }),
  };
}

/**
 * Report something the learner did. If it completes today's challenge, the
 * reward is granted (XP, which also keeps the streak going) and celebrated.
 */
export function reportChallengeEvent(event: ChallengeEvent) {
  const result = useChallengeStore
    .getState()
    .apply(event, todayKey(), currentChallengeContext(), new Date().toISOString());
  if (!result.completed) return;
  const challenge = getChallenge(result.state.id);
  if (!challenge) return;
  useProgressStore.getState().awardXp(challenge.xp, {
    challengesCompleted: Object.keys(useChallengeStore.getState().completedDays).length,
  });
  analytics.track('daily_challenge_completed', { challenge_id: challenge.id, xp: challenge.xp });
  useToastStore.getState().show({
    icon: challenge.icon,
    title: 'Daily challenge complete!',
    message: challenge.title,
    xp: challenge.xp,
    testID: 'toast-challenge',
  });
  feedback.unlock();
}
