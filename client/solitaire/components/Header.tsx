import React from 'react';
import { Undo2, RotateCcw, BarChart3 } from 'lucide-react';
import { cn } from '../lib/utils';

interface HeaderProps {
  moveCount: number;
  canUndo: boolean;
  onUndo: () => void;
  onNewGame: () => void;
  onShowStats: () => void;
  elapsedTime: number;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function Header({
  moveCount,
  canUndo,
  onUndo,
  onNewGame,
  onShowStats,
  elapsedTime,
}: HeaderProps) {
  return (
    <header
      className={cn(
        // layout
        'grid grid-cols-3 items-center',
        // background / separation
        'bg-green-900/80 backdrop-blur-sm border-b border-green-700/50',
        // spacing: compact for iPhone + safe-area aware
        'pb-2',
        'pt-[calc(env(safe-area-inset-top)+0.25rem)]',
        'pl-[calc(env(safe-area-inset-left)+0.75rem)] pr-[calc(env(safe-area-inset-right)+0.75rem)]'
      )}
    >
      {/* Left */}
      <div className='flex items-center gap-2 justify-self-start'>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={cn(
            'p-1.5 rounded-lg transition-all',
            canUndo
              ? 'bg-green-800/50 hover:bg-green-700/50 text-white'
              : 'bg-green-900/30 text-green-700 cursor-not-allowed'
          )}
          aria-label='Undo'
        >
          <Undo2 className='w-4 h-4' />
        </button>
  
        <div className='text-white/80 text-xs font-medium'>
          <span className='tabular-nums'>{moveCount}</span> moves
        </div>
      </div>
  
      {/* Center */}
      <div className='justify-self-center text-white font-medium tabular-nums text-sm'>
        {formatTime(elapsedTime)}
      </div>
  
      {/* Right */}
      <div className='flex items-center gap-2 justify-self-end'>
        <button
          onClick={onShowStats}
          className='p-1.5 rounded-lg bg-green-800/50 hover:bg-green-700/50 text-white transition-all'
          aria-label='Statistics'
        >
          <BarChart3 className='w-4 h-4' />
        </button>
  
        <button
          onClick={onNewGame}
          className='p-1.5 rounded-lg bg-green-800/50 hover:bg-green-700/50 text-white transition-all'
          aria-label='New Game'
        >
          <RotateCcw className='w-4 h-4' />
        </button>
      </div>
    </header>
  );
}
