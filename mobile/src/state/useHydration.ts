import { useEffect, useState } from 'react';

import { useChallengeStore } from './challengeStore';
import { useEntitlementsStore } from './entitlementsStore';
import { useFeedbackStore } from './feedbackStore';
import { useGameStore } from './gameStore';
import { useMistakesStore } from './mistakesStore';
import { usePracticeStore } from './practiceStore';
import { useProgressStore } from './progressStore';
import { useSettingsStore } from './settingsStore';
import { useSyncStore } from './syncStore';

const stores = [
  useProgressStore,
  useSettingsStore,
  useGameStore,
  useMistakesStore,
  useChallengeStore,
  usePracticeStore,
  useEntitlementsStore,
  useSyncStore,
  useFeedbackStore,
];

/** True once every persisted store has loaded from storage. */
export function useHydration(): boolean {
  const [hydrated, setHydrated] = useState(() => stores.every((store) => store.persist.hasHydrated()));
  useEffect(() => {
    if (hydrated) return;
    const check = () => {
      if (stores.every((store) => store.persist.hasHydrated())) setHydrated(true);
    };
    const unsubscribes = stores.map((store) => store.persist.onFinishHydration(check));
    check();
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [hydrated]);
  return hydrated;
}
