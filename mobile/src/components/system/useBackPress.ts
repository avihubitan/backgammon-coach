import { useEffect, useEffectEvent } from 'react';
import { BackHandler } from 'react-native';

/**
 * Android's back button and back gesture. While `enabled`, `onBack` runs
 * instead of leaving the screen: lessons and games ask first, like their close
 * buttons do, so a stray back swipe while dragging near the edge loses nothing.
 * Return false from `onBack` to let the screen go after all. (iOS has no back
 * button, and these screens turn off the swipe-back gesture.)
 */
export function useBackPress(enabled: boolean, onBack: () => boolean | void) {
  const handle = useEffectEvent(() => onBack() !== false);
  useEffect(() => {
    if (!enabled) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => handle());
    return () => subscription.remove();
  }, [enabled]);
}
