import { useChallengeStore } from './challengeStore';
import { useGameStore } from './gameStore';
import { useMistakesStore } from './mistakesStore';
import { usePracticeStore } from './practiceStore';
import { useProgressStore } from './progressStore';

/** Erases all learning progress on this device (settings are kept). */
export function resetAllProgress() {
  useProgressStore.getState().resetProgress();
  useChallengeStore.getState().reset();
  usePracticeStore.getState().reset();
  useMistakesStore.getState().reset();
  useGameStore.getState().resetGames();
}
