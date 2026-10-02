import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { iconFont } from '@/components/ui/Icon';
import { soundBank } from '@/services/feedback';
import { useHydration } from '@/state/useHydration';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    primary: colors.primary,
    text: colors.text,
    border: colors.border,
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    ...iconFont,
  });
  const hydrated = useHydration();
  const ready = (fontsLoaded || !!fontError) && hydrated;

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => {});
    soundBank.preload();
  }, [ready]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'fade',
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
            <Stack.Screen
              name="lesson/[id]"
              options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
            />
            <Stack.Screen name="game" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
            <Stack.Screen name="review/[id]" options={{ animation: 'slide_from_right' }} />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
