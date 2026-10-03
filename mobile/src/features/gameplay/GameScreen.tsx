import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackgammonBoard } from '@/components/board/BackgammonBoard';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import { allCheckersHome, canDouble, canEndTurn, pipCount } from '@/game';
import { useGameStore } from '@/state/gameStore';
import { useSettingsStore } from '@/state/settingsStore';
import { colors, MAX_CONTENT_WIDTH, SCREEN_GUTTER, spacing } from '@/theme';
import type { BoardArrow } from '@/types/board';

import { CoachHintBubble } from './components/CoachHintBubble';
import { GameResultSheet } from './components/GameResultSheet';
import { PlayerRow } from './components/PlayerRow';
import { usedDice } from './moveInput';
import { useGameController } from './useGameController';

const LEVEL_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' } as const;

export function GameScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const game = useGameController();
  const settings = useSettingsStore();
  const startGame = useGameStore((store) => store.startGame);
  const continueMatch = useGameStore((store) => store.continueMatch);
  const abandonGame = useGameStore((store) => store.abandonGame);
  const [confirm, setConfirm] = useState<'leave' | 'resign' | null>(null);

  const { active, state } = game;
  if (!active || !state) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <AppText variant="title">No game in progress</AppText>
        <Button label="Back to Play" fullWidth={false} onPress={() => router.replace('/play')} />
      </View>
    );
  }

  const boardWidth = Math.min(width, MAX_CONTENT_WIDTH);
  const isMatch = active.settings.matchLength > 1;
  const humanTurn = state.currentPlayer === 'player1';
  const aiThinking =
    (state.phase === 'moving' || state.phase === 'rolling') && state.currentPlayer === 'player2';
  const turn = state.turn;
  const arrows: BoardArrow[] =
    game.lastAiPlay && state.phase === 'rolling' && humanTurn
      ? game.lastAiPlay.moves.map((move) => ({ from: move.from, to: move.to, player: 'player2', tone: 'info' }))
      : (game.hintMoves ?? []).map((move) => ({ from: move.from, to: move.to, tone: 'hint' }));

  const askHint = () => {
    if (game.requestHint() === 'locked') router.push({ pathname: '/paywall', params: { source: 'game_hint' } });
  };

  const status = (() => {
    if (state.phase === 'finished') return 'Game over';
    if (game.message) return game.message;
    if (state.phase === 'opening') return 'Each side rolls one die. Higher number goes first.';
    if (state.phase === 'doubling') {
      return state.doubleOfferedBy === 'player2'
        ? `The computer doubles to ${state.cube.value * 2}. Take or drop?`
        : 'Waiting for the computer’s answer…';
    }
    if (aiThinking) return state.phase === 'rolling' ? 'Computer’s turn' : 'The computer is moving…';
    if (state.phase === 'rolling') return game.lastAiPlay ? `${game.lastAiPlay.text}. Your roll!` : 'Your turn. Roll the dice!';
    if (turn && canEndTurn(state)) return 'Done? Confirm your move, or undo to try again.';
    if (state.board.bar.player1 > 0) return 'You’re on the bar: enter in the computer’s home board first.';
    // The first bear-off turn of the game: say how it works.
    if (turn && turn.moves.length === 0 && state.board.off.player1 === 0 && allCheckersHome(state.board, 'player1')) {
      return 'All your checkers are home: bear them off! Tap a checker, then the tray on the right.';
    }
    return 'Drag a checker where it should go, or tap it and then its spot.';
  })();

  const newGame = () => {
    game.clearOutcome();
    startGame(active.settings);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <IconButton icon="close" accessibilityLabel="Leave game" onPress={() => setConfirm('leave')} testID="game-close" />
        <View style={styles.title}>
          <AppText variant="subheading">vs Computer</AppText>
          <AppText variant="caption" color="textSecondary">
            {LEVEL_LABEL[active.settings.level]}
            {isMatch ? ` · Game ${active.gameNumber} · Match to ${active.settings.matchLength}` : ''}
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

      <View style={styles.boardArea}>
        <PlayerRow
          name="Computer"
          light={false}
          pips={pipCount(state.board, 'player2')}
          borneOff={state.board.off.player2}
          score={isMatch ? active.match.player2 : null}
          active={!humanTurn && state.phase !== 'finished'}
          thinking={aiThinking}
          ownsCube={active.settings.cubeEnabled && state.cube.owner === 'player2' ? state.cube.value : null}
        />
        <View style={styles.board}>
          <BackgammonBoard
            testID="game-board"
            board={state.board}
            width={boardWidth}
            layoutKey={`${active.id}-${active.gameNumber}`}
            showPointNumbers={settings.showPointNumbers}
            dice={
              turn
                ? {
                    values: turn.dice,
                    used: usedDice(turn),
                    player: state.currentPlayer,
                    rollId: game.rollId,
                    animate: true,
                  }
                : null
            }
            cube={active.settings.cubeEnabled ? state.cube : null}
            selected={humanTurn ? game.selected : null}
            movable={settings.showMovableHints && game.selected === null ? game.movable : []}
            targets={game.targets}
            arrows={arrows}
            onPressPoint={game.tap}
            onPressBar={() => game.tap('bar')}
            onPressOff={(how) => game.tap('off', how)}
          />
        </View>
        <PlayerRow
          name="You"
          light
          pips={pipCount(state.board, 'player1')}
          borneOff={state.board.off.player1}
          score={isMatch ? active.match.player1 : null}
          active={humanTurn && state.phase !== 'finished'}
          ownsCube={active.settings.cubeEnabled && state.cube.owner === 'player1' ? state.cube.value : null}
        />
      </View>

      <View style={styles.statusWrap}>
        {game.hint ? (
          <CoachHintBubble hint={game.hint} following={game.hintMoves !== null} />
        ) : (
          <AppText variant="bodyStrong" align="center" testID="game-status" color={game.message && !game.dancing ? 'text' : 'textSecondary'}>
            {status}
          </AppText>
        )}
      </View>

      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        {state.phase === 'opening' ? (
          <Button testID="roll-opening" label="Roll to start" icon="dice-multiple" onPress={game.rollOpening} />
        ) : state.phase === 'rolling' && humanTurn ? (
          <View style={styles.row}>
            {canDouble(state) ? (
              <View style={styles.flex}>
                <Button testID="double" label={`Double to ${state.cube.value * 2}`} variant="secondary" onPress={game.double} />
              </View>
            ) : null}
            <View style={styles.flex}>
              <Button testID="roll" label="Roll" icon="dice-multiple" onPress={game.roll} />
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
                icon="undo-variant"
                variant="secondary"
                disabled={!turn || turn.moves.length === 0 || game.busy}
                onPress={game.undo}
              />
            </View>
            <View style={styles.flex}>
              <Button testID="done" label="Done" icon="check-bold" disabled={!canEndTurn(state) || game.busy} onPress={game.endTurn} />
            </View>
          </View>
        ) : state.phase === 'doubling' && state.doubleOfferedBy === 'player2' ? (
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button testID="drop" label="Drop" variant="secondary" onPress={() => game.respondToDouble(false)} />
            </View>
            <View style={styles.flex}>
              <Button testID="take" label="Take" onPress={() => game.respondToDouble(true)} />
            </View>
          </View>
        ) : (
          <View style={styles.placeholder} />
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
    height: 56,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  title: { flex: 1, alignItems: 'center' },
  boardArea: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  board: { alignItems: 'center' },
  statusWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SCREEN_GUTTER,
    minHeight: 56,
  },
  actions: {
    paddingHorizontal: SCREEN_GUTTER,
    paddingTop: spacing.sm,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  placeholder: { height: 60 },
});
