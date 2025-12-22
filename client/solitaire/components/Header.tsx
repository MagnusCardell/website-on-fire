import React, { useEffect, useState } from 'react';
import { Undo2, RotateCcw, BarChart3, Crown, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';
import { DailyCalendarModal } from './DailyCalendarModal';
import { getCrownCount, isDailyCompleted } from '../persistence/dailyChallenge';
import { getKey } from '../engine/solvableSeeds';

interface HeaderProps {
  moveCount: number;
  canUndo: boolean;
  onUndo: () => void;
  onNewGame: () => void;
  onShowStats: () => void;
  elapsedTime: number;
  onStartDaily: () => void;
  isPlayingDaily: boolean;
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
  onStartDaily,
  isPlayingDaily,
}: HeaderProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [crownCount, setCrownCount] = useState(0);
  const [todayCompleted, setTodayCompleted] = useState(false);

  useEffect(() => {
    async function checkStatus() {
      const today = new Date;
      const completed = await isDailyCompleted(getKey(today));
      const crowns = await getCrownCount();
      setTodayCompleted(completed);
      setCrownCount(crowns);
    }
    checkStatus();
  }, [isPlayingDaily]);

  return (
    <>
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
          <button
            onClick={() => setShowCalendar(true)}
            className='flex items-center gap-1 px-2 py-1 bg-gray-500/20 rounded-lg hover:bg-gray-500/30 transition-colors'
          >
            {formatTime(elapsedTime)}
            <Crown className='w-4 h-4 text-gray-400' />
            <span className='text-gray-400 text-sm font-medium tabular-nums'>{crownCount} </span>
          </button>

        </div>

        {/* Right */}
        <div className='flex items-center gap-2 justify-self-end'>
          <div className='flex items-center gap-2'>
            <button
              onClick={onStartDaily}
              disabled={todayCompleted}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm font-medium',
                isPlayingDaily
                  ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50'
                  : todayCompleted
                    ? 'bg-green-800/30 text-green-400 cursor-default'
                    : 'bg-yellow-600/80 hover:bg-yellow-500/80 text-white'
              )}
            >
              {todayCompleted ? (
                <>
                  <Crown className='w-4 h-4' />
                  <span className='hidden sm:inline'>Daily Complete!</span>
                </>
              ) : (
                <>
                  <Calendar className='w-4 h-4' />
                  <span className='hidden sm:inline'>Daily Challenge</span>
                </>
              )}
            </button>
          </div>

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
      <DailyCalendarModal
        isOpen={showCalendar}
        onClose={() => setShowCalendar(false)}
      />
    </>
  );
}


