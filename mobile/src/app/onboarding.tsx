import { Redirect } from 'expo-router';
import { useState } from 'react';

import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { useProgressStore } from '@/state/progressStore';

export default function OnboardingRoute() {
  // Only consult the flag on entry: finishing onboarding navigates away by itself,
  // while this guards reloads and deep links once onboarding is done.
  const [alreadyDone] = useState(() => useProgressStore.getState().onboardingCompleted);
  if (alreadyDone) return <Redirect href="/" />;
  return <OnboardingScreen />;
}
