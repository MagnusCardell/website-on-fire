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
  limitStatus?: {
    label: string;
    tone: 'green' | 'amber' | 'red' | 'blue';
    onClick: () => void;
  };
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatMoveCount(moveCount: number): string {
  return `${moveCount} ${moveCount === 1 ? 'move' : 'moves'}`;
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
  limitStatus,
}: HeaderProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [crownCount, setCrownCount] = useState(0);
  const [todayCompleted, setTodayCompleted] = useState(false);
  const [currentDateKey, setCurrentDateKey] = useState(() => getKey(new Date()));

  useEffect(() => {
    async function checkStatus() {
      const today = new Date();
      const todayKey = getKey(today);
      const completed = await isDailyCompleted(todayKey);
      const crowns = await getCrownCount();
      setTodayCompleted(completed);
      setCrownCount(crowns);
      setCurrentDateKey(todayKey);
    }
    checkStatus();

    // Check if the date has changed (midnight crossing)
    const interval = setInterval(() => {
      const nowKey = getKey(new Date());
      if (nowKey !== currentDateKey) {
        checkStatus();
      }
    }, 60_000); // 1min

    return () => clearInterval(interval);
  }, [isPlayingDaily, currentDateKey]);

  const iconButtonClass = 'h-8 w-8 shrink-0 rounded-lg transition-all flex items-center justify-center';
  const passiveButtonClass = 'bg-green-800/50 hover:bg-green-700/50 text-white';

  return (
    <>
      <header
        className={cn(
          // layout
          'grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1',
          // background / separation
          'bg-green-900/80 backdrop-blur-sm border-b border-green-700/50',
          // spacing: compact for iPhone + safe-area aware
          'pb-2',
          'pt-[calc(env(safe-area-inset-top)+0.25rem)]',
          'pl-[calc(env(safe-area-inset-left)+0.75rem)] pr-[calc(env(safe-area-inset-right)+0.75rem)]'
        )}
      >
        {/* Left */}
        <div className='min-w-0 flex items-center gap-1 justify-self-start'>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={cn(
              iconButtonClass,
              canUndo
                ? passiveButtonClass
                : 'bg-green-900/30 text-green-700 cursor-not-allowed'
            )}
            aria-label='Undo'
          >
            <Undo2 className='w-4 h-4' />
          </button>

          <div
            className='h-8 min-w-[4.4rem] rounded-lg border border-green-700/25 bg-green-950/25 px-2 flex items-center justify-center text-white/80 text-[11px] font-medium tabular-nums'
            aria-label={formatMoveCount(moveCount)}
          >
            {formatMoveCount(moveCount)}
          </div>
        </div>

        {/* Center */}
        <div className='justify-self-center text-white font-medium tabular-nums text-sm min-w-0'>
          <button
            onClick={() => setShowCalendar(true)}
            className='h-8 min-w-[5.3rem] flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-black/15 px-2 hover:bg-white/10 transition-colors'
            aria-label='Daily challenge calendar'
          >
            {formatTime(elapsedTime)}
            <Crown className='w-4 h-4 text-gray-400' />
            <span className='text-gray-400 text-sm font-medium tabular-nums'>{crownCount} </span>
          </button>
        </div>

        {/* Right */}
        <div className='min-w-0 flex items-center gap-1 justify-self-end'>
          <button
            onClick={onStartDaily}
            disabled={todayCompleted}
            className={cn(
              iconButtonClass,
              isPlayingDaily
                ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50'
                : todayCompleted
                  ? 'bg-green-800/30 text-green-400 cursor-default'
                  : 'bg-yellow-600/80 hover:bg-yellow-500/80 text-white'
            )}
            aria-label={todayCompleted ? 'Daily complete' : 'Start daily challenge'}
            title={todayCompleted ? 'Daily complete' : 'Daily challenge'}
          >
            {todayCompleted ? (
              <Crown className='w-4 h-4' />
            ) : (
              <Calendar className='w-4 h-4' />
            )}
          </button>

          <button
            onClick={onShowStats}
            className={cn(iconButtonClass, passiveButtonClass)}
            aria-label='Statistics'
          >
            <BarChart3 className='w-4 h-4' />
          </button>

          <button
            onClick={onNewGame}
            className={cn(iconButtonClass, passiveButtonClass)}
            aria-label='New Game'
          >
            <RotateCcw className='w-4 h-4' />
          </button>
        </div>

        {limitStatus && (
          <button
            onClick={limitStatus.onClick}
            className={cn(
              'col-span-3 justify-self-center h-5 w-full max-w-[18rem] truncate rounded-full border px-3 text-[10px] leading-5 transition-colors',
              limitStatus.tone === 'green' && 'bg-green-950/45 border-green-700/35 text-green-100/80 hover:bg-green-900/60',
              limitStatus.tone === 'amber' && 'bg-amber-950/60 border-amber-500/50 text-amber-100 hover:bg-amber-900/70',
              limitStatus.tone === 'red' && 'bg-red-950/60 border-red-500/50 text-red-100 hover:bg-red-900/70',
              limitStatus.tone === 'blue' && 'bg-blue-950/60 border-blue-500/50 text-blue-100 hover:bg-blue-900/70'
            )}
            title={limitStatus.label}
          >
            {limitStatus.label}
          </button>
        )}
      </header>
      <DailyCalendarModal
        isOpen={showCalendar}
        onClose={() => setShowCalendar(false)}
      />
    </>
  );
}
