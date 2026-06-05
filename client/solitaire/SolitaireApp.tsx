import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGame } from './hooks/useGame';
import { useGameTimer } from './hooks/useGameTimer';
import { useLayoutVars } from './hooks/useLayoutVars';
import { GameBoard } from './components/GameBoard';
import { Card as CardComponent } from './components/Card';
import { Header } from './components/Header';
import { LimitDebugPanel } from './components/LimitDebugPanel';
import { LimitOverlay } from './components/LimitOverlay';
import { WinModal } from './components/WinModal';
import { StatsModal } from './components/StatsModal';
import { usePlayLimiter } from './limits/usePlayLimiter';
import type { Card } from './engine/types';

const AUTOCOMPLETE_ANIM_MS = 320;

function isLimitDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  if (params.get('limitsDebug') === '1' || params.get('limitDebug') === '1') {
    return true;
  }

  try {
    return window.localStorage.getItem('solitaire.limitsDebug') === '1';
  } catch {
    return false;
  }
}

interface FlyCardState {
  card: Card;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

function FlyingCard({ card, fromX, fromY, toX, toY }: FlyCardState) {
  const [phase, setPhase] = useState<'init' | 'fly'>('init');

  useEffect(() => {
    // Double rAF ensures the browser paints the start position before transitioning
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase('fly'));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const dx = toX - fromX;
  const dy = toY - fromY;

  return (
    <div
      style={{
        position: 'fixed',
        left: fromX,
        top: fromY,
        width: 'var(--sol-card-w)',
        height: 'var(--sol-card-h)',
        transform: phase === 'fly'
          ? `translate(${dx}px, ${dy}px) scale(0.88)`
          : 'translate(0, 0) scale(1.08)',
        transition: phase === 'fly'
          ? `transform ${AUTOCOMPLETE_ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
          : 'none',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {/* Inner relative wrapper so Card's absolute positioning works */}
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <CardComponent card={{ ...card, faceUp: true }} />
      </div>
    </div>
  );
}

export function SolitaireApp() {
  useLayoutVars();
  const limiter = usePlayLimiter();
  const {
    gameState,
    stats,
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
    canUndo,
    canAutocomplete,
    autocomplete,
    updateElapsedTime,
    persistNow,
  } = useGame({
    limiter: limiter.controls,
    longSessionActive: limiter.snapshot.longSessionActive,
  });

  const [showStats, setShowStats] = useState(false);
  const [showLongSessionSetup, setShowLongSessionSetup] = useState(false);
  const [showLimitPrompt, setShowLimitPrompt] = useState(false);
  const [stoppedForNow, setStoppedForNow] = useState(false);
  const [flyCard, setFlyCard] = useState<FlyCardState | null>(null);
  const [limitDebugEnabled, setLimitDebugEnabled] = useState(isLimitDebugEnabled);
  // Track the source element so we can restore visibility if needed
  const flySourceRef = useRef<HTMLElement | null>(null);

  const { displaySeconds, displayMs } = useGameTimer({
    gameState,
    onElapsedChange: updateElapsedTime,
    onPersistRequest: persistNow,
  });
  const activeSyncMs = Math.floor(displayMs / 1000) * 1000;
  const showLimitStatus = limiter.snapshot.promptDue || limiter.snapshot.longSessionActive;

  const handleNewGame = useCallback(() => {
    if (limiter.snapshot.promptDue) {
      setShowLimitPrompt(true);
      return;
    }

    newGame(displayMs);
  }, [newGame, displayMs, limiter.snapshot.promptDue]);

  const startPromptedNewGame = useCallback(() => {
    setShowLimitPrompt(false);
    setStoppedForNow(false);
    newGame(displayMs);
  }, [newGame, displayMs]);

  const handleStopForNow = useCallback(() => {
    persistNow();
    setShowLimitPrompt(false);
    setShowLongSessionSetup(false);
    setStoppedForNow(true);
    limiter.stopNow();
  }, [limiter, persistNow]);

  const handleStartLongSession = useCallback((budgetMs: number) => {
    limiter.startLongSession(budgetMs, 'planned-leisure');
    setShowLimitPrompt(false);
    setShowLongSessionSetup(false);
    setStoppedForNow(false);
    newGame(displayMs);
  }, [displayMs, limiter, newGame]);

  const handleStartDailyChallenge = useCallback(() => {
    startDailyChallenge(displayMs);
  }, [startDailyChallenge, displayMs]);

  const handleUndo = useCallback(() => {
    undo(displayMs);
  }, [undo, displayMs]);

  const handleDrawFromStock = useCallback(() => {
    drawFromStock(displayMs);
  }, [drawFromStock, displayMs]);

  const handleMoveSelectionTo = useCallback((
    toPile: 'foundation' | 'tableau',
    toIndex: number
  ) => {
    return moveSelectionTo(toPile, toIndex, displayMs);
  }, [moveSelectionTo, displayMs]);

  const handleExecuteMove = useCallback((move: Parameters<typeof executeMove>[0]) => {
    executeMove(move, displayMs);
  }, [executeMove, displayMs]);

  const handleBeforeApply = useCallback((card: Card, foundationIndex: number, done: () => void) => {
    const sourceEl = document.querySelector(`[data-card-id="${card.id}"]`) as HTMLElement | null;
    const targetEl = document.querySelector(`[data-pile-id="foundation-${foundationIndex}"]`) as HTMLElement | null;

    if (!sourceEl || !targetEl) {
      setTimeout(done, 180);
      return;
    }

    const fromRect = sourceEl.getBoundingClientRect();
    const toRect = targetEl.getBoundingClientRect();

    // Hide source card so only the overlay flies
    sourceEl.style.visibility = 'hidden';
    flySourceRef.current = sourceEl;

    setFlyCard({
      card,
      fromX: fromRect.left,
      fromY: fromRect.top,
      toX: toRect.left,
      toY: toRect.top,
    });

    setTimeout(() => {
      setFlyCard(null);
      flySourceRef.current = null;
      done();
    }, AUTOCOMPLETE_ANIM_MS);
  }, []);

  const handleAutocomplete = useCallback(() => {
    autocomplete(handleBeforeApply, displayMs);
  }, [autocomplete, handleBeforeApply, displayMs]);

  useEffect(() => {
    if (!gameState) return;

    limiter.syncActiveGame(
      String(gameState.seed),
      activeSyncMs,
      isPlayingDaily ? 'daily' : 'normal'
    );
  }, [activeSyncMs, gameState?.seed, isPlayingDaily, limiter.syncActiveGame]);

  // Prevent overscroll/bounce on iOS
  useEffect(() => {
    const preventDefault = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        e.preventDefault();
      }
    };

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';

    document.addEventListener('touchmove', preventDefault, { passive: false });

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.removeEventListener('touchmove', preventDefault);
    };
  }, []);

  // Register service worker for PWA
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/solitaire/sw.js', { scope: '/solitaire/' })
        .catch(err => console.log('SW registration failed:', err));
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isDebugShortcut = event.key.toLowerCase() === 'l' && event.shiftKey && (event.metaKey || event.ctrlKey);
      if (!isDebugShortcut) return;

      event.preventDefault();
      setLimitDebugEnabled(value => {
        const next = !value;
        try {
          if (next) {
            window.localStorage.setItem('solitaire.limitsDebug', '1');
          } else {
            window.localStorage.removeItem('solitaire.limitsDebug');
          }
        } catch {
          // Ignore private-mode storage failures; the in-memory toggle still works.
        }
        return next;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isLoading) {
    return (
      <div className='min-h-[100dvh] bg-gradient-to-b from-green-800 to-green-950 flex items-center justify-center'>
        <div className='text-white text-xl'>Loading...</div>
      </div>
    );
  }

  if (stoppedForNow) {
    return (
      <div className='min-h-[100dvh] bg-gradient-to-b from-green-800 to-green-950 flex items-center justify-center px-4'>
        <div className='w-full max-w-sm rounded-lg border border-green-200/25 bg-green-950/85 p-4 text-center shadow-2xl'>
          <h1 className='text-lg font-semibold text-white'>Game saved</h1>
          <button
            onClick={() => setStoppedForNow(false)}
            className='mt-4 w-full rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-950 hover:bg-white'
          >
            Resume
          </button>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className='min-h-[100dvh] bg-gradient-to-b from-green-800 to-green-950 flex items-center justify-center'>
        <button
          onClick={handleNewGame}
          className='px-6 py-3 bg-amber-500 hover:bg-amber-400 text-amber-900 font-bold rounded-xl'
        >
          Start New Game
        </button>
      </div>
    );
  }

  return (
    <div className='w-[100dvw] h-[100dvh] flex flex-col bg-gradient-to-b from-green-800 to-green-950 overflow-hidden relative'>
      {/* Felt texture overlay */}
      <div
        className='absolute inset-0 pointer-events-none opacity-[0.03]'
        style={{
          backgroundImage: `url('data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E')`,
        }}
      />

      <Header
        moveCount={gameState.moveCount}
        canUndo={canUndo}
        onUndo={handleUndo}
        onNewGame={handleNewGame}
        onShowStats={() => setShowStats(true)}
        elapsedTime={displaySeconds}
        onStartDaily={handleStartDailyChallenge}
        isPlayingDaily={isPlayingDaily}
        limitStatus={showLimitStatus
          ? {
              label: limiter.snapshot.statusLabel,
              tone: limiter.snapshot.statusTone,
              onClick: () => setShowLongSessionSetup(true),
            }
          : undefined}
      />

      <main className='flex-1 relative overflow-hidden'>
        <GameBoard
          gameState={gameState}
          isSelected={isSelected}
          getValidDropTargets={getValidDropTargets}
          onDrawFromStock={handleDrawFromStock}
          onSelectCard={selectCard}
          onMoveSelectionTo={handleMoveSelectionTo}
          onClearSelection={clearSelection}
          findLegalMove={findLegalMove}
          executeMove={handleExecuteMove}
        />

        {/* Autocomplete button — floats over the board, no layout shift */}
        {canAutocomplete && !limiter.snapshot.gate.blocksMoves && (
          <div className='absolute top-3 left-0 right-0 flex justify-center z-10 pointer-events-none'>
            <button
              onClick={handleAutocomplete}
              className='px-6 py-1.5 rounded-full bg-green-950/90 hover:bg-green-900 text-white text-sm font-medium shadow-lg pointer-events-auto transition-colors'
            >
              Autocomplete
            </button>
          </div>
        )}
      </main>

      {/* Flying card overlay for autocomplete animation */}
      {flyCard && <FlyingCard {...flyCard} />}

      <LimitOverlay
        snapshot={limiter.snapshot}
        showContinuePrompt={showLimitPrompt}
        showLongSessionSetup={showLongSessionSetup}
        onCloseContinuePrompt={() => setShowLimitPrompt(false)}
        onCloseLongSessionSetup={() => setShowLongSessionSetup(false)}
        onOpenLongSessionSetup={() => setShowLongSessionSetup(true)}
        onStopNow={handleStopForNow}
        onOneMoreGame={startPromptedNewGame}
        onStartLongSession={handleStartLongSession}
        onEndLongSession={limiter.endLongSession}
      />

      {limitDebugEnabled && (
        <LimitDebugPanel
          snapshot={limiter.snapshot}
          onApplyScenario={limiter.applyDebugScenario}
          onReset={limiter.resetLimitState}
        />
      )}

      <WinModal
        isOpen={showWinModal}
        stats={stats}
        gameTime={displaySeconds}
        moveCount={gameState.moveCount}
        foundations={gameState.foundations}
        onNewGame={() => {
          setShowWinModal(false);
          handleNewGame();
        }}
      />

      <StatsModal
        isOpen={showStats}
        stats={stats}
        onClose={() => setShowStats(false)}
      />
    </div>
  );
}
