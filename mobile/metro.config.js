// Expo's default Metro config, plus Sentry's debug IDs so crash reports from
// release builds map back to the original source.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
