import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { allLessons, getLesson, getSection } from '@/curriculum';
import { lessonStatus } from '@/features/learning/progression';
import { LessonPlayer } from '@/features/lessons/components/LessonPlayer';
import { useFeatureAccess } from '@/features/monetization/useFeatureAccess';
import { useCelebrationStore } from '@/state/celebrationStore';
import { useProgressStore } from '@/state/progressStore';
import { colors, SCREEN_GUTTER, spacing } from '@/theme';

export default function LessonRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lesson = id ? getLesson(id) : undefined;
  const lessons = useProgressStore((state) => state.lessons);
  const access = useFeatureAccess();
  const insets = useSafeAreaInsets();
  // Opening a freshly unlocked lesson counts as having seen it unlock.
  useEffect(() => {
    if (lesson) useCelebrationStore.getState().clearUnlock(lesson.id);
  }, [lesson]);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/learn');
  };

  if (lesson && !access.canAccessLesson(lesson.id)) {
    return (
      <View style={[styles.blocked, { paddingTop: insets.top + spacing.huge }]} testID="lesson-premium">
        <Icon name="crown" size={52} color={colors.star} />
        <AppText variant="title" align="center">
          Part of Premium
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          “{lesson.title}” is in {getSection(lesson.sectionId)?.title ?? 'an advanced course'}. The first lesson of every
          advanced course is free; Premium opens the rest.
        </AppText>
        <Button
          testID="lesson-see-premium"
          label="See Premium"
          icon="crown"
          onPress={() => router.replace({ pathname: '/paywall', params: { source: 'lesson' } })}
        />
        <Button label="Back to path" variant="ghost" size="medium" onPress={() => router.replace('/learn')} />
      </View>
    );
  }

  if (!lesson || lessonStatus(lesson.id, lessons, allLessons, access.canAccessLesson) === 'locked') {
    return (
      <View style={[styles.blocked, { paddingTop: insets.top + spacing.huge }]}>
        <Icon name="lock" size={48} color="textMuted" />
        <AppText variant="title" align="center">
          {lesson ? 'This lesson is locked' : 'Lesson not found'}
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          {lesson ? 'Finish the lessons before it on your path to unlock it.' : 'It may have moved in an update.'}
        </AppText>
        <Button label="Back to path" onPress={() => router.replace('/learn')} />
      </View>
    );
  }

  return (
    <LessonPlayer
      key={lesson.id}
      lesson={lesson}
      onExit={leave}
      onNextLesson={(nextId) => router.replace({ pathname: '/lesson/[id]', params: { id: nextId } })}
    />
  );
}

const styles = StyleSheet.create({
  blocked: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: SCREEN_GUTTER,
  },
});
