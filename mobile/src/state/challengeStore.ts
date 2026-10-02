import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  applyChallengeEvent,
  startDaily,
  type ChallengeContext,
  type ChallengeEvent,
  type DailyChallengeState,
} from '@/features/challenges/challenges';
import { pruneDays } from '@/features/learning/progression';

import { persistStorage } from './storage';

interface ChallengeStore {
  daily: DailyChallengeState | null;
  /** Days on which the daily challenge was completed (recent ones only). */
  completedDays: Record<string, string>;
  /** Fixes today's challenge the first time it is needed, so it can't change mid-day. */
  ensure: (day: string, context: ChallengeContext) => DailyChallengeState;
  apply: (
    event: ChallengeEvent,
    day: string,
    context: ChallengeContext,
    now: string,
  ) => { state: DailyChallengeState; completed: boolean };
  reset: () => void;
}

export const useChallengeStore = create<ChallengeStore>()(
  persist(
    (set, get) => ({
      daily: null,
      completedDays: {},
      ensure: (day, context) => {
        const current = get().daily;
        if (current?.day === day) return current;
        const fresh = startDaily(day, context);
        set({ daily: fresh });
        return fresh;
      },
      apply: (event, day, context, now) => {
        const current = get().ensure(day, context);
        const result = applyChallengeEvent(current, event, now);
        if (result.state !== current) {
          set({
            daily: result.state,
            completedDays: result.completed
              ? pruneDays({ ...get().completedDays, [day]: result.state.id }, day)
              : get().completedDays,
          });
        }
        return result;
      },
      reset: () => set({ daily: null, completedDays: {} }),
    }),
    {
      name: 'bg-coach/challenges',
      version: 1,
      storage: persistStorage,
      partialize: ({ daily, completedDays }) => ({ daily, completedDays }),
    },
  ),
);
