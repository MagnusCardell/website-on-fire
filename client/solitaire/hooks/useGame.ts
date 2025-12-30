import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameState, GameStats, Move } from '../engine/types';
import { createNewGame } from '../engine/game';
import { applyMove, undoMove, getLegalMoves } from '../engine/rules';
import { saveGame, loadGame, clearGame, loadStats, recordWin, recordLoss } from '../persistence/storage';
import { getSeed, getKey } from '../engine/solvableSeeds';
import { recordDailyCompletion, isDailyCompleted } from '../persistence/dailyChallenge';

interface Selection {
  cardIds: string[];
  fromPile: 'waste' | 'tableau' | 'foundation';
  fromIndex: number;
}

export function useGame() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showWinModal, setShowWinModal] = useState(false);
  const [isPlayingDaily, setIsPlayingDaily] = useState(false);
  const [activeDailyKey, setActiveDailyKey] = useState<string | null>(null);
  const [dailyAlreadyCompleted, setDailyAlreadyCompleted] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load game on mount
  useEffect(() => {
    async function init() {
      const [savedGame, savedStats] = await Promise.all([
        loadGame(),
        loadStats(),
      ]);

      if (savedGame && savedGame.gameStatus === 'playing') {
        setGameState(savedGame);
        const todaysSeed = getSeed(new Date());
        if (savedGame.seed === todaysSeed) {
          setIsPlayingDaily(true);
          setActiveDailyKey(getKey(new Date()));
        }
      } else {
        setGameState(createNewGame());
      }
      setStats(savedStats);
      setIsLoading(false);
    }
    init();
  }, []);

  // Persist game state (throttled)
  const persistGame = useCallback((state: GameState) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveGame(state);
    }, 500);
  }, []);

  // Start new game
  const newGame = useCallback(async (currentElapsedMs?: number) => {
    // If there's an active game, count it as a loss (but not for daily challenges)
    if (gameState && gameState.gameStatus === 'playing' && gameState.moveCount > 0 && !isPlayingDaily) {
      const gameTime = Math.floor((currentElapsedMs ?? gameState.elapsedActiveMs) / 1000);
      const newStats = await recordLoss(gameTime);
      setStats(newStats);
    }

    const state = createNewGame();
    setGameState(state);
    setSelection(null);
    setShowWinModal(false);
    setIsPlayingDaily(false);
    await clearGame();
    persistGame(state);
  }, [gameState, isPlayingDaily, persistGame]);


  // Start daily challenge
  const startDailyChallenge = useCallback(async () => {
    // Check if already completed
    const today = new Date();
    const key = getKey(today);
    setActiveDailyKey(key);
    const completed = await isDailyCompleted(key);
    if (completed) {
      setDailyAlreadyCompleted(true);
      return;
    }

    // If there's an active regular game, count it as a loss
    if (gameState && gameState.gameStatus === 'playing' && gameState.moveCount > 0 && !isPlayingDaily) {
      const gameTime = Math.floor(gameState.elapsedActiveMs / 1000);
      const newStats = await recordLoss(gameTime);
      setStats(newStats);
    }

    const seed = getSeed(today);
    const state = createNewGame(seed);
    setGameState(state);
    setSelection(null);
    setShowWinModal(false);
    setIsPlayingDaily(true);
    setDailyAlreadyCompleted(false);
    await clearGame();
    persistGame(state)
  }, [gameState, isPlayingDaily]);

  // Handle win
  const handleWin = useCallback(async (state: GameState, finalElapsedMs: number) => {
    const gameTime = Math.floor(finalElapsedMs / 1000);
    const newStats = await recordWin(gameTime);
    setStats(newStats);
    setShowWinModal(true);

    if (isPlayingDaily) {
      const key = activeDailyKey ?? getKey(new Date());
      await recordDailyCompletion(key, gameTime, state.moveCount);
      setIsPlayingDaily(false);
      setActiveDailyKey(null);
    }

    await clearGame();
  }, [isPlayingDaily, activeDailyKey]);

  // Execute a move
  const executeMove = useCallback((move: Move, currentElapsedMs?: number) => {
    if (!gameState) return;

    const newState = applyMove(gameState, move);
    // Update elapsed time if provided
    if (currentElapsedMs !== undefined) {
      newState.elapsedActiveMs = currentElapsedMs;
    }
    setGameState(newState);
    setSelection(null);
    persistGame(newState);

    if (newState.gameStatus === 'won') {
      handleWin(newState, currentElapsedMs ?? newState.elapsedActiveMs);
    }
  }, [gameState, persistGame, handleWin]);

  // Undo last move
  const undo = useCallback(() => {
    if (!gameState) return;

    const newState = undoMove(gameState);
    if (newState) {
      setGameState(newState);
      setSelection(null);
      persistGame(newState);
    }
  }, [gameState, persistGame]);

  // Draw from stock
  const drawFromStock = useCallback(() => {
    if (!gameState) return;

    const legalMoves = getLegalMoves(gameState);
    const drawMove = legalMoves.find(m => m.type === 'draw');
    const recycleMove = legalMoves.find(m => m.type === 'recycle');

    if (drawMove) {
      executeMove(drawMove);
    } else if (recycleMove) {
      executeMove(recycleMove);
    }
  }, [gameState, executeMove]);

  // Select a card (for tap-to-move)
  const selectCard = useCallback((cardId: string, fromPile: 'waste' | 'tableau' | 'foundation', fromIndex: number) => {
    if (!gameState) return;

    // If already selected, deselect
    if (selection?.cardIds.includes(cardId)) {
      setSelection(null);
      return;
    }

    // For tableau, select the card and all cards on top of it
    if (fromPile === 'tableau') {
      const pile = gameState.tableau[fromIndex];
      const cardIndex = pile.findIndex(c => c.id === cardId);
      if (cardIndex === -1 || !pile[cardIndex].faceUp) return;

      const cardIds = pile.slice(cardIndex).map(c => c.id);
      setSelection({ cardIds, fromPile, fromIndex });
    } else {
      // For waste, just select the top card
      const topCard = gameState.waste[gameState.waste.length - 1];
      if (topCard?.id !== cardId) return;

      setSelection({ cardIds: [cardId], fromPile, fromIndex: 0 });
    }
  }, [gameState, selection]);

  // Try to move selection to a target pile
  const moveSelectionTo = useCallback((toPile: 'foundation' | 'tableau', toIndex: number) => {
    if (!gameState || !selection) return false;

    const legalMoves = getLegalMoves(gameState);

    // Find a matching legal move
    const move = legalMoves.find(m => {
      if (m.cardIds[0] !== selection.cardIds[0]) return false;
      if (m.to.pile !== toPile || m.to.index !== toIndex) return false;
      return true;
    });

    if (move) {
      executeMove(move);
      return true;
    }

    return false;
  }, [gameState, selection, executeMove]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  // Find a legal move for a card (for drag validation)
  const findLegalMove = useCallback((
    cardId: string,
    fromPile: 'waste' | 'tableau' | 'foundation',
    fromIndex: number,
    toPile: 'foundation' | 'tableau',
    toIndex: number
  ): Move | null => {
    if (!gameState) return null;

    const legalMoves = getLegalMoves(gameState);
    return legalMoves.find(m =>
      m.cardIds[0] === cardId &&
      m.to.pile === toPile &&
      m.to.index === toIndex
    ) ?? null;
  }, [gameState]);

  // Check if a card is part of the current selection
  const isSelected = useCallback((cardId: string) => {
    return selection?.cardIds.includes(cardId) ?? false;
  }, [selection]);

  // Get valid drop targets for currently selected/dragged cards
  const getValidDropTargets = useCallback((cardId: string): { pile: 'foundation' | 'tableau'; index: number }[] => {
    if (!gameState) return [];

    const legalMoves = getLegalMoves(gameState);
    return legalMoves
      .filter(m => m.cardIds[0] === cardId)
      .filter(m => m.to.pile === 'foundation' || m.to.pile === 'tableau')
      .map(m => ({ pile: m.to.pile as 'foundation' | 'tableau', index: m.to.index }));
  }, [gameState]);

  // Update elapsed time (called by timer hook)
  const updateElapsedTime = useCallback((elapsedMs: number) => {
    setGameState(prev => {
      if (!prev) return prev;
      return { ...prev, elapsedActiveMs: elapsedMs };
    });
  }, []);

  // Persist immediately (called on visibility change)
  const persistNow = useCallback(() => {
    if (gameState) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      saveGame(gameState);
    }
  }, [gameState]);

  return {
    gameState,
    stats,
    selection,
    isLoading,
    showWinModal,
    setShowWinModal,
    newGame,
    startDailyChallenge,
    isPlayingDaily,
    undo,
    drawFromStock,
    selectCard,
    moveSelectionTo,
    clearSelection,
    findLegalMove,
    executeMove,
    isSelected,
    getValidDropTargets,
    canUndo: (gameState?.moveHistory.length ?? 0) > 0 && gameState?.gameStatus !== 'won',
    updateElapsedTime,
    persistNow,
  };
}
