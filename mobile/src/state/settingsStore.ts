import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { setHapticsEnabled } from '@/services/haptics';

import { persistStorage } from './storage';

export interface SettingsData {
  haptics: boolean;
  showPointNumbers: boolean;
  /** Show which checkers can move during games. */
  showMovableHints: boolean;
  /** Show the technical evaluation numbers in game reviews. */
  showTechnicalStats: boolean;
}

interface SettingsActions {
  update: (patch: Partial<SettingsData>) => void;
}

export const DEFAULT_SETTINGS: SettingsData = {
  haptics: true,
  showPointNumbers: true,
  showMovableHints: true,
  showTechnicalStats: false,
};

export const useSettingsStore = create<SettingsData & SettingsActions>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => {
        if (patch.haptics !== undefined) setHapticsEnabled(patch.haptics);
        set(patch);
      },
    }),
    {
      name: 'bg-coach/settings',
      version: 1,
      storage: persistStorage,
      partialize: ({ haptics, showPointNumbers, showMovableHints, showTechnicalStats }) => ({
        haptics,
        showPointNumbers,
        showMovableHints,
        showTechnicalStats,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) setHapticsEnabled(state.haptics);
      },
    },
  ),
);
