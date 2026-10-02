import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { Stars } from '@/components/ui/Stars';
import { allLessons, getSection } from '@/curriculum';
import { useProgressStore } from '@/state/progressStore';
import { colors, radii, spacing } from '@/theme';

/** Review completed lessons, weakest first. */
export function PracticeScreen() {
  const lessons = useProgressStore((state) => state.lessons);
  const completed = allLessons
    .filter((lesson) => lessons[lesson.id]?.completed)
    .sort((a, b) => (lessons[a.id]?.bestStars ?? 0) - (lessons[b.id]?.bestStars ?? 0));
  const needsWork = completed.filter((lesson) => (lessons[lesson.id]?.bestStars ?? 0) < 3);

  return (
    <Screen
      testID="practice-screen"
      header={
        <View style={styles.header}>
          <AppText variant="title">Practice</AppText>
          <AppText variant="small" color="textSecondary">
            Sharpen what you’ve learned.
          </AppText>
        </View>
      }
    >
      {completed.length === 0 ? (
        <Card style={styles.empty}>
          <Icon name="target" size={40} color="textMuted" />
          <AppText variant="subheading" align="center">
            Nothing to review yet
          </AppText>
          <AppText variant="small" color="textSecondary" align="center">
            Finish your first lesson and it will show up here for practice.
          </AppText>
        </Card>
      ) : (
        <>
          <AppText variant="label" color="textSecondary">
            {needsWork.length > 0 ? 'Earn more stars' : 'Review lessons'}
          </AppText>
          {completed.map((lesson) => {
            const section = getSection(lesson.sectionId);
            const stars = lessons[lesson.id]?.bestStars ?? 0;
            return (
              <Card
                key={lesson.id}
                testID={`review-${lesson.id}`}
                style={styles.row}
                accessibilityLabel={`Practice ${lesson.title}`}
                onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } })}
              >
                <View style={[styles.icon, { backgroundColor: section?.color ?? colors.primary }]}>
                  <Icon name={lesson.icon} size={22} color="textInverse" />
                </View>
                <View style={styles.flex}>
                  <AppText variant="subheading">{lesson.title}</AppText>
                  <AppText variant="caption" color="textSecondary">
                    {section?.title}
                  </AppText>
                </View>
                <Stars count={stars} size={16} />
              </Card>
            );
          })}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingVertical: spacing.md, gap: 2 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 44, height: 44, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
