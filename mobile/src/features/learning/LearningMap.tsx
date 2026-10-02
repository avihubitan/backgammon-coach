import { router, useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen } from '@/components/ui/Screen';
import { allLessons, curriculum, sectionNumber, type Lesson, type Section } from '@/curriculum';
import { useFeatureAccess } from '@/features/monetization/useFeatureAccess';
import { useCelebrationStore } from '@/state/celebrationStore';
import { useProgressStore } from '@/state/progressStore';
import { colors, MAX_CONTENT_WIDTH, radii, SCREEN_GUTTER, spacing } from '@/theme';

import { LessonSheet } from './components/LessonSheet';
import { SectionPath } from './components/SectionPath';
import { blockingLesson, lessonStatus, nextLesson, sectionProgress } from './progression';

export function LearningMap() {
  const lessons = useProgressStore((state) => state.lessons);
  const pendingUnlock = useCelebrationStore((state) => state.pendingUnlock);
  const clearUnlock = useCelebrationStore((state) => state.clearUnlock);
  const focused = useIsFocused();
  const { width: windowWidth } = useWindowDimensions();
  const [pathWidth, setPathWidth] = useState(() => Math.min(windowWidth, MAX_CONTENT_WIDTH) - SCREEN_GUTTER * 2);
  const [selected, setSelected] = useState<{ lesson: Lesson; section: Section } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const currentNodeRef = useRef<View>(null);
  const access = useFeatureAccess();
  const canAccess = access.canAccessLesson;
  const upNext = nextLesson(lessons, allLessons, canAccess);
  const pathComplete = allLessons.every((lesson) => lessons[lesson.id]?.completed);
  const totalLessons = curriculum.reduce((sum, section) => sum + section.lessons.length, 0);
  const completedLessons = Object.values(lessons).filter((record) => record.completed).length;
  const totalStars = Object.values(lessons).reduce((sum, record) => sum + record.bestStars, 0);

  // Only reveal a fresh unlock while the map is actually on screen.
  const revealing = focused ? pendingUnlock : null;

  // Bring the next lesson into view when the map opens, and when a new lesson unlocks.
  useEffect(() => {
    const timer = setTimeout(() => {
      currentNodeRef.current?.measureInWindow((_x, y) => {
        if (y > 420 || y < 80) scrollRef.current?.scrollTo({ y: Math.max(0, y - 320), animated: !!revealing });
      });
    }, 60);
    return () => clearTimeout(timer);
  }, [revealing]);

  const start = (lesson: Lesson) => {
    setSelected(null);
    router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } });
  };

  return (
    <Screen
      testID="learn-screen"
      scrollRef={scrollRef}
      header={
        <View style={styles.header}>
          <AppText variant="title">Your path</AppText>
          <View style={styles.headerStats}>
            <View style={styles.headerStat}>
              <Icon name="check-circle" size={16} color={colors.success} />
              <AppText variant="smallStrong" color="textSecondary">
                {completedLessons}/{totalLessons}
              </AppText>
            </View>
            <View style={styles.headerStat}>
              <Icon name="star" size={16} color={colors.star} />
              <AppText variant="smallStrong" color="textSecondary">
                {totalStars}
              </AppText>
            </View>
          </View>
        </View>
      }
    >
      {curriculum.map((section, sectionIndex) => {
        const stats = sectionProgress(section, lessons, allLessons, canAccess);
        const sectionRevealing = !!revealing && section.lessons[0]?.id === revealing;
        const premium = section.lessons.some((lesson) => !canAccess(lesson.id));
        const previous = curriculum[sectionIndex - 1];
        const lockedHint =
          previous && previous.lessons.some((lesson) => !canAccess(lesson.id))
            ? 'Finish the free lessons before it to unlock'
            : 'Finish the previous section to unlock';
        return (
          <View key={section.id} style={styles.section}>
            <Animated.View
              style={[
                styles.banner,
                {
                  backgroundColor: stats.unlocked ? section.color : colors.surface,
                  borderColor: stats.unlocked ? section.color : colors.border,
                },
                sectionRevealing
                  ? {
                      animationName: {
                        '0%': { opacity: 0.4, transform: [{ scale: 0.96 }] },
                        '60%': { opacity: 1, transform: [{ scale: 1.03 }] },
                        '100%': { opacity: 1, transform: [{ scale: 1 }] },
                      },
                      animationDuration: 600,
                      animationDelay: 900,
                      animationFillMode: 'backwards',
                    }
                  : null,
              ]}
              testID={`section-${section.id}`}
            >
              <View style={styles.bannerText}>
                <View style={styles.bannerLabelRow}>
                  <AppText variant="label" color={stats.unlocked ? 'textInverse' : 'textMuted'}>
                    Section {sectionNumber(section.id)}
                    {stats.done ? ' · Complete' : ''}
                  </AppText>
                  {premium ? (
                    <View
                      style={[styles.premiumChip, stats.unlocked && styles.premiumChipOnColor]}
                      testID={`section-premium-${section.id}`}
                    >
                      <Icon name="crown" size={12} color={stats.unlocked ? 'rgba(16,14,10,0.8)' : colors.star} />
                      <AppText variant="caption" color={stats.unlocked ? 'rgba(16,14,10,0.8)' : colors.star}>
                        PREMIUM
                      </AppText>
                    </View>
                  ) : null}
                </View>
                <AppText variant="heading" color={stats.unlocked ? 'textInverse' : 'textSecondary'}>
                  {section.title}
                </AppText>
                <AppText variant="small" color={stats.unlocked ? 'rgba(16,14,10,0.75)' : 'textMuted'}>
                  {stats.unlocked ? section.subtitle : lockedHint}
                </AppText>
                {stats.unlocked ? (
                  <View style={styles.bannerProgress}>
                    <View style={styles.flex}>
                      <ProgressBar
                        progress={stats.fraction}
                        color="rgba(16,14,10,0.7)"
                        trackColor="rgba(16,14,10,0.18)"
                        height={8}
                        shine={false}
                      />
                    </View>
                    <AppText variant="caption" color="rgba(16,14,10,0.8)">
                      {stats.completed}/{stats.total}
                    </AppText>
                  </View>
                ) : null}
              </View>
              <View style={[styles.bannerIcon, !stats.unlocked && styles.bannerIconLocked]}>
                <Icon
                  name={stats.unlocked ? section.icon : 'lock'}
                  size={30}
                  color={stats.unlocked ? 'rgba(16,14,10,0.8)' : colors.textMuted}
                />
              </View>
            </Animated.View>

            <View onLayout={(event) => setPathWidth(event.nativeEvent.layout.width)}>
              <SectionPath
                section={section}
                width={pathWidth}
                currentRef={currentNodeRef}
                stops={section.lessons.map((lesson) => ({
                  lesson,
                  status: lessonStatus(lesson.id, lessons, allLessons, canAccess),
                  stars: lessons[lesson.id]?.bestStars ?? 0,
                  current: upNext?.id === lesson.id,
                  revealing: revealing === lesson.id,
                }))}
                onPress={(lesson) => setSelected({ lesson, section })}
                onRevealed={(lesson) => clearUnlock(lesson.id)}
              />
            </View>
          </View>
        );
      })}

      <View style={styles.finish}>
        <View style={[styles.trophy, pathComplete ? null : styles.trophyLocked]}>
          <Icon name="trophy" size={38} color={pathComplete ? colors.primary : colors.textMuted} />
        </View>
        <AppText variant="subheading" color={pathComplete ? 'primary' : 'textMuted'}>
          Mastery
        </AppText>
        <AppText variant="small" color="textMuted" align="center">
          {pathComplete ? 'Path complete. You’ve mastered the course!' : 'Finish every lesson to complete your path.'}
        </AppText>
      </View>

      <LessonSheet
        lesson={selected?.lesson ?? null}
        status={selected ? lessonStatus(selected.lesson.id, lessons, allLessons, canAccess) : 'locked'}
        record={selected ? lessons[selected.lesson.id] : undefined}
        color={selected?.section.color ?? colors.primary}
        requiresPremium={selected ? !canAccess(selected.lesson.id) : false}
        preview={selected ? access.isPreviewLesson(selected.lesson.id) : false}
        blockedBy={selected ? blockingLesson(selected.lesson.id, lessons, allLessons, canAccess) : null}
        onStart={start}
        onUpgrade={() => {
          setSelected(null);
          router.push({ pathname: '/paywall', params: { source: 'lesson' } });
        }}
        onClose={() => setSelected(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  headerStats: { flexDirection: 'row', gap: spacing.md },
  headerStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  section: { gap: spacing.xl },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
  },
  bannerText: { flex: 1, gap: 2 },
  bannerLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  premiumChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
  },
  premiumChipOnColor: { backgroundColor: 'rgba(255,255,255,0.3)' },
  bannerProgress: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  bannerIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerIconLocked: { backgroundColor: colors.surfaceRaised },
  flex: { flex: 1 },
  finish: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xxl },
  trophy: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  trophyLocked: { backgroundColor: colors.surface, borderColor: colors.border },
});
