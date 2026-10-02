import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

let enabled = true;

/** Lets the settings store switch haptics on or off globally. */
export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

function run(effect: () => Promise<void>) {
  if (!enabled || Platform.OS === 'web') return;
  effect().catch(() => {
    // Haptics are a nicety; devices without support simply stay silent.
  });
}

export const haptics = {
  tap: () => run(() => Haptics.selectionAsync()),
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  heavy: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
