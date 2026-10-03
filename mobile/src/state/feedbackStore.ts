import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { mergeChecked } from './sanitize';
import { persistStorage } from './storage';

interface FeedbackState {
  /** The day the quick "How was this?" was last shown. */
  lastAskedDay: string | null;
  markAsked: (day: string) => void;
}

export const useFeedbackStore = create<FeedbackState>()(
  persist(
    (set) => ({
      lastAskedDay: null,
      markAsked: (day) => set({ lastAskedDay: day }),
    }),
    {
      name: 'bg-coach/feedback',
      version: 1,
      storage: persistStorage,
      merge: mergeChecked<FeedbackState, Pick<FeedbackState, 'lastAskedDay'>>({ lastAskedDay: null }, (saved) => ({
        lastAskedDay: typeof saved.lastAskedDay === 'string' ? saved.lastAskedDay : null,
      })),
      partialize: ({ lastAskedDay }) => ({ lastAskedDay }),
    },
  ),
);
