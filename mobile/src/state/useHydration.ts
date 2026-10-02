import { useEffect, useState } from 'react';

import { useChallengeStore } from './challengeStore';
import { useGameStore } from './gameStore';
import { useMistakesStore } from './mistakesStore';
import { usePracticeStore } from './practiceStore';
import { useProgressStore } from './progressStore';
import { useSettingsStore } from './settingsStore';

const stores = [
  useProgressStore,
  useSettingsStore,
  useGameStore,
  useMistakesStore,
  useChallengeStore,
  usePracticeStore,
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
