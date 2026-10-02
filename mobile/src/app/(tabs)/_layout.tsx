import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/navigation/TabBar';
import { isFeatureUnlocked } from '@/features/learning/progression';
import { useProgressStore } from '@/state/progressStore';
import { colors } from '@/theme';

export default function TabsLayout() {
  const onboardingCompleted = useProgressStore((state) => state.onboardingCompleted);
  const lessons = useProgressStore((state) => state.lessons);

  if (!onboardingCompleted) return <Redirect href="/onboarding" />;

  const locked = isFeatureUnlocked('play', lessons) ? [] : ['play'];

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
