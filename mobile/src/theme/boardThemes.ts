import { boardColors } from './colors';

/** Every colour the board, its checkers and dice are painted with. */
export type BoardPalette = { [K in keyof typeof boardColors]: string };

export type BoardThemeId = 'classic' | 'tournament' | 'midnight' | 'royal';

export interface BoardTheme {
  id: BoardThemeId;
  name: string;
  description: string;
  /** Cosmetic only: every theme plays exactly the same. */
  tier: 'free' | 'premium';
  palette: BoardPalette;
}

/** Highlights stay the same everywhere, so hints read the same on every board. */
const shared = {
  selected: boardColors.selected,
  target: boardColors.target,
  hitTarget: boardColors.hitTarget,
  targetFill: boardColors.targetFill,
  movable: boardColors.movable,
  hintArrow: boardColors.hintArrow,
  wrongArrow: boardColors.wrongArrow,
  zoneHighlight: boardColors.zoneHighlight,
  zoneBorder: boardColors.zoneBorder,
};

export const BOARD_THEMES: BoardTheme[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Walnut and green felt',
    tier: 'free',
    palette: { ...boardColors },
  },
  {
    id: 'tournament',
    name: 'Tournament',
    description: 'Slate, blue baize and bold points',
    tier: 'free',
    palette: {
      ...shared,
      frameTop: '#3B4250',
      frameBottom: '#23272F',
      frameEdge: '#55607A',
      frameNumber: 'rgba(225, 232, 245, 0.6)',
      feltCenter: '#1D3F5E',
      feltEdge: '#132B42',
      barTop: '#2E3440',
      barBottom: '#1B1F26',
      trayFill: '#0E1116',
      trayEdge: '#1F242D',
      pointLightBase: '#A9B5C6',
      pointLightTip: '#8794A8',
      pointDarkBase: '#C2453A',
      pointDarkTip: '#922F27',
      lightCheckerFace: '#F8F8F6',
      lightCheckerRim: '#C9CCD2',
      lightCheckerRing: '#E2E4E8',
      darkCheckerFace: '#2A2D33',
      darkCheckerRim: '#0F1114',
      darkCheckerRing: '#3B3F47',
      lightDie: '#F8F8F6',
      lightPip: '#1B1E24',
      darkDie: '#2A2D33',
      darkPip: '#F8F8F6',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Obsidian, indigo and pearl',
    tier: 'premium',
    palette: {
      ...shared,
      frameTop: '#1C1D24',
      frameBottom: '#0C0C10',
      frameEdge: '#3A3550',
      frameNumber: 'rgba(205, 198, 255, 0.55)',
      feltCenter: '#1E1B3A',
      feltEdge: '#120F26',
      barTop: '#17161F',
      barBottom: '#0A0A0E',
      trayFill: '#07070A',
      trayEdge: '#1A1826',
      pointLightBase: '#B9B2E8',
      pointLightTip: '#8F86C9',
      pointDarkBase: '#4B3F8F',
      pointDarkTip: '#342B68',
      lightCheckerFace: '#F4F1FF',
      lightCheckerRim: '#C8C0E8',
      lightCheckerRing: '#E2DCFA',
      darkCheckerFace: '#24222E',
      darkCheckerRim: '#0B0A10',
      darkCheckerRing: '#38354A',
      lightDie: '#F4F1FF',
      lightPip: '#1A1730',
      darkDie: '#24222E',
      darkPip: '#E9E4FF',
    },
  },
  {
    id: 'royal',
    name: 'Royal',
    description: 'Rosewood, burgundy and gold',
    tier: 'premium',
    palette: {
      ...shared,
      frameTop: '#5A2423',
      frameBottom: '#341212',
      frameEdge: '#8A4A2E',
      frameNumber: 'rgba(255, 222, 170, 0.6)',
      feltCenter: '#6A2636',
      feltEdge: '#45172A',
      barTop: '#4A1D1C',
      barBottom: '#2B0F0F',
      trayFill: '#160808',
      trayEdge: '#2E1414',
      pointLightBase: '#E2B65C',
      pointLightTip: '#C29437',
      pointDarkBase: '#211B1B',
      pointDarkTip: '#0F0C0C',
      lightCheckerFace: '#FBF4E2',
      lightCheckerRim: '#C9A55A',
      lightCheckerRing: '#EFE2BE',
      darkCheckerFace: '#6B4330',
      darkCheckerRim: '#3A2216',
      darkCheckerRing: '#83563F',
      lightDie: '#FBF4E2',
      lightPip: '#3A1414',
      darkDie: '#4A2C1F',
      darkPip: '#F3DFAE',
    },
  },
];

export const DEFAULT_BOARD_THEME: BoardThemeId = 'classic';

export function getBoardTheme(id: string | null | undefined): BoardTheme {
  return BOARD_THEMES.find((theme) => theme.id === id) ?? BOARD_THEMES[0];
}
