import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { PlayHub } from '@/features/gameplay/PlayHub';
import { PlayLockedView } from '@/features/gameplay/PlayLockedView';
import { isFeatureUnlocked } from '@/features/learning/progression';
import { useProgressStore } from '@/state/progressStore';
import { spacing } from '@/theme';

export default function PlayRoute() {
  const lessons = useProgressStore((state) => state.lessons);
  const unlocked = isFeatureUnlocked('play', lessons);
  return (
    <Screen
      testID="play-screen"
      header={
        <View style={styles.header}>
          <AppText variant="title">Play</AppText>
          {unlocked ? (
            <AppText variant="small" color="textSecondary">
              Full games against the computer.
            </AppText>
          ) : null}
        </View>
      }
    >
      {unlocked ? <PlayHub /> : <PlayLockedView records={lessons} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingVertical: spacing.md, gap: 2 },
});
