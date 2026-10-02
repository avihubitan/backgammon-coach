import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen } from '@/components/ui/Screen';
import { curriculum, sectionNumber, type Lesson, type Section } from '@/curriculum';
import { useProgressStore } from '@/state/progressStore';
import { colors, radii, spacing } from '@/theme';

import { LessonNode } from './components/LessonNode';
import { LessonSheet } from './components/LessonSheet';
import { lessonStatus, nextLesson, sectionProgress } from './progression';

/** Horizontal offsets that make the path wind gently left and right. */
const WIGGLE = [0, 52, 78, 52, 0, -52, -78, -52];

export function LearningMap() {
  const lessons = useProgressStore((state) => state.lessons);
  const [selected, setSelected] = useState<{ lesson: Lesson; section: Section } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const currentNodeRef = useRef<View>(null);
  const upNext = nextLesson(lessons);
  const totalLessons = curriculum.reduce((sum, section) => sum + section.lessons.length, 0);
  const completedLessons = Object.values(lessons).filter((record) => record.completed).length;
  const totalStars = Object.values(lessons).reduce((sum, record) => sum + record.bestStars, 0);

  // Bring the next lesson into view when the map opens.
  useEffect(() => {
    const timer = setTimeout(() => {
      currentNodeRef.current?.measureInWindow((_x, y) => {
        if (y > 420) scrollRef.current?.scrollTo({ y: y - 320, animated: false });
      });
    }, 60);
    return () => clearTimeout(timer);
  }, []);

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
      {curriculum.map((section) => {
        const stats = sectionProgress(section, lessons);
        return (
          <View key={section.id} style={styles.section}>
            <View
              style={[
                styles.banner,
                {
                  backgroundColor: stats.unlocked ? section.color : colors.surface,
                  borderColor: stats.unlocked ? section.color : colors.border,
                },
              ]}
              testID={`section-${section.id}`}
            >
              <View style={styles.bannerText}>
                <AppText variant="label" color={stats.unlocked ? 'textInverse' : 'textMuted'}>
                  Section {sectionNumber(section.id)}
                  {stats.done ? ' · Complete' : ''}
                </AppText>
                <AppText variant="heading" color={stats.unlocked ? 'textInverse' : 'textSecondary'}>
                  {section.title}
                </AppText>
                <AppText variant="small" color={stats.unlocked ? 'rgba(16,14,10,0.75)' : 'textMuted'}>
                  {stats.unlocked ? section.subtitle : `Finish the previous section to unlock`}
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
            </View>

            <View style={styles.path}>
              {section.lessons.map((lesson, index) => {
                const status = lessonStatus(lesson.id, lessons);
                const current = upNext?.id === lesson.id;
                return (
                  <View
                    key={lesson.id}
                    ref={current ? currentNodeRef : undefined}
                    style={[styles.nodeRow, { transform: [{ translateX: WIGGLE[index % WIGGLE.length] }] }]}
                  >
                    <LessonNode
                      testID={`lesson-node-${lesson.id}`}
                      icon={lesson.icon}
                      status={status}
                      stars={lessons[lesson.id]?.bestStars ?? 0}
                      color={section.color}
                      current={current}
                      label={lesson.title}
                      onPress={() => setSelected({ lesson, section })}
                    />
                    <AppText
                      variant="caption"
                      color={status === 'locked' ? 'textMuted' : 'textSecondary'}
                      align="center"
                      style={styles.nodeLabel}
                      numberOfLines={2}
                    >
                      {lesson.title}
                    </AppText>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}

      <View style={styles.finish}>
        <View style={[styles.trophy, upNext ? styles.trophyLocked : null]}>
          <Icon name="trophy" size={38} color={upNext ? colors.textMuted : colors.primary} />
        </View>
        <AppText variant="subheading" color={upNext ? 'textMuted' : 'primary'}>
          Mastery
        </AppText>
        <AppText variant="small" color="textMuted" align="center">
          {upNext ? 'Finish every lesson to complete your path.' : 'Path complete. You’ve mastered the course!'}
        </AppText>
      </View>

      <LessonSheet
        lesson={selected?.lesson ?? null}
        status={selected ? lessonStatus(selected.lesson.id, lessons) : 'locked'}
        record={selected ? lessons[selected.lesson.id] : undefined}
        color={selected?.section.color ?? colors.primary}
        onStart={start}
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
  path: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  nodeRow: { alignItems: 'center', paddingTop: 44 },
  nodeLabel: { width: 120, marginTop: 2 },
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
