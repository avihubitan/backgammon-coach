import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { configureFeedback } from '@/services/feedback';

import { persistStorage } from './storage';

export interface SettingsData {
  /** Sound effects (board, rewards, interface). Muted by the iOS silent switch either way. */
  sound: boolean;
  /** Background music. */
  music: boolean;
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
  sound: true,
  music: false,
  haptics: true,
  showPointNumbers: true,
  showMovableHints: true,
  showTechnicalStats: false,
};

const pickSettings = (state: SettingsData): SettingsData => ({
  sound: state.sound,
  music: state.music,
  haptics: state.haptics,
  showPointNumbers: state.showPointNumbers,
  showMovableHints: state.showMovableHints,
  showTechnicalStats: state.showTechnicalStats,
});

configureFeedback(DEFAULT_SETTINGS);

export const useSettingsStore = create<SettingsData & SettingsActions>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => {
        set(patch);
        configureFeedback(get());
      },
    }),
    {
      name: 'bg-coach/settings',
      version: 2,
      storage: persistStorage,
      partialize: (state): SettingsData => pickSettings(state),
      // Version 1 had no sound or music settings.
      migrate: (persisted) => ({ ...DEFAULT_SETTINGS, ...(persisted as Partial<SettingsData>) }),
      onRehydrateStorage: () => (state) => {
        if (state) configureFeedback(state);
      },
    },
  ),
);
