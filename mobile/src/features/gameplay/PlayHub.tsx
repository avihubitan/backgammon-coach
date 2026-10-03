import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ToggleRow } from '@/components/ui/Toggle';
import type { AiLevel } from '@/game';
import { haptics } from '@/services/haptics';
import { useGameStore } from '@/state/gameStore';
import { useProgressStore } from '@/state/progressStore';
import { useSettingsStore } from '@/state/settingsStore';
import { colors, radii, spacing } from '@/theme';
import { analytics } from '@/services/analytics';

const LEVELS: { id: AiLevel; title: string; description: string; icon: IconName; color: string }[] = [
  {
    id: 'beginner',
    title: 'Beginner',
    description: 'Plays sensibly but makes understandable mistakes.',
    icon: 'sprout',
    color: colors.success,
  },
  {
    id: 'intermediate',
    title: 'Intermediate',
    description: 'Solid, reasonable strategy. A fair fight.',
    icon: 'chess-knight',
    color: colors.info,
  },
  {
    id: 'advanced',
    title: 'Advanced',
    description: 'A neural network trained on 300,000 games. A real challenge.',
    icon: 'crown',
    color: colors.primary,
  },
];

const MATCH_LENGTHS = [1, 3, 5];

/** `early`: the learner knows the board but hasn't met every rule yet. */
export function PlayHub({ early = false }: { early?: boolean }) {
  const active = useGameStore((store) => store.active);
  const finished = useGameStore((store) => store.finished);
  const stats = useGameStore((store) => store.stats);
  const settings = useGameStore((store) => store.lastSettings);
  const startGame = useGameStore((store) => store.startGame);
  const lessons = useProgressStore((state) => state.lessons);
  const cubeLearned = !!lessons['cube-1']?.completed;
  const coachWatch = useSettingsStore((state) => state.coachWatch);
  const updateSettings = useSettingsStore((state) => state.update);

  const setSettings = (patch: Partial<typeof settings>) => useGameStore.setState({ lastSettings: { ...settings, ...patch } });
  const resumable = active && active.state.phase !== 'finished';

  return (
    <View style={styles.wrap}>
      {resumable ? (
        <Card tone="accent" style={styles.resume} testID="resume-card">
          <View style={styles.flex}>
            <AppText variant="label" color="primary">
              Game in progress
            </AppText>
            <AppText variant="subheading">
              vs {LEVELS.find((level) => level.id === active.settings.level)?.title} computer
            </AppText>
            <AppText variant="small" color="textSecondary">
              {active.state.currentPlayer === 'player1' ? 'It’s your turn.' : 'Waiting for the computer.'}
            </AppText>
          </View>
          <Button testID="resume-game" label="Resume" fullWidth={false} size="medium" onPress={() => router.push('/game')} />
        </Card>
      ) : null}

      {early && !resumable ? (
        <Card style={styles.early} testID="play-early-note">
          <Icon name="school" size={22} color={colors.info} />
          <View style={styles.flex}>
            <AppText variant="smallStrong">New to some of the rules? That’s fine.</AppText>
            <AppText variant="small" color="textSecondary">
              The board only lets you make legal moves, and the coach can show you the best one. Hitting and
              bearing off get their own lessons later.
            </AppText>
          </View>
        </Card>
      ) : null}

      <AppText variant="label" color="textSecondary">
        Choose your opponent
      </AppText>
      <View style={styles.levels}>
        {LEVELS.map((level) => {
          const selectedLevel = settings.level === level.id;
          const record = `${stats.winsByLevel[level.id] ?? 0}–${(stats.playedByLevel[level.id] ?? 0) - (stats.winsByLevel[level.id] ?? 0)}`;
          return (
            <Pressable
              key={level.id}
              testID={`level-${level.id}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedLevel }}
              onPress={() => {
                haptics.tap();
                setSettings({ level: level.id });
              }}
              style={[styles.level, selectedLevel && { borderColor: level.color, backgroundColor: colors.surfaceRaised }]}
            >
              <View style={[styles.levelIcon, { backgroundColor: selectedLevel ? level.color : colors.surfaceRaised }]}>
                <Icon name={level.icon} size={24} color={selectedLevel ? colors.textInverse : level.color} />
              </View>
              <View style={styles.flex}>
                <AppText variant="subheading">{level.title}</AppText>
                <AppText variant="small" color="textSecondary">
                  {level.description}
                </AppText>
              </View>
              <AppText variant="caption" color="textMuted">
                {record}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <Card style={styles.options}>
        <AppText variant="bodyStrong">Game length</AppText>
        <View style={styles.segment}>
          {MATCH_LENGTHS.map((length) => {
            const selectedLength = settings.matchLength === length;
            return (
              <Pressable
                key={length}
                testID={`match-${length}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: selectedLength }}
                onPress={() => setSettings({ matchLength: length })}
                style={[styles.segmentItem, selectedLength && styles.segmentItemActive]}
              >
                <AppText variant="smallStrong" color={selectedLength ? 'textInverse' : 'textSecondary'}>
                  {length === 1 ? 'Single game' : `Match to ${length}`}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.divider} />
        <ToggleRow
          testID="cube-toggle"
          label="Doubling cube"
          description={cubeLearned ? 'Raise the stakes during the game.' : 'You’ll learn the cube in “The Doubling Cube”.'}
          value={settings.cubeEnabled}
          onChange={(cubeEnabled) => setSettings({ cubeEnabled })}
        />
        <View style={styles.divider} />
        <ToggleRow
          testID="coach-watch-toggle"
          label="Coach Watch"
          description="Your coach asks “Are you sure?” before you confirm a clear mistake, with a clue."
          value={coachWatch}
          onChange={(on) => updateSettings({ coachWatch: on })}
        />
      </Card>

      <Button
        testID="start-game"
        label={resumable ? 'Start a new game' : 'Start game'}
        icon="dice-multiple"
        variant={resumable ? 'secondary' : 'primary'}
        onPress={() => {
          startGame(settings);
          analytics.track('game_started', { mode: 'ai', level: settings.level, match_length: settings.matchLength });
          analytics.track('ai_game_started', { level: settings.level, match_length: settings.matchLength });
          router.push('/game');
        }}
      />

      {stats.gamesPlayed > 0 ? (
        <>
          <AppText variant="label" color="textSecondary">
            Your record
          </AppText>
          <View style={styles.recordRow}>
            <Record label="Played" value={stats.gamesPlayed} />
            <Record label="Won" value={stats.gamesWon} />
            <Record label="Win rate" value={`${Math.round((stats.gamesWon / stats.gamesPlayed) * 100)}%`} />
            <Record label="Gammons" value={stats.gammonsWon} />
          </View>
        </>
      ) : null}

      {finished.length > 0 ? (
        <>
          <AppText variant="label" color="textSecondary">
            Recent games
          </AppText>
          {finished.slice(0, 8).map((game) => (
            <Card
              key={game.id}
              style={styles.recent}
              testID={`recent-${game.id}`}
              accessibilityLabel={`${game.playerWon ? 'Won' : 'Lost'} against ${game.level}`}
              onPress={() => router.push({ pathname: '/review/[id]', params: { id: game.id, from: 'history' } })}
            >
              <View style={[styles.resultDot, { backgroundColor: game.playerWon ? colors.success : colors.danger }]}>
                <AppText variant="caption" color="textInverse">
                  {game.playerWon ? 'W' : 'L'}
                </AppText>
              </View>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">
                  {game.playerWon ? 'Won' : 'Lost'} {game.result.type === 'single' ? '' : `(${game.result.type}) `}vs{' '}
                  {LEVELS.find((level) => level.id === game.level)?.title}
                </AppText>
                <AppText variant="caption" color="textSecondary">
                  {new Date(game.finishedAt).toLocaleDateString()} · {game.result.points} pt
                  {game.result.points === 1 ? '' : 's'}
                </AppText>
              </View>
              <AppText variant="caption" color="primary">
                Review
              </AppText>
              <Icon name="chevron-right" size={20} color="textMuted" />
            </Card>
          ))}
        </>
      ) : null}
    </View>
  );
}

function Record({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.record}>
      <AppText variant="title">{value}</AppText>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  early: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: colors.infoSoft },
  wrap: { gap: spacing.lg },
  flex: { flex: 1 },
  resume: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  levels: { gap: spacing.sm },
  level: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  levelIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  options: { gap: spacing.md },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    padding: 4,
    gap: 4,
  },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radii.md },
  segmentItemActive: { backgroundColor: colors.primary },
  divider: { height: 1, backgroundColor: colors.border },
  recordRow: { flexDirection: 'row', gap: spacing.sm },
  record: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  resultDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
