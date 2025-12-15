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
    <header className="flex items-center justify-between px-4 py-2 bg-green-900/80 backdrop-blur-sm border-b border-green-700/50">
      <div className="flex items-center gap-4">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={cn(
            'p-2 rounded-lg transition-all',
            canUndo 
              ? 'bg-green-800/50 hover:bg-green-700/50 text-white' 
              : 'bg-green-900/30 text-green-700 cursor-not-allowed'
          )}
          aria-label="Undo"
        >
          <Undo2 className="w-5 h-5" />
        </button>
        
        <div className="text-white/80 text-sm font-medium">
          <span className="tabular-nums">{moveCount}</span> moves
        </div>
      </div>
      
      <div className="text-white font-medium tabular-nums">
        {formatTime(elapsedTime)}
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={onShowStats}
          className="p-2 rounded-lg bg-green-800/50 hover:bg-green-700/50 text-white transition-all"
          aria-label="Statistics"
        >
          <BarChart3 className="w-5 h-5" />
        </button>
        
        <button
          onClick={onNewGame}
          className="p-2 rounded-lg bg-green-800/50 hover:bg-green-700/50 text-white transition-all"
          aria-label="New Game"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
