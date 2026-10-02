import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { analytics, newAnalyticsId } from '@/services/analytics';
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
  /** Share anonymous usage data (no personal information). */
  analytics: boolean;
  /** Random id for this install, used only to group anonymous analytics. */
  installId: string;
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
  analytics: true,
  installId: '',
};

const pickSettings = (state: SettingsData): SettingsData => ({
  sound: state.sound,
  music: state.music,
  haptics: state.haptics,
  showPointNumbers: state.showPointNumbers,
  showMovableHints: state.showMovableHints,
  showTechnicalStats: state.showTechnicalStats,
  analytics: state.analytics,
  installId: state.installId,
});

function apply(settings: SettingsData) {
  configureFeedback(settings);
  analytics.setEnabled(settings.analytics);
}

apply(DEFAULT_SETTINGS);

export const useSettingsStore = create<SettingsData & SettingsActions>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => {
        set(patch);
        apply(get());
      },
    }),
    {
      name: 'bg-coach/settings',
      version: 3,
      storage: persistStorage,
      partialize: (state): SettingsData => pickSettings(state),
      // Older versions had no sound, music or analytics settings.
      migrate: (persisted) => ({ ...DEFAULT_SETTINGS, ...(persisted as Partial<SettingsData>) }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!state.installId) state.update({ installId: newAnalyticsId() });
        apply(state);
      },
    },
  ),
);
