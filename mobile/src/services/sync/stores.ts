import type { ProgressData } from '@/features/learning/progressModel';
import { useChallengeStore } from '@/state/challengeStore';
import { useGameStore } from '@/state/gameStore';
import { useMistakesStore } from '@/state/mistakesStore';
import { usePracticeStore } from '@/state/practiceStore';
import { useProgressStore } from '@/state/progressStore';

import { SNAPSHOT_VERSION, type SyncSnapshot } from './snapshot';

/** Bridges the snapshot and the app's stores. */

function progressData(): ProgressData {
  const state = useProgressStore.getState();
  return {
    version: state.version,
    onboardingCompleted: state.onboardingCompleted,
    lessons: state.lessons,
    xp: state.xp,
    xpByDay: state.xpByDay,
    streak: state.streak,
    dailyGoalXp: state.dailyGoalXp,
    stats: state.stats,
    achievements: state.achievements,
  };
}

export function snapshotFromStores(now: Date): SyncSnapshot {
  return {
    schemaVersion: SNAPSHOT_VERSION,
    createdAt: now.toISOString(),
    progress: progressData(),
    practice: usePracticeStore.getState().records,
    challenges: { completedDays: useChallengeStore.getState().completedDays },
    games: { stats: useGameStore.getState().stats },
    mistakes: useMistakesStore.getState().mistakes,
  };
}

export function applySnapshot(snapshot: SyncSnapshot) {
  useProgressStore.setState(snapshot.progress);
  usePracticeStore.setState({ records: snapshot.practice });
  useChallengeStore.setState({ completedDays: snapshot.challenges.completedDays });
  useGameStore.setState({ stats: snapshot.games.stats });
  useMistakesStore.setState({ mistakes: snapshot.mistakes });
}

/** Calls `listener` whenever any synced data changes. */
export function subscribeToSyncedData(listener: () => void): () => void {
  const unsubscribers = [
    useProgressStore.subscribe(listener),
    usePracticeStore.subscribe(listener),
    useChallengeStore.subscribe((state, previous) => {
      if (state.completedDays !== previous.completedDays) listener();
    }),
    useGameStore.subscribe((state, previous) => {
      if (state.stats !== previous.stats) listener();
    }),
    useMistakesStore.subscribe(listener),
  ];
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
