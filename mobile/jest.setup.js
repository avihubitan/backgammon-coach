/* global jest */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    remove: jest.fn(),
    volume: 1,
    loop: false,
  })),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));

// RevenueCat's SDK is native (and ships ES modules); tests use a fake store instead.
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(() => Promise.resolve()),
  },
  LOG_LEVEL: { DEBUG: 'DEBUG' },
}));

// Sentry's SDK is native; tests use a fake (see services/crash).
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  close: jest.fn(() => Promise.resolve()),
  captureException: jest.fn(),
  wrap: (component) => component,
  reactNavigationIntegration: jest.fn(() => ({ name: 'ReactNavigation', registerNavigationContainer: jest.fn() })),
}));
