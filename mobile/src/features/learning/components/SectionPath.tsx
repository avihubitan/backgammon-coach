import type { Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '@/components/ui/AppText';
import type { Lesson, Section } from '@/curriculum';
import { colors } from '@/theme';

import type { LessonStatus } from '../progression';
import { LessonNode, NODE_FACE } from './LessonNode';

export interface PathStop {
  lesson: Lesson;
  status: LessonStatus;
  stars: number;
  current: boolean;
  /** Plays the unlock animation on this stop. */
  revealing: boolean;
}

interface SectionPathProps {
  section: Section;
  stops: PathStop[];
  width: number;
  currentRef?: Ref<View>;
  onPress: (lesson: Lesson) => void;
  onRevealed: (lesson: Lesson) => void;
}

/** Room above each node for the "START" bubble. */
const NODE_TOP = 40;
const ROW_HEIGHT = 176;
const COLUMN = 120;
/** Horizontal offsets that make the path wind gently left and right. */
const WIGGLE = [0, 52, 78, 52, 0, -52, -78, -52];

const stopX = (width: number, index: number) => width / 2 + WIGGLE[index % WIGGLE.length];
const stopY = (index: number) => index * ROW_HEIGHT + NODE_TOP + NODE_FACE / 2;

function segment(width: number, index: number): string {
  const x0 = stopX(width, index);
  const y0 = stopY(index);
  const x1 = stopX(width, index + 1);
  const y1 = stopY(index + 1);
  const bend = (y1 - y0) * 0.55;
  return `M ${x0} ${y0} C ${x0} ${y0 + bend} ${x1} ${y1 - bend} ${x1} ${y1}`;
}

/**
 * One section of the learning path: lesson stops linked by a winding road.
 * The road is paved in the section colour up to where the learner has got to,
 * and dotted beyond.
 */
export function SectionPath({ section, stops, width, currentRef, onPress, onRevealed }: SectionPathProps) {
  const height = stops.length * ROW_HEIGHT;
  const segments = stops.slice(0, -1).map((stop, index) => ({
    d: segment(width, index),
    paved: stop.status === 'completed',
    revealing: stops[index + 1].revealing,
  }));

  return (
    <View style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height} style={styles.abs} pointerEvents="none">
          {segments.map((seg, index) => (
            <Path
              key={`shadow-${index}`}
              d={seg.d}
              stroke="rgba(0,0,0,0.45)"
              strokeWidth={seg.paved ? 16 : 0}
              fill="none"
              strokeLinecap="round"
              transform="translate(0, 4)"
            />
          ))}
          {segments.map((seg, index) =>
            seg.paved && !seg.revealing ? (
              <Path key={`road-${index}`} d={seg.d} stroke={section.color} strokeWidth={12} fill="none" strokeLinecap="round" />
            ) : (
              <Path
                key={`dots-${index}`}
                d={seg.d}
                stroke={colors.borderStrong}
                strokeWidth={8}
                fill="none"
                strokeLinecap="round"
                strokeDasharray="0.1 18"
              />
            ),
          )}
          {segments.map((seg, index) =>
            seg.paved && !seg.revealing ? (
              <Path
                key={`shine-${index}`}
                d={seg.d}
                stroke="rgba(255,255,255,0.28)"
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
                strokeDasharray="10 14"
                transform="translate(-2, -2)"
              />
            ) : null,
          )}
        </Svg>
      ) : null}

      {width > 0
        ? segments.map((seg, index) =>
            seg.revealing ? (
              // The road to a freshly unlocked lesson paves itself.
              <Animated.View
                key={`reveal-${index}`}
                style={[
                  styles.abs,
                  {
                    width,
                    height,
                    animationName: {
                      '0%': { opacity: 0 },
                      '60%': { opacity: 1 },
                      '100%': { opacity: 1 },
                    },
                    animationDuration: 700,
                    animationDelay: 250,
                    animationFillMode: 'backwards',
                  },
                  { pointerEvents: 'none' },
                ]}
              >
                <Svg width={width} height={height}>
                  <Path d={seg.d} stroke={section.color} strokeWidth={12} fill="none" strokeLinecap="round" />
                </Svg>
              </Animated.View>
            ) : null,
          )
        : null}

      {stops.map((stop, index) => (
        <View
          key={stop.lesson.id}
          ref={stop.current ? currentRef : undefined}
          style={[styles.stop, { left: stopX(width, index) - COLUMN / 2, top: index * ROW_HEIGHT, paddingTop: NODE_TOP }]}
        >
          <LessonNode
            testID={`lesson-node-${stop.lesson.id}`}
            icon={stop.lesson.icon}
            status={stop.status}
            stars={stop.stars}
            color={section.color}
            current={stop.current}
            label={stop.lesson.title}
            revealing={stop.revealing}
            onRevealed={() => onRevealed(stop.lesson)}
            onPress={() => onPress(stop.lesson)}
          />
          <AppText
            variant="caption"
            color={(stop.status === 'locked' || stop.status === 'premium') && !stop.revealing ? 'textMuted' : 'textSecondary'}
            align="center"
            style={styles.label}
            numberOfLines={2}
          >
            {stop.lesson.title}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
  stop: { position: 'absolute', width: COLUMN, alignItems: 'center' },
  label: {
    maxWidth: COLUMN,
    marginTop: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
});
