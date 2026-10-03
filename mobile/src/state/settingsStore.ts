import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { ReminderTime } from '@/features/reminders/reminderPlan';
import { newAnalyticsId, setAnalyticsEnabled } from '@/services/analytics';
import { crashReporter } from '@/services/crash';
import { configureFeedback } from '@/services/feedback';
import { DEFAULT_BOARD_THEME, type BoardThemeId } from '@/theme/boardThemes';

import { mergeChecked } from './sanitize';
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
  /** Share anonymous usage data and crash reports (no personal information). */
  analytics: boolean;
  /** Random id for this install, used only to group anonymous analytics. */
  installId: string;
  /** Board style (cosmetic). */
  boardTheme: BoardThemeId;
  /** A daily reminder on this device, at this local time. */
  reminders: ReminderTime & { enabled: boolean };
  /** Whether Home has offered reminders yet ('done' once they were turned on anywhere). */
  reminderPrompt: 'unasked' | 'dismissed' | 'done';
  /** The coach checks clear mistakes before a game move is confirmed. */
  coachWatch: boolean;
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
  boardTheme: DEFAULT_BOARD_THEME,
  reminders: { enabled: false, hour: 19, minute: 0 },
  reminderPrompt: 'unasked',
  coachWatch: true,
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
  boardTheme: state.boardTheme,
  reminders: state.reminders,
  reminderPrompt: state.reminderPrompt,
  coachWatch: state.coachWatch,
});

function apply(settings: SettingsData) {
  configureFeedback(settings);
  setAnalyticsEnabled(settings.analytics);
}

apply(DEFAULT_SETTINGS);

export const useSettingsStore = create<SettingsData & SettingsActions>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => {
        set(patch);
        apply(get());
        crashReporter.setEnabled(get().analytics);
      },
    }),
    {
      name: 'bg-coach/settings',
      version: 5,
      storage: persistStorage,
      merge: mergeChecked<SettingsData & SettingsActions, SettingsData>(DEFAULT_SETTINGS),
      partialize: (state): SettingsData => pickSettings(state),
      // Older versions had no sound, music, analytics, board style or reminder settings.
      migrate: (persisted) => ({ ...DEFAULT_SETTINGS, ...(persisted as Partial<SettingsData>) }),
      onRehydrateStorage: () => (state) => {
        if (!state) {
          crashReporter.setEnabled(DEFAULT_SETTINGS.analytics);
          return;
        }
        if (!state.installId) state.update({ installId: newAnalyticsId() });
        apply(state);
        // Crash reports follow the same choice; this also saves it for the next start.
        crashReporter.setEnabled(state.analytics);
      },
    },
  ),
);
