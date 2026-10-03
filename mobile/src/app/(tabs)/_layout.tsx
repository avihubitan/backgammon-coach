import { Redirect, useIsFocused } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';

import { TabBar } from '@/components/navigation/TabBar';
import { playAccess } from '@/features/learning/progression';
import { soundBank } from '@/services/feedback';
import { useProgressStore } from '@/state/progressStore';
import { colors } from '@/theme';

export default function TabsLayout() {
  const onboardingCompleted = useProgressStore((state) => state.onboardingCompleted);
  const lessons = useProgressStore((state) => state.lessons);
  const focused = useIsFocused();

  // Menu music (if switched on) plays on the tabs and fades out in lessons and games.
  useEffect(() => {
    soundBank.setMusicScene(focused && onboardingCompleted ? 'menu' : null);
    return () => soundBank.setMusicScene(null);
  }, [focused, onboardingCompleted]);

  if (!onboardingCompleted) return <Redirect href="/onboarding" />;

  const locked = playAccess(lessons) === 'locked' ? ['play'] : [];

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} locked={locked} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="learn" />
      <Tabs.Screen name="play" />
      <Tabs.Screen name="practice" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
