import type { ReactNode } from 'react';

import { BoardPaletteContext } from '@/components/board/palette';
import { useFeatureAccess } from '@/features/monetization/useFeatureAccess';
import { useSettingsStore } from '@/state/settingsStore';
import { getBoardTheme, DEFAULT_BOARD_THEME } from '@/theme/boardThemes';

/**
 * Paints every board in the player's chosen style. If a Premium style is no
 * longer available (the subscription ended), boards quietly go back to Classic.
 */
export function BoardThemeProvider({ children }: { children: ReactNode }) {
  const chosen = useSettingsStore((state) => state.boardTheme);
  const allowed = useFeatureAccess().canUseBoardTheme(chosen);
  const theme = getBoardTheme(allowed ? chosen : DEFAULT_BOARD_THEME);
  return <BoardPaletteContext.Provider value={theme.palette}>{children}</BoardPaletteContext.Provider>;
}
