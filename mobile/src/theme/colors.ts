/**
 * Design tokens. The UI is dark-first so the board (walnut, felt and ivory)
 * is always the brightest, warmest thing on screen.
 */
export const colors = {
  bg: '#0D0F12',
  bgElevated: '#13161B',
  surface: '#191D23',
  surfaceRaised: '#20252D',
  surfacePressed: '#262C35',
  border: '#272D37',
  borderStrong: '#363E4B',

  text: '#F6F2EA',
  textSecondary: '#A8ADB8',
  textMuted: '#6C7280',
  textInverse: '#16120B',

  primary: '#F3B847',
  primaryPressed: '#D99E2E',
  primarySoft: 'rgba(243, 184, 71, 0.14)',
  primaryShadow: '#A9761A',

  success: '#3DD68C',
  successPressed: '#2CB673',
  successSoft: 'rgba(61, 214, 140, 0.14)',
  successShadow: '#1E8B56',

  danger: '#FF6B5C',
  dangerSoft: 'rgba(255, 107, 92, 0.14)',
  dangerShadow: '#B9473B',

  info: '#62B6FF',
  infoSoft: 'rgba(98, 182, 255, 0.14)',

  streak: '#FF8A3D',
  xp: '#F3B847',
  star: '#FFC94D',
  starEmpty: '#3A404C',
  locked: '#2C323C',
  lockedText: '#5D6472',

  overlay: 'rgba(5, 6, 8, 0.72)',
} as const;

/** Colours used to paint the board and its pieces. */
export const boardColors = {
  frameTop: '#5B3922',
  frameBottom: '#38220F',
  frameEdge: '#7A5233',
  frameNumber: 'rgba(246, 226, 196, 0.55)',
  feltCenter: '#1F4A39',
  feltEdge: '#143428',
  barTop: '#4C2F1B',
  barBottom: '#2F1C0E',
  trayFill: '#120D08',
  trayEdge: '#241810',
  pointLightBase: '#E9D7AE',
  pointLightTip: '#D4BE8E',
  pointDarkBase: '#A2412F',
  pointDarkTip: '#7E2F21',

  lightCheckerFace: '#F6EFDF',
  lightCheckerRim: '#CDBF9F',
  lightCheckerRing: '#E3D7BC',
  darkCheckerFace: '#2C2B30',
  darkCheckerRim: '#121214',
  darkCheckerRing: '#3D3C43',

  lightDie: '#F6EFDF',
  lightPip: '#1D1A16',
  darkDie: '#26252A',
  darkPip: '#F6EFDF',

  selected: '#F3B847',
  target: '#7CF2C0',
  targetFill: 'rgba(124, 242, 192, 0.28)',
  movable: 'rgba(243, 184, 71, 0.55)',
  hintArrow: '#7CF2C0',
  wrongArrow: '#FF6B5C',
  zoneHighlight: 'rgba(98, 182, 255, 0.24)',
  zoneBorder: 'rgba(98, 182, 255, 0.85)',
} as const;

export type ColorToken = keyof typeof colors;
