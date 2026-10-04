import { useChallengeStore } from './challengeStore';
import { useDailyPositionStore } from './dailyPositionStore';
import { useEntitlementsStore } from './entitlementsStore';
import { useGameStore } from './gameStore';
import { useMistakesStore } from './mistakesStore';
import { usePracticeStore } from './practiceStore';
import { useProgressStore } from './progressStore';
import { useSyncStore } from './syncStore';

/** Erases all learning progress on this device (settings are kept). */
export function resetAllProgress() {
  useProgressStore.getState().resetProgress();
  useChallengeStore.getState().reset();
  useDailyPositionStore.getState().reset();
  usePracticeStore.getState().reset();
  useMistakesStore.getState().reset();
  useGameStore.getState().resetGames();
  // Purchases are kept; only the free-review usage is cleared.
  useEntitlementsStore.getState().reset();
  // "On this device": stop backing up, so the empty slate never replaces the
  // cloud copy. Turning backup back on merges the old progress back in.
  useSyncStore.getState().update({ enabled: false, status: 'idle', error: null });
}
