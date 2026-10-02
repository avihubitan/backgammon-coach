import { curriculum } from '@/curriculum';
import { isFeatureUnlocked } from '@/features/learning/progression';
import { isMastered } from '@/features/practice/mistakes';
import { unlockedDrillCategories } from '@/features/practice/practiceModel';
import { feedback } from '@/services/feedback';
import { useChallengeStore } from '@/state/challengeStore';
import { useMistakesStore } from '@/state/mistakesStore';
import { todayKey, useProgressStore } from '@/state/progressStore';
import { useToastStore } from '@/state/toastStore';

import { getChallenge, type ChallengeContext, type ChallengeEvent } from './challenges';

/** What the learner can currently do, for picking a fair daily challenge. */
export function currentChallengeContext(): ChallengeContext {
  const lessons = useProgressStore.getState().lessons;
  return {
    completedSections: curriculum
      .filter((section) => section.lessons.length > 0 && section.lessons.every((lesson) => lessons[lesson.id]?.completed))
      .map((section) => section.id),
    unlockedDrills: unlockedDrillCategories(lessons, curriculum).map((info) => info.id),
    playUnlocked: isFeatureUnlocked('play', lessons),
    openMistakes: useMistakesStore.getState().mistakes.filter((mistake) => !isMastered(mistake)).length,
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
  useProgressStore.getState().awardXp(challenge.xp);
  useToastStore.getState().show({
    icon: challenge.icon,
    title: 'Daily challenge complete!',
    message: challenge.title,
    xp: challenge.xp,
    testID: 'toast-challenge',
  });
  feedback.unlock();
}
