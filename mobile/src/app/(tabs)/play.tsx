import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { PlayLockedView } from '@/features/gameplay/PlayLockedView';
import { useProgressStore } from '@/state/progressStore';
import { spacing } from '@/theme';

export default function PlayRoute() {
  const lessons = useProgressStore((state) => state.lessons);
  return (
    <Screen
      testID="play-screen"
      header={
        <View style={styles.header}>
          <AppText variant="title">Play</AppText>
        </View>
      }
    >
      <PlayLockedView records={lessons} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingVertical: spacing.md },
});
