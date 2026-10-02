import { create } from 'zustand';

/**
 * Short-lived celebration cues that cross screens (not persisted): e.g. a
 * lesson unlocked at the end of a lesson is revealed with an animation the
 * next time the map is shown.
 */
interface CelebrationState {
  /** A lesson that was just unlocked and hasn't been revealed on the map yet. */
  pendingUnlock: string | null;
  queueUnlock: (lessonId: string) => void;
  /** Clears the pending reveal (only if it is for `lessonId`, when given). */
  clearUnlock: (lessonId?: string) => void;
}

export const useCelebrationStore = create<CelebrationState>()((set, get) => ({
  pendingUnlock: null,
  queueUnlock: (lessonId) => set({ pendingUnlock: lessonId }),
  clearUnlock: (lessonId) => {
    if (lessonId === undefined || get().pendingUnlock === lessonId) set({ pendingUnlock: null });
  },
}));
