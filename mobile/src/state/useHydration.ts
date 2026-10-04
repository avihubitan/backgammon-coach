import { useEffect, useState } from 'react';

import { crashReporter } from '@/services/crash';

import { useChallengeStore } from './challengeStore';
import { useDailyPositionStore } from './dailyPositionStore';
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
  useDailyPositionStore,
  usePracticeStore,
  useEntitlementsStore,
  useSyncStore,
  useFeedbackStore,
];

/**
 * If a store still hasn't loaded after this long (an unexpected error while
 * restoring it), the app starts anyway instead of staying on a blank screen.
 */
export const HYDRATION_TIMEOUT_MS = 10_000;

/** True once every persisted store has loaded from storage. */
export function useHydration(timeoutMs: number = HYDRATION_TIMEOUT_MS): boolean {
  const [hydrated, setHydrated] = useState(() => stores.every((store) => store.persist.hasHydrated()));
  useEffect(() => {
    if (hydrated) return;
    const check = () => {
      if (stores.every((store) => store.persist.hasHydrated())) setHydrated(true);
    };
    const unsubscribes = stores.map((store) => store.persist.onFinishHydration(check));
    check();
    const timer = setTimeout(() => {
      const pending = stores.filter((store) => !store.persist.hasHydrated()).map((store) => store.persist.getOptions().name);
      crashReporter.captureException(new Error('Saved data took too long to load'), { stores: pending.join(',') });
      setHydrated(true);
    }, timeoutMs);
    return () => {
      clearTimeout(timer);
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [hydrated, timeoutMs]);
  return hydrated;
}
