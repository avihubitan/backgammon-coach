import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackgammonBoard } from '@/components/board/BackgammonBoard';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useBackPress } from '@/components/system/useBackPress';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import { canDouble, canEndTurn, pipCount, type Player } from '@/game';
import { useGameStore } from '@/state/gameStore';
import { useSettingsStore } from '@/state/settingsStore';
import { colors, MAX_CONTENT_WIDTH, SCREEN_GUTTER, spacing } from '@/theme';
import type { BoardArrow, BoardDice } from '@/types/board';

import { CoachHintBubble } from './components/CoachHintBubble';
import { CoachWatchPanel } from './components/CoachWatchPanel';
import { GameResultSheet } from './components/GameResultSheet';
import { Seat } from './components/Seat';
import { gameLayout } from './gameLayout';
import { gameStatus, HOW_TO_GAMES } from './gameStatus';
import { usedDice } from './moveInput';
import { useGameController } from './useGameController';

const STATUS_COLOR = { neutral: 'textSecondary', info: 'text', warning: 'streak' } as const;

const TABLE_ENTRANCE = {
  animationName: { from: { opacity: 0, transform: [{ scale: 0.965 }] }, to: { opacity: 1, transform: [{ scale: 1 }] } },
  animationDuration: 360,
  animationTimingFunction: 'ease-out',
} as const;

/** Once the board has settled, the first button breathes gently. */
const INVITE = {
  animationName: { from: { transform: [{ scale: 1 }] }, to: { transform: [{ scale: 1.025 }] } },
  animationDuration: 900,
  animationDelay: 900,
  animationIterationCount: 'infinite',
  animationDirection: 'alternate',
  animationTimingFunction: 'ease-in-out',
} as const;

const FADE_IN = {
  animationName: { from: { opacity: 0, transform: [{ translateY: 4 }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } },
  animationDuration: 200,
} as const;

export function GameScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const game = useGameController();
  const settings = useSettingsStore();
  const startGame = useGameStore((store) => store.startGame);
  const continueMatch = useGameStore((store) => store.continueMatch);
  const abandonGame = useGameStore((store) => store.abandonGame);
  const gamesPlayed = useGameStore((store) => store.stats.gamesPlayed);
  const [confirm, setConfirm] = useState<'leave' | 'resign' | null>(null);
  // Android back asks first, like the close button. Open dialogs and the result sheet handle back themselves.
  useBackPress(!!game.active && !!game.state && confirm === null && !game.outcome, () => setConfirm('leave'));

  const { active, state } = game;
  if (!active || !state) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <AppText variant="title">No game in progress</AppText>
        <Button label="Back to Play" fullWidth={false} onPress={() => router.replace('/play')} />
      </View>
    );
  }

  const layout = gameLayout(width, height, insets);
  const opponent = game.opponent;
  const isMatch = active.settings.matchLength > 1;
  const humanTurn = state.currentPlayer === 'player1';
  const playing = state.phase !== 'finished' && state.phase !== 'opening';
  const aiThinking =
    playing &&
    ((state.currentPlayer === 'player2' && state.phase !== 'doubling') ||
      (state.phase === 'doubling' && state.doubleOfferedBy === 'player1'));
  const yourMove = playing && !aiThinking;
  const turn = state.turn;
  const arrows: BoardArrow[] =
    game.lastAiPlay && state.phase === 'rolling' && humanTurn
      ? game.lastAiPlay.moves.map((move) => ({ from: move.from, to: move.to, player: 'player2', tone: 'info' }))
      : (game.hintMoves ?? []).map((move) => ({ from: move.from, to: move.to, tone: 'hint' }));

  const askHint = () => {
    if (game.requestHint() === 'locked') router.push({ pathname: '/paywall', params: { source: 'game_hint' } });
  };

  const status = gameStatus({
    state,
    message: game.message,
    messageTone: game.messageTone,
    lastAiPlay: game.lastAiPlay,
    opponentName: opponent.name,
    showHowTo: gamesPlayed < HOW_TO_GAMES,
  });
  const off = state.board.off;
  // The opening roll: each side's die on its own half; once decided, the two
  // dice slide together and are the first roll (each keeping its colour).
  const opening = active.openingRoll;
  const fromOpening =
    !!opening &&
    !!turn?.roll &&
    state.history.length === 0 &&
    opening.player1 !== opening.player2 &&
    turn.roll[0] === opening.player1 &&
    turn.roll[1] === opening.player2;
  const boardDice: BoardDice | null =
    state.phase === 'opening'
      ? opening && state.openingTies.length > 0
        ? { values: [opening.player1, opening.player2], player: 'player1', owners: ['player1', 'player2'], split: true, rollId: game.rollId, animate: true }
        : null
      : turn
        ? {
            values: turn.dice,
            used: usedDice(turn),
            player: state.currentPlayer,
            rollId: game.rollId,
            animate: true,
            ...(fromOpening
              ? {
                  owners: ['player1', 'player2'] as Player[],
                  split: game.openingReveal,
                  winner: game.openingReveal && opening ? (opening.player1 > opening.player2 ? 0 : 1) : null,
                }
              : null),
          }
        : null;
  // A new game: the board and its checkers settle in, and "Roll to start" invites the first tap.
  const fresh = state.phase === 'opening' && state.openingTies.length === 0;
  const panelWidth = Math.min(width, MAX_CONTENT_WIDTH) - 2 * SCREEN_GUTTER;
  // Narrow phones (under 360 pt): rows of buttons drop their icons and tighten so labels fit.
  const narrow = width < 360;

  const newGame = () => {
    game.clearOutcome();
    startGame(active.settings);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={[styles.topBar, { height: layout.topBar }]}>
        <IconButton icon="close" accessibilityLabel="Leave game" onPress={() => setConfirm('leave')} testID="game-close" />
        <View style={styles.title}>
          <AppText variant="label" color="textMuted" numberOfLines={1}>
            {isMatch ? `Match to ${active.settings.matchLength} · Game ${active.gameNumber}` : 'Single game'}
          </AppText>
        </View>
        <IconButton
          icon="flag-outline"
          accessibilityLabel="Resign"
          onPress={() => setConfirm('resign')}
          disabled={state.phase === 'finished'}
          testID="game-resign"
        />
      </View>

      <View style={styles.middle}>
        <View style={styles.spacer} />
        <Animated.View
          key={`${active.id}-${active.gameNumber}`}
          style={[styles.table, { width: layout.boardWidth }, fresh ? TABLE_ENTRANCE : null]}
        >
          <Seat
            testID="seat-opponent"
            name={opponent.name}
            detail={`${opponent.title} · ${pipCount(state.board, 'player2')} pips${off.player2 > 0 ? ` · ${off.player2} off` : ''}`}
            avatar={{ icon: opponent.icon, color: opponent.color }}
            active={aiThinking}
            activity={aiThinking ? 'thinking' : null}
            cube={active.settings.cubeEnabled && state.cube.owner === 'player2' ? state.cube.value : null}
            score={isMatch ? active.match.player2 : null}
            height={layout.seat}
            compact={layout.compact}
            speech={game.speech}
          />
          <BackgammonBoard
            testID="game-board"
            board={state.board}
            width={layout.boardWidth}
            layoutKey={`${active.id}-${active.gameNumber}`}
            showPointNumbers={settings.showPointNumbers}
            dice={boardDice}
            entrance={fresh}
            refusal={game.refusal}
            cube={active.settings.cubeEnabled ? state.cube : null}
            selected={humanTurn ? game.selected : null}
            movable={settings.showMovableHints && game.selected === null ? game.movable : []}
            targets={game.targets}
            arrows={arrows}
            onPressPoint={game.tap}
            onPressBar={() => game.tap('bar')}
            onPressOff={(how) => game.tap('off', how)}
          />
          <Seat
            testID="seat-you"
            name="You"
            detail={`${pipCount(state.board, 'player1')} pips${off.player1 > 0 ? ` · ${off.player1} off` : ''}`}
            avatar={{ checker: 'player1' }}
            active={yourMove}
            activity={yourMove ? 'your-turn' : null}
            cube={active.settings.cubeEnabled && state.cube.owner === 'player1' ? state.cube.value : null}
            score={isMatch ? active.match.player1 : null}
            height={layout.seat}
            compact={layout.compact}
          />
        </Animated.View>
        <View style={[styles.panel, { height: layout.panel, width: panelWidth }]}>
          <ScrollView contentContainerStyle={styles.panelContent} showsVerticalScrollIndicator={false}>
            {game.watch ? (
              <CoachWatchPanel
                verdict={game.watch}
                lastFree={game.watchLeft === 0}
                onPlayAnyway={() => game.answerWatch('play')}
                compact={layout.compact}
              />
            ) : game.hint ? (
              <CoachHintBubble hint={game.hint} following={game.hintMoves !== null} compact={layout.compact} />
            ) : status ? (
              <Animated.View key={status.text} style={FADE_IN}>
                <AppText
                  variant={layout.compact ? 'smallStrong' : 'bodyStrong'}
                  align="center"
                  testID="game-status"
                  color={STATUS_COLOR[status.tone]}
                >
                  {status.text}
                </AppText>
              </Animated.View>
            ) : null}
          </ScrollView>
        </View>
        <View style={styles.spacer} />
      </View>

      <View style={[styles.actions, { height: layout.actions + layout.bottomInset, paddingBottom: layout.bottomInset }]}>
        {state.phase === 'opening' ? (
          <Animated.View style={fresh ? INVITE : null}>
            <Button testID="roll-opening" label="Roll to start" icon="dice-multiple" onPress={game.rollOpening} />
          </Animated.View>
        ) : state.phase === 'rolling' && humanTurn ? (
          <View style={styles.row}>
            {canDouble(state) ? (
              <View style={styles.flex}>
                <Button testID="double" label={`Double to ${state.cube.value * 2}`} variant="secondary" dense={narrow} onPress={game.double} />
              </View>
            ) : null}
            <View style={styles.flex}>
              <Button testID="roll" label="Roll" icon="dice-multiple" dense={narrow} onPress={game.roll} />
            </View>
          </View>
        ) : game.watch ? (
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button testID="coach-watch-retry" label="Try again" variant="secondary" dense={narrow} onPress={() => game.answerWatch('retry')} />
            </View>
            <View style={styles.flex}>
              <Button
                testID="coach-watch-show"
                label="Show me"
                icon={narrow ? undefined : 'lightbulb-on-outline'}
                dense={narrow}
                onPress={() => game.answerWatch('show')}
              />
            </View>
          </View>
        ) : state.phase === 'moving' && humanTurn && !game.dancing ? (
          <View style={styles.row}>
            <Button
              testID="hint"
              iconOnly
              fullWidth={false}
              label={game.hintsLeft === null ? 'Hint' : `Hint, ${game.hintsLeft} left`}
              icon={game.hintsLeft === 0 && !game.hint ? 'crown' : 'lightbulb-on-outline'}
              badge={game.hintsLeft === null || game.hintsLeft === 0 ? null : game.hintsLeft}
              variant="secondary"
              accessibilityHint="Shows the coach’s move for this roll"
              disabled={game.busy}
              onPress={askHint}
            />
            <View style={styles.flex}>
              <Button
                testID="undo"
                label="Undo"
                icon={narrow ? undefined : 'undo-variant'}
                dense={narrow}
                variant="secondary"
                disabled={!turn || turn.moves.length === 0 || game.busy}
                onPress={game.undo}
              />
            </View>
            <View style={styles.flex}>
              <Button
                testID="done"
                label="Done"
                icon={narrow ? undefined : 'check-bold'}
                dense={narrow}
                disabled={!canEndTurn(state) || game.busy}
                onPress={game.endTurn}
              />
            </View>
          </View>
        ) : state.phase === 'doubling' && state.doubleOfferedBy === 'player2' ? (
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button testID="drop" label="Drop" variant="secondary" dense={narrow} onPress={() => game.respondToDouble(false)} />
            </View>
            <View style={styles.flex}>
              <Button testID="take" label="Take" dense={narrow} onPress={() => game.respondToDouble(true)} />
            </View>
          </View>
        ) : state.phase === 'finished' ? null : (
          // The opponent is playing (or the turn is passing): the next move is yours.
          <Button testID="roll-waiting" label="Roll" icon="dice-multiple" variant="secondary" disabled />
        )}
      </View>

      {game.outcome && state.result ? (
        <GameResultSheet
          result={state.result}
          outcome={game.outcome}
          match={active.match}
          matchLength={active.settings.matchLength}
          onReview={
            game.outcome.gameId
              ? () => {
                  const outcome = game.outcome;
                  game.clearOutcome();
                  if (!outcome?.gameId) return;
                  // A match in progress moves on to its next game, ready to resume from the Play tab.
                  if (active.settings.matchLength <= 1 || outcome.matchOver) abandonGame();
                  else continueMatch();
                  router.replace({ pathname: '/review/[id]', params: { id: outcome.gameId } });
                }
              : undefined
          }
          onNextGame={() => {
            game.clearOutcome();
            continueMatch();
          }}
          onPlayAgain={newGame}
          onDone={() => {
            game.clearOutcome();
            abandonGame();
            router.replace('/play');
          }}
        />
      ) : null}

      <ConfirmDialog
        visible={confirm === 'leave'}
        title="Leave the game?"
        message="Your game is saved. You can pick it up again from the Play tab."
        confirmLabel="Leave"
        cancelLabel="Keep playing"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          if (router.canGoBack()) router.back();
          else router.replace('/play');
        }}
      />
      <ConfirmDialog
        visible={confirm === 'resign'}
        title="Resign this game?"
        message={`The computer wins ${state.cube.value} point${state.cube.value === 1 ? '' : 's'}.`}
        confirmLabel="Resign"
        cancelLabel="Keep playing"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          game.resign();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  title: { flex: 1, alignItems: 'center' },
  middle: { flex: 1, alignItems: 'center' },
  spacer: { flex: 1 },
  table: { alignItems: 'stretch' },
  panel: { justifyContent: 'center' },
  panelContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.xs },
  actions: {
    paddingHorizontal: SCREEN_GUTTER,
    paddingTop: spacing.sm,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
