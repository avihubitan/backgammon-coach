import { createContext, useContext } from 'react';

import { BOARD_THEMES, type BoardPalette } from '@/theme/boardThemes';

/**
 * The colours boards are painted with. The app provides the player's chosen
 * style at the root; previews can wrap a board in their own provider.
 */
export const BoardPaletteContext = createContext<BoardPalette>(BOARD_THEMES[0].palette);

export const useBoardPalette = () => useContext(BoardPaletteContext);
