import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { GameState, GameStats, Move, Card } from '../engine/types';
import { createNewGame } from '../engine/game';
import { applyMove, undoMove, getLegalMoves, canAutocomplete } from '../engine/rules';
import { saveGame, loadGame, clearGame, loadStats, recordWin, recordLoss } from '../persistence/storage';
import { getSeed, getKey, getLegacyDailySeed } from '../engine/solvableSeeds';
import { recordDailyCompletion, isDailyCompleted } from '../persistence/dailyChallenge';
import type { PlayLimiterControls } from '../limits/types';
import { useGameClock } from './useGameClock';

interface Selection {
  cardIds: string[];
  fromPile: 'waste' | 'tableau' | 'foundation';
  fromIndex: number;
}

interface UseGameOptions {
  limiter?: PlayLimiterControls;
  longSessionActive?: boolean;
}

export function useGame({ limiter, longSessionActive = false }: UseGameOptions = {}) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showWinModal, setShowWinModal] = useState(false);
  // Date key of the daily challenge on the board, null for a normal game
  const [dailyKey, setDailyKeyState] = useState<string | null>(null);
  const [isAutocompleting, setIsAutocompleting] = useState(false);
  // Goes up by one each time a different game is put on the board
  const [gameId, setGameId] = useState(0);

  // Every action reads the board from these refs, never from the render it was
  // created in, so two inputs in a row always see each other's result, and the
  // callbacks below keep the same identity for the life of the component.
  const stateRef = useRef<GameState | null>(null);
  const selectionRef = useRef<Selection | null>(null);
  const dailyKeyRef = useRef<string | null>(null);
  const limiterRef = useRef(limiter);
  limiterRef.current = limiter;
  const longSessionRef = useRef(longSessionActive);
  longSessionRef.current = longSessionActive;

  // Id of the autocomplete run in flight, null when none is running
  const autoRunRef = useRef<number | null>(null);
  const autoRunCounterRef = useRef(0);
  const autoElapsedRef = useRef(0);
  // True once the game on the board has been counted as a win
  const winBookedRef = useRef(false);

  const commit = useCallback((next: GameState) => {
    stateRef.current = next;
    setGameState(next);
  }, []);

  // Put a different game on the board
  const deal = useCallback((next: GameState) => {
    winBookedRef.current = false;
    commit(next);
    setGameId(id => id + 1);
  }, [commit]);

  const select = useCallback((next: Selection | null) => {
    selectionRef.current = next;
    setSelection(next);
  }, []);

  const setDailyKey = useCallback((key: string | null) => {
    dailyKeyRef.current = key;
    setDailyKeyState(key);
  }, []);

  const persist = useCallback((state: GameState) => {
    saveGame(state, dailyKeyRef.current);
  }, []);

  // Store the play time with the game and save it (the page is going away)
  const saveElapsed = useCallback((elapsedMs: number) => {
    const current = stateRef.current;
    if (!current || current.gameStatus !== 'playing') return;
    const next = { ...current, elapsedActiveMs: elapsedMs };
    commit(next);
    persist(next);
  }, [commit, persist]);

  const isPlaying = !isLoading && gameState?.gameStatus === 'playing';
  const clock = useGameClock({
    gameId,
    baseMs: gameState?.elapsedActiveMs ?? 0,
    running: isPlaying,
    onPause: saveElapsed,
  });

  // Load game on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const [saved, savedStats] = await Promise.all([
        loadGame(),
        loadStats(),
      ]);
      if (cancelled) return;

      if (saved && saved.state.gameStatus === 'playing') {
        const todayKey = getKey(new Date());
        if (saved.dailyKey !== undefined) {
          setDailyKey(saved.dailyKey);
        } else if (saved.state.seed === getLegacyDailySeed(todayKey)) {
          // Saved before games recorded their own daily date
          setDailyKey(todayKey);
        }
        deal(saved.state);
      } else {
        deal(createNewGame());
      }
      setStats(savedStats);
      setIsLoading(false);
    }
    init();

    return () => {
      cancelled = true;
      autoRunRef.current = null;
    };
  }, [deal, setDailyKey]);

  // Count the game on the board as won, once
  const bookWin = useCallback(async (state: GameState, finalElapsedMs: number, showModal: boolean) => {
    if (winBookedRef.current) return;
    winBookedRef.current = true;

    const gameTime = Math.floor(finalElapsedMs / 1000);
    const key = dailyKeyRef.current;
    limiterRef.current?.recordWin(finalElapsedMs, key ? 'daily' : 'normal');
    await clearGame();

    if (!longSessionRef.current) {
      const newStats = await recordWin(gameTime);
      setStats(newStats);
    }
    if (showModal) setShowWinModal(true);

    if (key) {
      await recordDailyCompletion(key, gameTime, state.moveCount);
      limiterRef.current?.recordDailyCompleted();
      if (dailyKeyRef.current === key) setDailyKey(null);
    }
  }, [setDailyKey]);

  const endAutocompleteRun = useCallback((runId: number) => {
    if (autoRunRef.current !== runId) return;
    autoRunRef.current = null;
    setIsAutocompleting(false);
  }, []);

  // Finish an autocomplete run at once. Autocomplete is only offered when the
  // win is certain, so leaving the animation early still counts as that win.
  const settleAutocomplete = useCallback(async () => {
    if (autoRunRef.current === null) return;
    autoRunRef.current = null;
    setIsAutocompleting(false);

    let state = stateRef.current;
    if (!state) return;
    const activeMs = autoElapsedRef.current;

    for (let i = 0; i < 52 && state.gameStatus === 'playing'; i++) {
      const move = getLegalMoves(state).find(m => m.to.pile === 'foundation');
      if (!move) break;
      const next = applyMove(state, move);
      if (next === state) break;
      next.elapsedActiveMs = activeMs;
      limiterRef.current?.recordMove({
        prev: state,
        move,
        next,
        activeMs,
        playingDaily: dailyKeyRef.current !== null,
      });
      state = next;
    }

    commit(state);
    if (state.gameStatus === 'won') {
      await bookWin(state, activeMs, false);
    }
  }, [commit, bookWin]);

  // A game left unfinished counts as a loss (but not a daily challenge)
  const bookAbandonedGame = useCallback(async () => {
    const current = stateRef.current;
    if (!current || current.gameStatus !== 'playing' || current.moveCount === 0) return;
    if (dailyKeyRef.current !== null) return;

    const activeMs = clock.getElapsedMs();
    limiterRef.current?.recordGameAbandoned(activeMs);
    if (!longSessionRef.current) {
      const newStats = await recordLoss(Math.floor(activeMs / 1000));
      setStats(newStats);
    }
  }, [clock]);

  // Start new game
  const newGame = useCallback(async () => {
    const lim = limiterRef.current;
    if (lim && !lim.canStartGame('normal')) return;

    await settleAutocomplete();
    await bookAbandonedGame();

    const state = createNewGame();
    lim?.recordGameStarted('normal');
    setDailyKey(null);
    deal(state);
    select(null);
    setShowWinModal(false);
    persist(state);
  }, [settleAutocomplete, bookAbandonedGame, setDailyKey, deal, select, persist]);

  // Start daily challenge
  const startDailyChallenge = useCallback(async () => {
    const lim = limiterRef.current;
    if (lim && !lim.canStartGame('daily')) return;

    await settleAutocomplete();

    // Check if already completed
    const today = new Date();
    const key = getKey(today);
    if (await isDailyCompleted(key)) return;

    await bookAbandonedGame();

    const state = createNewGame(getSeed(today));
    lim?.recordGameStarted('daily');
    setDailyKey(key);
    deal(state);
    select(null);
    setShowWinModal(false);
    persist(state);
  }, [settleAutocomplete, bookAbandonedGame, setDailyKey, deal, select, persist]);

  // Execute a move
  const executeMove = useCallback((move: Move) => {
    const current = stateRef.current;
    if (!current || current.gameStatus !== 'playing') return;
    if (autoRunRef.current !== null) return;
    const lim = limiterRef.current;
    if (lim && !lim.canMakeMove()) return;

    const next = applyMove(current, move);
    if (next === current) return; // not a legal move on this board

    next.elapsedActiveMs = clock.getElapsedMs();
    lim?.recordMove({
      prev: current,
      move,
      next,
      activeMs: next.elapsedActiveMs,
      playingDaily: dailyKeyRef.current !== null,
    });
    commit(next);
    select(null);

    if (next.gameStatus === 'won') {
      bookWin(next, next.elapsedActiveMs, true);
    } else {
      persist(next);
    }
  }, [clock, commit, select, persist, bookWin]);

  // Undo last move
  const undo = useCallback(() => {
    const current = stateRef.current;
    if (!current || current.gameStatus !== 'playing') return;
    if (autoRunRef.current !== null) return;
    const lim = limiterRef.current;
    if (lim && !lim.canMakeMove()) return;

    const next = undoMove(current);
    if (next) {
      next.elapsedActiveMs = clock.getElapsedMs();
      lim?.recordUndo(next.elapsedActiveMs);
      commit(next);
      select(null);
      persist(next);
    }
  }, [clock, commit, select, persist]);

  // Draw from stock
  const drawFromStock = useCallback(() => {
    const current = stateRef.current;
    if (!current) return;

    const legalMoves = getLegalMoves(current);
    const move = legalMoves.find(m => m.type === 'draw') ?? legalMoves.find(m => m.type === 'recycle');
    if (move) {
      executeMove(move);
    }
  }, [executeMove]);

  // Select a card (for tap-to-move)
  const selectCard = useCallback((cardId: string, fromPile: 'waste' | 'tableau' | 'foundation', fromIndex: number) => {
    const current = stateRef.current;
    if (!current || autoRunRef.current !== null) return;
    const lim = limiterRef.current;
    if (lim && !lim.canMakeMove()) return;

    // If already selected, deselect
    if (selectionRef.current?.cardIds.includes(cardId)) {
      select(null);
      return;
    }

    // For tableau, select the card and all cards on top of it
    if (fromPile === 'tableau') {
      const pile = current.tableau[fromIndex];
      const cardIndex = pile.findIndex(c => c.id === cardId);
      if (cardIndex === -1 || !pile[cardIndex].faceUp) return;

      const cardIds = pile.slice(cardIndex).map(c => c.id);
      select({ cardIds, fromPile, fromIndex });
    } else {
      // For waste, just select the top card
      const topCard = current.waste[current.waste.length - 1];
      if (topCard?.id !== cardId) return;

      select({ cardIds: [cardId], fromPile, fromIndex: 0 });
    }
  }, [select]);

  // Try to move selection to a target pile
  const moveSelectionTo = useCallback((toPile: 'foundation' | 'tableau', toIndex: number) => {
    const current = stateRef.current;
    const selected = selectionRef.current;
    if (!current || !selected) return false;
    if (autoRunRef.current !== null) return false;
    const lim = limiterRef.current;
    if (lim && !lim.canMakeMove()) return false;

    // Find a matching legal move
    const move = getLegalMoves(current).find(m =>
      m.cardIds[0] === selected.cardIds[0] &&
      m.to.pile === toPile &&
      m.to.index === toIndex
    );

    if (move) {
      executeMove(move);
      return true;
    }

    return false;
  }, [executeMove]);

  // Clear selection
  const clearSelection = useCallback(() => {
    select(null);
  }, [select]);

  // Find a legal move for a card (for drag validation)
  const findLegalMove = useCallback((
    cardId: string,
    _fromPile: 'waste' | 'tableau' | 'foundation',
    _fromIndex: number,
    toPile: 'foundation' | 'tableau',
    toIndex: number
  ): Move | null => {
    const current = stateRef.current;
    if (!current || autoRunRef.current !== null) return null;
    const lim = limiterRef.current;
    if (lim && !lim.canMakeMove()) return null;

    return getLegalMoves(current).find(m =>
      m.cardIds[0] === cardId &&
      m.to.pile === toPile &&
      m.to.index === toIndex
    ) ?? null;
  }, []);

  // Check if a card is part of the current selection
  const isSelected = useCallback((cardId: string) => {
    return selection?.cardIds.includes(cardId) ?? false;
  }, [selection]);

  // Get valid drop targets for currently selected/dragged cards
  const getValidDropTargets = useCallback((cardId: string): { pile: 'foundation' | 'tableau'; index: number }[] => {
    const current = stateRef.current;
    if (!current || autoRunRef.current !== null) return [];
    const lim = limiterRef.current;
    if (lim && !lim.canMakeMove()) return [];

    return getLegalMoves(current)
      .filter(m => m.cardIds[0] === cardId)
      .filter(m => m.to.pile === 'foundation' || m.to.pile === 'tableau')
      .map(m => ({ pile: m.to.pile as 'foundation' | 'tableau', index: m.to.index }));
  }, []);

  // Autocomplete: animate all remaining cards to foundations.
  // beforeApply: optional hook called with the card and a done() callback;
  // done() commits the move. If omitted, applies immediately with a 180ms delay.
  // Only one run can be in flight, and no other input reaches the board until it ends.
  const autocomplete = useCallback((
    beforeApply?: (card: Card, foundationIndex: number, done: () => void) => void
  ) => {
    const start = stateRef.current;
    if (!start || start.gameStatus !== 'playing') return;
    if (autoRunRef.current !== null) return;
    if (!canAutocomplete(start)) return;
    const lim = limiterRef.current;
    if (lim && !lim.canMakeMove()) return;

    const runId = ++autoRunCounterRef.current;
    const activeMs = clock.getElapsedMs();
    autoRunRef.current = runId;
    autoElapsedRef.current = activeMs;
    setIsAutocompleting(true);
    select(null);

    function step() {
      if (autoRunRef.current !== runId) return;
      const state = stateRef.current;
      const move = state && getLegalMoves(state).find(m => m.to.pile === 'foundation');
      if (!state || !move) {
        endAutocompleteRun(runId);
        return;
      }

      const card = [
        ...state.waste,
        ...state.tableau.flat(),
      ].find(c => c.id === move.cardIds[0]);
      if (!card) {
        endAutocompleteRun(runId);
        return;
      }

      const apply = () => {
        if (autoRunRef.current !== runId) return;
        const current = stateRef.current;
        if (!current) return;

        const next = applyMove(current, move);
        if (next === current) {
          endAutocompleteRun(runId);
          return;
        }
        next.elapsedActiveMs = activeMs;
        limiterRef.current?.recordMove({
          prev: current,
          move,
          next,
          activeMs,
          playingDaily: dailyKeyRef.current !== null,
        });
        commit(next);

        if (next.gameStatus === 'won') {
          endAutocompleteRun(runId);
          bookWin(next, activeMs, true);
          return;
        }
        persist(next);
        setTimeout(step, 30);
      };

      if (beforeApply) {
        beforeApply(card, move.to.index, apply);
      } else {
        setTimeout(apply, 180);
      }
    }

    step();
  }, [clock, commit, select, persist, bookWin, endAutocompleteRun]);

  // Save the game as it stands, with its play time
  const persistNow = useCallback(() => {
    saveElapsed(clock.getElapsedMs());
  }, [clock, saveElapsed]);

  // Working this out plays the rest of the game through, so only when the board changes
  const autocompleteReady = useMemo(
    () => gameState?.gameStatus === 'playing' && canAutocomplete(gameState),
    [gameState]
  );

  return {
    gameState,
    gameId,
    stats,
    selection,
    isLoading,
    showWinModal,
    setShowWinModal,
    newGame,
    startDailyChallenge,
    isPlayingDaily: dailyKey !== null,
    undo,
    drawFromStock,
    selectCard,
    moveSelectionTo,
    clearSelection,
    findLegalMove,
    executeMove,
    isSelected,
    getValidDropTargets,
    canUndo: (gameState?.moveHistory.length ?? 0) > 0 && gameState?.gameStatus === 'playing' && !isAutocompleting,
    canAutocomplete: autocompleteReady && !isAutocompleting,
    isAutocompleting,
    autocomplete,
    clock,
    isPlaying,
    persistNow,
  };
}
