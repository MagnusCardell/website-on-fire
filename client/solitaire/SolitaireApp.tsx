import React, { useState, useEffect, useCallback } from 'react';
import { useGame } from './hooks/useGame';
import { useGameTimer } from './hooks/useGameTimer';
import { useLayoutVars } from './hooks/useLayoutVars';
import { GameBoard } from './components/GameBoard';
import { Header } from './components/Header';
import { WinModal } from './components/WinModal';
import { StatsModal } from './components/StatsModal';

export function SolitaireApp() {
  useLayoutVars();
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
    updateElapsedTime,
    persistNow,
  } = useGame();

  const [showStats, setShowStats] = useState(false);

  const { displaySeconds, displayMs } = useGameTimer({
    gameState,
    onElapsedChange: updateElapsedTime,
    onPersistRequest: persistNow,
  });

  const handleNewGame = useCallback(() => {
    newGame(displayMs);
  }, [newGame, displayMs]);

  const handleExecuteMove = useCallback((move: Parameters<typeof executeMove>[0]) => {
    executeMove(move, displayMs);
  }, [executeMove, displayMs]);

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

  if (isLoading) {
    return (
      <div className='min-h-[100dvh] bg-gradient-to-b from-green-800 to-green-950 flex items-center justify-center'>
        <div className='text-white text-xl'>Loading...</div>
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
        onUndo={undo}
        onNewGame={handleNewGame}
        onShowStats={() => setShowStats(true)}
        elapsedTime={displaySeconds}
        onStartDaily={startDailyChallenge}
        isPlayingDaily={isPlayingDaily}
      />
      
      <main className='flex-1 relative overflow-hidden'>
        <GameBoard
          gameState={gameState}
          isSelected={isSelected}
          getValidDropTargets={getValidDropTargets}
          onDrawFromStock={drawFromStock}
          onSelectCard={selectCard}
          onMoveSelectionTo={moveSelectionTo}
          onClearSelection={clearSelection}
          findLegalMove={findLegalMove}
          executeMove={handleExecuteMove}
        />
      </main>
      
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
        onClose={() => setShowWinModal(false)}
      />
      
      <StatsModal
        isOpen={showStats}
        stats={stats}
        onClose={() => setShowStats(false)}
      />
      </div>
  );
}
